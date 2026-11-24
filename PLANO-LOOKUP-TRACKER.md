# VUT — Lookup no Valorant Tracker

> Especificação da busca de dados reais a partir do Riot ID.
> Complementa o `PLANO-VUT-CARD-GENERATOR.md`, que cobre carta, banco e rotas.

---

## 0. Regras que não se negociam

1. **Nenhum dado é inventado.** Sem `Math.random()`, sem array de perfis de exemplo,
   sem valores default que "parecem reais". Se o lookup falhar, a resposta é erro.
2. **Nenhum campo de stat é digitável pelo usuário.** O único input da aplicação é o
   Riot ID. O usuário não digita ACS, KAST, rank nem nada.
3. **Carta só existe com lookup bem-sucedido.** Falhou → mensagem de erro, não carta.
4. Se algum campo específico vier ausente da API, o certo é **falhar explicitamente**
   nesse campo (`null` + log), nunca preencher com estimativa silenciosa.

Critério para considerar a tarefa pronta: rodar com um Riot ID real e conferir cada
número contra o perfil aberto no `tracker.gg`. Se não bater, não está pronto.

---

## 1. Identificador e URLs

O Riot ID tem o formato `nick#tag`. Em URL o `#` vira `%23`:

```ts
const encodeRiotId = (id: string) => encodeURIComponent(id.trim())
// "dedada#6625"  → "dedada%236625"
// "guiisnk#1923" → "guiisnk%231923"
```

| Para que | URL |
|---|---|
| Perfil público (link "ver no tracker") | `https://tracker.gg/valorant/profile/riot/{enc}/overview?playlist=competitive` |
| **API — perfil completo** | `https://api.tracker.gg/api/v2/valorant/standard/profile/riot/{enc}?source=web` |
| API — recorte por playlist/temporada | `https://api.tracker.gg/api/v2/valorant/standard/profile/riot/{enc}/segments/playlist?playlist=competitive&source=web` |

A primeira URL da API **já traz tudo que a carta precisa**. A segunda só é necessária
para recortar por temporada específica (devolve ~169 segmentos, um por ato).

### Headers

```ts
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
              + '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Referer': 'https://tracker.gg/',
}
```

Sem `User-Agent` de browser o Cloudflare devolve 403.

### Sempre no servidor

A API não envia `Access-Control-Allow-Origin` para o nosso domínio. Chamada a partir do
browser **não funciona**. Todo lookup passa por route handler nosso (`/api/lookup`).

---

## 2. Estrutura da resposta

```ts
type TrackerResponse = {
  data: {
    platformInfo: {
      platformUserHandle: string   // "dedada#6625"
      avatarUrl: string            // playercard
    }
    segments: Segment[]
  }
}

type Segment = {
  type: 'season' | 'peak-rating' | 'weapon' | 'map'
      | 'map-top-agent' | 'agent' | 'agent-top-map' | 'agent-role'
  attributes: { seasonId?: string; playlist?: string }
  metadata: Record<string, any>
  stats: Record<string, Stat>
}

type Stat = {
  value: number | null
  displayValue: string             // já formatado: "50.4%", "252.5"
  percentile?: number              // 0–100 — usar este, não o displayValue
  metadata?: { iconUrl?: string; tierName?: string }
}
```

O segmento que interessa:

```ts
const season = data.segments.find(
  s => s.type === 'season' && s.attributes.playlist === 'competitive'
)
```

---

## 3. Onde pegar cada dado

Com `s = season` e `d = data`:

| Campo | Caminho | Observação |
|---|---|---|
| Riot ID | `d.platformInfo.platformUserHandle` | usar como display, preserva maiúsculas |
| Playercard | `d.platformInfo.avatarUrl` | opcional na carta |
| **Rank atual** | `s.stats.rank.metadata.tierName` | `"Diamond 2"` |
| **Ícone do rank** | `s.stats.rank.metadata.iconUrl` | URL pronta |
| Pico | `s.stats.peakRank.metadata.tierName` / `.iconUrl` | |
| **RW %** | `s.stats.roundsWinPct` | `.displayValue` + `.percentile` |
| **KAST %** | `s.stats.kAST` | atenção ao **K maiúsculo no meio** |
| **ACS** | `s.stats.scorePerRound` | |
| **DDΔ** | `s.stats.damageDeltaPerRound` | |
| Partidas | `s.stats.matchesPlayed.value` | gate de elegibilidade |
| HS % | `s.stats.headshotsPercentage` | opcional |
| Temporada | `s.attributes.seasonId` | gravar junto da carta |

**Para a carta use `displayValue`** — já vem formatado pelo tracker ("50.4%", "252.5",
"27"), o que garante que o seu número é idêntico ao do site. Guarde `value` (float cru)
no banco para cálculos futuros.

### Agente mais jogado

```ts
const agentes = d.segments.filter(s => s.type === 'agent')
const top = agentes.sort(
  (a, b) => (b.stats.matchesPlayed?.value ?? 0) - (a.stats.matchesPlayed?.value ?? 0)
)[0]

top.metadata.name      // "Jett"
top.metadata.imageUrl  // ícone quadrado → slot do agente
top.metadata.heroUrl   // arte de corpo inteiro → imagem central
top.metadata.role      // "Duelist"
top.metadata.color     // cor do agente
```

Sempre o primeiro da ordenação — mesmo critério do painel TOP AGENTS do site.

---

## 4. Tracker Score — o único que não vem na API

`GET /segments/tracker-score` responde **400 "not implemented"**. O número 0–1000 que
aparece na barra inferior do perfil é calculado no cliente pelo site deles.

Como o overall do VUT é `trackerScore / 10`, implementar nesta ordem:

### 4.1 Primário — ler do HTML do perfil

```
GET https://tracker.gg/valorant/profile/riot/{enc}/overview?playlist=competitive
```

Com os mesmos headers. Procurar na barra inferior o bloco `Tracker Score` seguido do
valor e de `/1000`. O seletor exato **precisa ser confirmado na implementação** — a
página é Vue com classes hasheadas (`data-v-*`), então prefira buscar por texto:

```ts
// regex tolerante a markup no meio
const m = html.match(/Tracker\s*Score[\s\S]{0,400}?(\d{1,4})\s*(?:\/|<[^>]*>\s*\/)\s*1000/i)
const score = m ? Number(m[1]) : null
```

Se a página for renderizada só no cliente e o valor não estiver no HTML inicial, usar
`playwright`/`puppeteer` **não compensa** — cair direto no 4.2.

### 4.2 Fallback — estimar pelos percentis

```ts
const PESOS = { acs: 0.30, dd: 0.25, kast: 0.25, rw: 0.20 }

function estimarScore(s) {
  return Math.round((
      s.scorePerRound.percentile       * PESOS.acs
    + s.damageDeltaPerRound.percentile * PESOS.dd
    + s.kAST.percentile                * PESOS.kast
    + s.roundsWinPct.percentile        * PESOS.rw
  ) * 10)
}
```

Precisão medida em dois perfis reais: **erra entre 1 e 4 pontos de overall**.

### 4.3 Registrar a origem

```sql
tracker_score  int,
score_origem   text check (score_origem in ('html','estimado'))
```

Sem esse campo você não sabe quais cartas têm overall confiável. Exibir um marcador
discreto na carta quando for `estimado` é opcional, mas gravar não é.

---

## 5. Ícones

### 5.1 Builder de URL

```ts
const SVC = 'https://imgsvc.trackercdn.com/url'

/** Redimensionador do tracker. Aceita APENAS origens do próprio tracker. */
export function imgsvc(url: string, maxWidth = 144, quality = 100) {
  return `${SVC}/max-width(${maxWidth}),quality(${quality})/${encodeURIComponent(url)}/image.png`
}
```

| Asset | Origem | Pelo imgsvc |
|---|---|---|
| Ícone do rank | `trackercdn.com` | ✅ |
| Ícone do agente | `titles.trackercdn.com` | ✅ |
| Playercard | `titles.trackercdn.com` | ✅ |
| **Logo de time (VLR)** | `owcdn.net` | ❌ rejeitado — usar URL direta |

O proxy **só reduz, nunca amplia**: pedir `max-width(240)` num arquivo de 128px devolve
128px. Pedir 144 para slots de 68–72px cobre retina.

### 5.2 Ícone do rank sem depender do campo

```
https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/{n}.png
```

```ts
const ORDEM = ['Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal']

export function tierNum(tierName: string): number {
  if (/radiant/i.test(tierName)) return 27
  const m = tierName.trim().match(/^(\D+?)\s*(\d)?$/)
  if (!m) return 0
  const i = ORDEM.findIndex(x => new RegExp('^' + x, 'i').test(m[1].trim()))
  return i < 0 ? 0 : 3 + i * 3 + ((Number(m[2]) || 1) - 1)
}
// Diamond 1 = 18 · Diamond 2 = 19 · Diamond 3 = 20 · Ascendant 2 = 22 · Radiant = 27
```

### 5.3 Logo de time (do VLR)

Não vem do tracker. Sorteado do pool gerado por `vlr_scraper.py --enrich`
(campo `time.logo`), de forma **determinística** para a carta não mudar a cada visita:

```ts
const logo = logos[hashRiotId(riotId) % logos.length]
```

> **Logo de org costuma ser preto com fundo transparente** (FURIA, por exemplo).
> Sobre a carta escura ele carrega e fica invisível. Renderizar sempre sobre uma
> placa clara arredondada (`#e9ecf0` a ~92%).

### 5.4 Como exibir

Na página é `<img src>` direto — não há CORS envolvido em exibir imagem. No
`ImageResponse` (satori) também funciona: ele busca a imagem no servidor. **SVG remoto
não é suportado**; PNG sim.

Nunca gerar o PNG no cliente: nenhum dos CDNs envia `Access-Control-Allow-Origin`,
então o canvas fica contaminado e `toBlob` quebra. O download aponta para `/api/card`.

---

## 6. Derivados

### Letra do tier (o S/A/B/C/D do site)

Não vem na API — é derivada do percentil. Faixas calibradas contra perfis reais
(percentil 8 → D, 51 → B, 77 → A, 85 → S):

```ts
const LETRAS = [
  { min: 82, letra: 'S', cor: '#32b5e8' },
  { min: 70, letra: 'A', cor: '#3ddc84' },
  { min: 45, letra: 'B', cor: '#f0c22c' },
  { min: 20, letra: 'C', cor: '#e8873a' },
  { min:  0, letra: 'D', cor: '#e05a5a' },
]
```

### Rótulo de percentil

```ts
const pctLabel = (p: number) => p >= 50 ? `Top ${100 - p}%` : `Bottom ${p}%`
```

O site mostra *Bottom* abaixo da mediana. Rotular tudo como "Top" inverte o sentido.

### Overall e cor

```ts
const overall = clamp(40, 79, Math.round(trackerScore / 10))   // teto 79: 80+ é só VCT

const TIERS = [
  { min: 925, nome: 'RADIANTE',  cor: '#e23bd0' },
  { min: 850, nome: 'DIAMANTE',  cor: '#22c9e8' },
  { min: 750, nome: 'ESMERALDA', cor: '#2fd47a' },
  { min: 600, nome: 'OURO',      cor: '#f0a92c' },
  { min:   0, nome: 'BRONZE',    cor: '#b87a4a' },
]
const tier = TIERS.find(t => trackerScore >= t.min)
```

---

## 7. Cache e limites

```sql
create table public.tracker_cache (
  riot_id     text primary key,     -- lowercase
  payload     jsonb not null,
  score       int,
  score_origem text,
  fetched_at  timestamptz not null default now()
);
alter table public.tracker_cache enable row level security;  -- sem policy: só service_role
```

- **TTL de 6h.** Stats de ranqueada não mudam de minuto em minuto.
- **Fila de 1 req/s** para o tracker. Nunca disparar em paralelo.
- **Rate limit do usuário:** 5 lookups/hora por hash de IP (SHA-256 do IP + salt).
- **Sempre iniciado pelo dono do perfil**, uma página por vez. Nunca crawler varrendo.

---

## 8. Erros

| Situação | HTTP nosso | Mensagem |
|---|---|---|
| Formato inválido | 400 | "Riot ID inválido. Use nick#TAG." |
| 404 na API | 404 | "Não achamos esse Riot ID. Confere a tag depois do #." |
| Perfil privado | 403 | "Seu perfil está privado no tracker." |
| 403 Cloudflare | 503 | 1 retry com backoff; depois "Tracker indisponível, tente em alguns minutos." |
| `matchesPlayed < 10` | 422 | "Você precisa de pelo menos 10 partidas ranqueadas." |
| Timeout > 10s | 504 | "O tracker demorou demais. Tente de novo." |

Nenhum desses casos gera carta.

---

## 9. Referência de implementação

```ts
// app/api/lookup/route.ts
import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export const preferredRegion = ['gru1']

const API = 'https://api.tracker.gg/api/v2/valorant/standard/profile/riot'
const RIOT_ID = /^[^#\s]{3,16}#[A-Za-z0-9]{3,5}$/

export async function POST(req: Request) {
  const { riotId } = await req.json()
  if (!RIOT_ID.test(riotId ?? ''))
    return NextResponse.json({ erro: 'riot_id_invalido' }, { status: 400 })

  const cached = await getCache(riotId.toLowerCase())
  if (cached) return NextResponse.json(cached)

  const enc = encodeURIComponent(riotId)
  const r = await fetch(`${API}/${enc}?source=web`, { headers: HEADERS })
  if (r.status === 404) return NextResponse.json({ erro: 'nao_encontrado' }, { status: 404 })
  if (!r.ok)            return NextResponse.json({ erro: 'tracker_indisponivel' }, { status: 503 })

  const { data } = await r.json()
  const s = data.segments.find(
    (x: any) => x.type === 'season' && x.attributes.playlist === 'competitive'
  )
  if (!s) return NextResponse.json({ erro: 'sem_competitivo' }, { status: 422 })

  const partidas = s.stats.matchesPlayed?.value ?? 0
  if (partidas < 10)
    return NextResponse.json({ erro: 'poucas_partidas', partidas }, { status: 422 })

  const agente = data.segments
    .filter((x: any) => x.type === 'agent')
    .sort((a: any, b: any) =>
      (b.stats.matchesPlayed?.value ?? 0) - (a.stats.matchesPlayed?.value ?? 0))[0]

  let score = await lerScoreDoHtml(enc)
  const origem = score != null ? 'html' : 'estimado'
  if (score == null) score = estimarScore(s.stats)

  const out = {
    riotId: data.platformInfo.platformUserHandle,
    partidas,
    trackerScore: score,
    scoreOrigem: origem,
    rank:     { nome: s.stats.rank?.metadata?.tierName,
                icon: s.stats.rank?.metadata?.iconUrl },
    peak:     { nome: s.stats.peakRank?.metadata?.tierName,
                icon: s.stats.peakRank?.metadata?.iconUrl },
    agente:   { nome: agente?.metadata?.name,
                icon: agente?.metadata?.imageUrl,
                hero: agente?.metadata?.heroUrl },
    stats: {
      rw:   pick(s.stats.roundsWinPct),
      kast: pick(s.stats.kAST),
      acs:  pick(s.stats.scorePerRound),
      dd:   pick(s.stats.damageDeltaPerRound),
    },
    seasonId: s.attributes.seasonId,
  }

  await setCache(riotId.toLowerCase(), out)
  return NextResponse.json(out)
}

const pick = (st: any) => st
  ? { valor: st.value, display: st.displayValue, percentil: st.percentile }
  : null
```

---

## 10. Fixtures de validação

Valores conferidos na API em nov/2026. **Escrever teste que bate contra isto** — é o que
impede a implementação de passar com dado mockado.

### `dedada#6625`

```
GET https://api.tracker.gg/api/v2/valorant/standard/profile/riot/dedada%236625?source=web
```

| Campo | Esperado |
|---|---|
| `platformUserHandle` | `dedada#6625` |
| `rank.metadata.tierName` | `Diamond 1` |
| `rank.metadata.iconUrl` | `.../tiersv2/18.png` |
| `peakRank.metadata.tierName` | `Diamond 3` (`tiersv2/20.png`) |
| `roundsWinPct` | `50.39…` · `"50.4%"` · percentil **56** |
| `kAST` | `70.86` · `"70.9%"` · percentil **65** |
| `scorePerRound` | `252.46…` · `"252.5"` · percentil **88** |
| `damageDeltaPerRound` | `26.96…` · `"27"` · percentil **89** |
| Top agentes | Jett (31) › Chamber (27) › Clove (12) |

Derivados esperados: letras **B / B / S / S**; rótulos Top 44% / Top 35% / Top 12% / Top 11%.

### Perfil de referência visual (dos prints do produto)

| Campo | Esperado |
|---|---|
| Tracker Score | **629** → overall **63**, tier **OURO** |
| Rank / pico | `Diamond 2` (ícone 19) / `Ascendant 2` (ícone 22) |
| RW | `46.5%` · percentil **8** · letra **D** · *Bottom 8%* |
| KAST | `73.3%` · percentil **85** · letra **S** · Top 15% |
| ACS | `235.3` · percentil **77** · letra **A** · Top 23% |
| DDΔ | `0` · percentil **51** · letra **B** · Top 49% |
| Top agente | Jett (12 partidas) › Phoenix (6) › Sage (3) |

Este caso também cobre dois detalhes fáceis de errar: **DDΔ igual a zero** não pode cair
em `|| null`, e o RW abaixo da mediana precisa sair como *Bottom*, não *Top*.

---

## 11. Critérios de aceite

- [ ] `POST /api/lookup {"riotId":"dedada#6625"}` devolve os valores da tabela acima
- [ ] Nenhuma ocorrência de `Math.random`, array de perfis ou valor default no código
- [ ] Nenhum input de stat na interface — só o Riot ID
- [ ] Riot ID inexistente devolve 404 e **não** gera carta
- [ ] Perfil com menos de 10 partidas devolve 422 e **não** gera carta
- [ ] Segundo lookup do mesmo ID em menos de 6h não bate no tracker (cache)
- [ ] `score_origem` gravado corretamente como `html` ou `estimado`
- [ ] Ícone do rank bate com o rank: Diamond 2 → `tiersv2/19.png`
- [ ] DDΔ `0` aparece como `0`, não como vazio
- [ ] RW com percentil 8 aparece como *Bottom 8%*
