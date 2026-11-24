# VUT — Gerador de Cartas · Plano de Implementação

> Brief para agente de desenvolvimento. Next.js 15 + Tailwind + Supabase, deploy na Vercel.
> As chaves do Supabase já existem — criar apenas as **migrations**.

---

## 1. O produto em uma frase

O jogador digita **só o Riot ID**. O sistema busca os stats dele sozinho e devolve uma
**carta colecionável**. Ele compartilha como imagem ou link, e é convidado pro grupo de WhatsApp.

### O AHA moment é inegociável

```
usuário digita  heat#BR1   →   [buscando...]   →   a carta dele aparece pronta
                                                   com números que ele não digitou
```

É esse "como é que ele sabe disso?" que faz a pessoa compartilhar. **Não existe formulário
onde o usuário digita os próprios stats** — isso destrói o AHA e ainda enche o banco de
carta inventada. Entrada manual só existe como fallback quando a busca falha, e a carta
resultante nasce marcada como não confiável.

```
jogador digita Riot ID → carta aparece → compartilha
                                              ↓
                amigo abre o link → vê a carta → digita o Riot ID dele
                                              ↓
                                    entra no grupo de WhatsApp
```

Cada carta compartilhada **é uma landing page de aquisição**. Quando houver conflito entre
elegância técnica e esse loop, o loop ganha.

---

## 2. Stack

| Camada | Escolha | Observação |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | |
| Estilo | Tailwind | Design system na seção 8 |
| Efeito 3D | `react-parallax-tilt` | **Não** usar `react-tilt` (abandonado) |
| Render da carta | `next/og` (`ImageResponse`, satori) | Já vem no Next |
| Banco | Supabase (Postgres) | Chaves existem; criar migrations |
| Deploy | Vercel, região `gru1` | Público é BR |
| Analytics | PostHog ou GA4 | Eventos na seção 11 |

```bash
npm i react-parallax-tilt @supabase/supabase-js nanoid zod
```

---

## 3. Integração com o Valorant Tracker

### 3.1 Formato do link e do identificador

O Riot ID é `nick#tag`. Nas URLs ele vai **URL-encoded**, com `#` virando `%23`:

```
heat#BR1   →   heat%23BR1
dedada#6625 →  dedada%236625
```

Página pública (só para o link "ver meu perfil"):
```
https://tracker.gg/valorant/profile/riot/{riotIdEncoded}/overview?playlist=competitive
```

### 3.2 Endpoints (é a API interna que o próprio site consome)

```
BASE = https://api.tracker.gg/api/v2/valorant/standard/profile/riot/{riotIdEncoded}

GET  {BASE}?source=web
     → perfil + segments (season, agent, weapon, map, peak-rating)

GET  {BASE}/segments/playlist?playlist=competitive&source=web
     → recorte por playlist (169 segmentos: temporadas e atos)
```

O endpoint de perfil já traz tudo que a carta precisa. **O segundo só é necessário se você
quiser recortar por temporada específica.**

> **O Tracker Score (0–1000) não vem na API.** `/segments/tracker-score` retorna
> 400 "not implemented" — o site calcula esse número no cliente. Como o overall do VUT
> é o Tracker Score ÷ 10, há duas formas de obtê-lo, nesta ordem de preferência:
>
> 1. **Ler do HTML do perfil** (`tracker.gg/valorant/profile/riot/{id}/overview`),
>    na barra inferior onde aparece `Tracker Score · 629 /1000`. É o valor autoritativo.
> 2. **Aproximar pelos percentis** com os pesos da seção 4, caso a leitura falhe.
>    Validado em dois perfis: desvio de ~1 ponto num caso e ~4 no outro. Aceitável
>    para fallback, não para o valor principal.
>
> Gravar em `cards.tracker_score` e `cards.score_origem` ('html' | 'estimado').

### 3.3 Onde pegar cada dado — caminhos validados

Seja `d = resposta.data` e `s = d.segments.find(x => x.type === 'season')`.

| Campo da carta | Caminho no JSON | Exemplo retornado |
|---|---|---|
| Riot ID | `d.platformInfo.platformUserHandle` | `"dedada#6625"` |
| Playercard | `d.platformInfo.avatarUrl` | `titles.trackercdn.com/.../displayicon.png` |
| Rank (nome) | `s.stats.rank.metadata.tierName` | `"Diamond 1"` |
| **Ícone do rank** | `s.stats.rank.metadata.iconUrl` | `trackercdn.com/.../tiersv2/18.png` |
| Pico | `s.stats.peakRank.metadata.tierName` / `.iconUrl` | `"Diamond 3"` |
| **RW %** | `s.stats.roundsWinPct` | `.value 50.39` · `.displayValue "50.4%"` · `.percentile 56` |
| **KAST %** | `s.stats.kAST` | `.value 70.86` · `"70.9%"` · `.percentile 65` |
| **ACS** | `s.stats.scorePerRound` | `.value 252.46` · `"252.5"` · `.percentile 88` |
| **DDΔ** | `s.stats.damageDeltaPerRound` | `.value 26.96` · `"27"` · `.percentile 89` |
| HS % | `s.stats.headshotsPercentage` | |
| Partidas | `s.stats.matchesPlayed` | usar como gate (seção 3.7) |
| Temporada | `s.attributes.seasonId` | |

Cada stat é um objeto `{ value, displayValue, percentile, metadata }`.

#### Letra do tier (o S/A/B/C/D que o tracker mostra)

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

Usar na tela de resultado ao lado de cada stat (`73.3%  [S]  top 15%`), não na carta.

### 3.4 Agente mais jogado

```ts
const agentes = d.segments.filter(x => x.type === 'agent')
const top = agentes
  .sort((a, b) => b.stats.matchesPlayed.value - a.stats.matchesPlayed.value)[0]

top.metadata.name      // "Jett"
top.metadata.imageUrl  // ícone quadrado  → slot do agente na carta
top.metadata.heroUrl   // arte de corpo inteiro → imagem central da carta
top.metadata.role      // "Duelist"
top.metadata.color     // cor do agente
```

`heroUrl` resolve a imagem central: usar a arte do agente mais jogado quando houver, e a
silhueta padrão quando não houver.

**Sempre o primeiro da lista**, ordenado por partidas — é o mesmo critério do painel
TOP AGENTS do tracker.

### 3.5 Os três ícones da carta

| Slot | Origem | URL |
|---|---|---|
| Topo-direita | **Logo de time do VLR**, sorteado | `owcdn.net/img/{id}.png` — vem do `vlr_scraper.py --enrich`, campo `time.logo`. Sortear de forma determinística: `logos[hash(riotId) % logos.length]`, para a carta não mudar a cada visita |
| Meio | **Ícone do agente** (tracker) | `top.metadata.imageUrl` |
| Baixo | **Ícone do rank** (tracker) | `s.stats.rank.metadata.iconUrl` |

#### Builder de URL de asset

O tracker tem um redimensionador próprio. **Usar sempre para os assets dele** — evita
baixar 1024×1024 para desenhar em 68px:

```ts
// lib/assets.ts
const SVC = 'https://imgsvc.trackercdn.com/url'

/** Só aceita origens do próprio tracker (trackercdn.com, titles.trackercdn.com). */
export function imgsvc(url: string, maxWidth = 144, quality = 100) {
  return `${SVC}/max-width(${maxWidth}),quality(${quality})/${encodeURIComponent(url)}/image.png`
}
```

Testado:

| Asset | Origem | Pelo imgsvc |
|---|---|---|
| Ícone do agente | `titles.trackercdn.com` | ✅ 120×120 |
| Ícone do rank | `trackercdn.com` | ✅ 120×120 |
| Playercard | `titles.trackercdn.com` | ✅ 128×128 |
| **Logo de time (VLR)** | `owcdn.net` | ❌ **rejeitado** — usar a URL direta |

O redimensionador **só reduz, nunca amplia**: pedir `max-width(240)` num arquivo de 128px
devolve 128px. Dimensionar pelo uso real na carta (rank e agente em 68–72px → pedir 144
para cobrir retina).

O ícone do rank também pode ser montado sem depender do campo da API:

```
https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/{n}.png
```

```ts
// n por tier — validado: Diamante 1 = 18, Diamante 3 = 20, Ascendente 2 = 22
const ORDEM = ['Iron','Bronze','Silver','Gold','Platinum','Diamond','Ascendant','Immortal']
function tierNum(tierName: string) {            // "Diamond 2" -> 19
  if (/radiant/i.test(tierName)) return 27
  const [, nome, div] = tierName.match(/^(\D+)\s*(\d)?$/) ?? []
  const i = ORDEM.findIndex(x => new RegExp('^' + x, 'i').test(nome.trim()))
  return i < 0 ? 0 : 3 + i * 3 + ((+div || 1) - 1)
}
```

**Rank atual e pico** também vão para o banco e para a tela de resultado:
`s.stats.rank.metadata.tierName` ("Diamond 2") e `s.stats.peakRank.metadata.tierName`
("Ascendant 2"), cada um com seu `iconUrl`.

### 3.6 Imagens remotas no satori

Satori **não baixa imagem sozinho de forma confiável**. Para cada slot: buscar server-side,
converter para data URL e passar embutido no JSX. Cachear os binários — são poucos arquivos
(28 ícones de rank, ~27 agentes, N logos de time) e praticamente imutáveis.

**Isto não é opcional, é a única via.** Testado: os três CDNs servem a imagem normalmente
para uma tag `<img>`, mas **nenhum deles envia `Access-Control-Allow-Origin`**:

| CDN | `<img>` | `fetch` / CORS |
|---|---|---|
| `trackercdn.com` (rank) | 256×256 OK | falha |
| `titles.trackercdn.com` (agente) | 1024×1024 OK | sem header ACAO |
| `owcdn.net` (time) | 200×200 OK | falha |

Consequência: **qualquer tentativa de montar o PNG no browser está descartada** —
`fetch` é bloqueado e desenhar no canvas o contamina (`tainted`), o que quebra
`toBlob`. O pipeline inteiro de imagem vive no servidor.

O proxy `imgsvc` **também é outro origin**, então ele não resolve o problema de CORS —
só reduz o peso do download que o servidor faz. Nenhum atalho pelo cliente funciona.

Sugestão de implementação: `lib/assets.ts` com `getAsset(url): Promise<ArrayBuffer>`,
cache em memória + Supabase Storage como segundo nível, e um script de seed que
pré-carrega os 28 ícones de rank no primeiro deploy. Montar as URLs com o `imgsvc()`
acima para os assets do tracker, e direto para os logos do VLR.

### 3.7 Regras de chamada

- **Sempre server-side.** A API não manda CORS pro nosso domínio e o tracker.gg está atrás
  de Cloudflare — chamada do browser falha. Toda busca passa por route handler nosso.
- **Header obrigatório:** `User-Agent` de browser real. Sem isso o Cloudflare devolve 403.
- **Cache de 6h por Riot ID** em tabela própria (`tracker_cache`). Stats de ranqueada não
  mudam de minuto em minuto e isso reduz drasticamente o risco de bloqueio.
- **Rate limit próprio:** no máximo 1 req/s para o tracker, fila global. Nunca disparar em
  paralelo.
- **Busca sempre iniciada pelo dono do perfil.** Uma página por vez, sob demanda, nunca
  crawler varrendo. Isso é o que separa "o jogador pediu a carta dele" de "montamos um banco
  com stats de terceiros" — e é essa segunda leitura que inviabiliza o pedido de acesso à API
  oficial da Riot mais adiante, que é o ativo caro.
- **Gate de elegibilidade:** `matchesPlayed < 10` → não gera carta, mensagem
  "jogue mais algumas ranqueadas e volta aqui". Evita carta com percentil sem significado.

### 3.8 Erros a tratar

| Situação | Resposta ao usuário |
|---|---|
| 404 / perfil inexistente | "Não achamos esse Riot ID. Confere a tag depois do #." |
| Perfil privado | "Seu perfil está privado no tracker. [como liberar]" |
| 403 Cloudflare | Retry 1× com backoff; depois cai no fallback manual |
| `matchesPlayed < 10` | Mensagem de elegibilidade acima |
| Timeout > 8s | Fallback manual, carta marcada como não verificada |

---

## 4. Overall e cor

**O overall é o Tracker Score ÷ 10**, com teto 79.

```ts
// lib/overall.ts

/** Carta de jogador comum — teto 79.
 *  A fronteira dos 80 é exclusiva de VCT: ninguém grinda até lá. */
export function overallComum(trackerScore: number) {
  return clamp(40, 79, Math.round(trackerScore / 10))
}

/** Fallback quando a leitura do Tracker Score falhar. */
const PESOS = { acs: 0.30, dd: 0.25, kast: 0.25, rw: 0.20 }
export function estimarScore(s: TrackerStats) {
  return Math.round((
      s.scorePerRound.percentile       * PESOS.acs
    + s.damageDeltaPerRound.percentile * PESOS.dd
    + s.kAST.percentile                * PESOS.kast
    + s.roundsWinPct.percentile        * PESOS.rw
  ) * 10)
}

/** Carta de pro (rating do VLR.gg) — piso 80, teto 99.
 *  rating 1.00 (pro mediano) = 85 · 1.20+ = Lendária */
export function overallPro(vlrRating: number) {
  return clamp(80, 99, Math.round(80 + (vlrRating - 0.80) * 25))
}
```

### Escala de cor — pelo Tracker Score

Define **borda da carta, caixa do overall, gradiente semitransparente e os dois stats
em destaque**. Uma variável, quatro usos.

| Tracker Score | Overall | Tier | Cor |
|---|---|---|---|
| < 600 | até 59 | BRONZE | `#b87a4a` |
| 600 – 749 | 60 – 74 | OURO | `#f0a92c` |
| 750 – 849 | 75 – 79 | ESMERALDA | `#2fd47a` |
| 850 – 924 | 79 (teto) | DIAMANTE | `#22c9e8` |
| 925+ | 79 (teto) | RADIANTE | `#e23bd0` |

Calibrado contra as cartas de referência: scores na casa dos 660–730 saem douradas,
760 sai esmeralda.

## 5. Layout da carta — 600 × 840

Compacta, sem cromo, uma cor de acento só. **Coordenadas exatas** (viewBox 600×840):

```
borda        rect 0,0,600,840  rx 23  fill COR
interior     rect 5,5,590,830  rx 19  fill #0b0d10
gradiente    rect 5,190,590,460  linear vertical, 3 paradas:
             0% opacidade 0 · 72% opacidade .30 · 100% opacidade 0
             (as três paradas evitam o corte duro no rodapé)

overall      rect 26,22,90,78  rx 9  fill #000 @50%  stroke COR 2.5px
             texto centro (71,77) · 45px · 800 · branco

time         image 476,20   88×50  preserveAspectRatio="xMidYMid meet"
agente       rect  484,82   72×72  rx 8  fill #0a0c0f  stroke #272c34 1.5px
             image 486,84   68×68  clip rx 7  slice
rank         image 486,166  68×68  meet

personagem   heroUrl do agente, ou silhueta cinza #8f959e @90%
             cabeça  ellipse 300,330 r 76×88
             busto   path   300,442 → 151,606 → 449,606

nome         bandeira 42×30 em y=640 · nick y=666
             fonte = min(44, 370 / (len × 0.60))   ← encolhe em nick longo
             bandeira + nick centralizados como grupo
             SEM linha de tag embaixo · SEM valor em moeda

divisor      rect 42,696,516,1.4  fill #1a1e25

stats 2×2    linha 1 y=742 · linha 2 y=794
             col1  label x=50  valor x=286 (âncora fim)
             col2  label x=318 valor x=552 (âncora fim)
             label 21px 700 #767f8d · valor 26px 800
             coluna esquerda (RW, ACS) na COR · direita em branco
```

Sem selo de raridade escrito — a cor comunica. Selo **NÃO VERIFICADA** só nas cartas
de fallback manual.

**Fontes no satori**: `ImageResponse` exige o buffer. Commitar o `.ttf` em
`assets/fonts/`, carregar com `fs.readFile`, usar `runtime = 'nodejs'`.
Satori suporta **flexbox, não grid**.

## 6. Fluxo da home

### Estado 1 — entrada
Um campo só, grande, em mono: `nick#TAG`. Botão **GERAR CARTA**.
Microcópia: "É o nome que aparece no jogo, com a tag depois do #."
Nada mais na tela. Sem campos de stats.

### Estado 2 — busca (2 a 5s)
Skeleton da carta com os slots piscando e um log técnico de 3 linhas aparecendo em sequência:

```
▪ localizando dedada#6625
▪ lendo 142 partidas ranqueadas
▪ calculando percentis
```

Esse teatro de 3 segundos **é o que dá peso ao AHA**. Não pular.

### Estado 3 — revelação
A carta entra com fade + tilt. Os quatro números aparecem escalonados (80ms entre cada).
Abaixo, uma linha que explica o overall:
*"Overall 76 — você está à frente de 76% dos jogadores de ranqueada."*

### Estado 4 — ação
`CRIAR MINHA CARTA` só aparece na página pública. Aqui: **Baixar PNG · Copiar link · Entrar no grupo**.

### Fallback
Busca falhou → abre o form manual, com aviso claro, e a carta sai com selo **NÃO VERIFICADA**
e `tipo = 'manual'`. Carta manual **não entra em placar** em nenhuma fase futura.

---

## 7. Rotas

| Rota | Método | Função |
|---|---|---|
| `/` | — | Riot ID → busca → revelação |
| `/c/[slug]` | — | Carta pública + CTA de loop |
| `/api/lookup` | POST | `{riotId}` → stats do tracker (com cache) |
| `/api/cards` | POST | Grava e devolve `{slug}` |
| `/api/card` | GET | PNG da carta (satori) |
| `/c/[slug]/opengraph-image` | — | og:image = a própria carta |

**Um renderizador só.** Preview, download e og:image saem todos de `/api/card`. Se forem
implementações diferentes elas divergem e o que o usuário baixa não é o que ele viu.

```ts
export async function generateMetadata({ params }) {
  const c = await getCard(params.slug)
  if (!c) return {}
  return {
    title: `${c.nick} · ${c.overall} OVR · VUT`,
    description: `Top ${100 - c.percentil}% das ranqueadas — Série ${c.serie} #${pad(c.serial_num)}`,
    openGraph: { images: [{ url: `${SITE}/c/${params.slug}/opengraph-image`, width: 600, height: 840 }] },
    twitter: { card: 'summary_large_image' },
  }
}
```

---

## 8. Design system da LP

Referência: dashboard escuro técnico. **A interface é monocromática — a carta é a única
coisa colorida da tela.**

```css
--bg:    #0a0a0b    /* + textura radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px) 4px */
--panel: #0e0f11
--line:  #1c1e22    /* fio de 1px, sem sombra */
--line2: #262a30
--txt:   #e9eaec
--dim:   #6b7280
--ok:    #4ade80    --warn: #fbbf24   /* só em pontinhos de status de 5px */
```

- Painéis com borda 1px e **marcação de canto** (6×6px, `::before` topo-esq, `::after` base-dir)
- Labels: mono, 10px, `letter-spacing: .12em`, caixa alta, com quadradinho 5px antes
- Botão primário: fundo branco, texto preto. Secundário: outline
- Cantos retos ou no máximo 2px. **Sem gradiente, sem glow, sem sombra colorida na UI**
- Faixa de KPIs no topo (overall, tier, verificação, serial) atualizando ao vivo
- Mobile-first: público de Valorant BR é majoritariamente mobile

---

## 9. Supabase — migrations

`supabase/migrations/0001_cards.sql`:

```sql
create table public.cards (
  slug           text primary key,
  riot_id        text not null,
  nick           text not null,
  tag            text not null,
  pais           text,
  tipo           text not null check (tipo in ('tracker','manual','pro')),
  rank_nome      text,
  rank_icon      text,
  peak_nome      text,
  peak_icon      text,
  time_logo      text,
  tracker_score  int,
  score_origem   text check (score_origem in ('html','estimado')),
  agente         text,
  agente_icon    text,
  agente_hero    text,
  overall        int  not null check (overall between 40 and 99),
  percentil      numeric(5,2),
  tier           text not null,
  rw numeric, kast numeric, acs numeric, dd numeric,
  serie          int  not null default 1,
  serial_num     bigint generated always as identity,
  ip_hash        text,
  created_at     timestamptz not null default now()
);
create unique index cards_riot_serie on public.cards (lower(riot_id), serie);
create index cards_created_idx on public.cards (created_at desc);

alter table public.cards enable row level security;
create policy "cards_public_read" on public.cards
  for select to anon, authenticated using (true);
revoke insert, update, delete on public.cards from anon, authenticated;
```

`supabase/migrations/0002_tracker_cache.sql`:

```sql
create table public.tracker_cache (
  riot_id     text primary key,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);
alter table public.tracker_cache enable row level security;
-- sem policy: só service_role acessa
```

Índice único por `(riot_id, serie)`: **um Riot ID gera uma carta por série**. Buscar de novo
atualiza a carta existente em vez de criar outra — preserva o link já compartilhado.

Env na Vercel:
```
NEXT_PUBLIC_SUPABASE_URL=        NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       (nunca com prefixo NEXT_PUBLIC_)
NEXT_PUBLIC_WHATSAPP_GROUP=      NEXT_PUBLIC_SITE_URL=
```

---

## 10. Checklist que o agente costuma esquecer

- [ ] **Riot ID normalizado** — `trim`, lowercase para chave de cache e índice, display preserva o original
- [ ] **Validação:** `/^[^#]{3,16}#[A-Za-z0-9]{3,5}$/`
- [ ] **XSS** — o nick entra em texto renderizado. Sanitizar antes do satori
- [ ] **Tilt desligado no touch** — `matchMedia('(hover: hover)')`
- [ ] **Rate limit** — 5 cartas/hora por `ip_hash` (SHA-256 do IP + salt, nunca o IP cru)
- [ ] **Cache** — carta salva `public, immutable, max-age=31536000`; lookup 6h
- [ ] **Imagens remotas no satori** — `trackercdn.com` precisa ser buscado server-side e
      passado como buffer; satori não baixa sozinho de forma confiável
- [ ] **Selo NÃO VERIFICADA** nas cartas de fallback manual
- [ ] **404 de `/c/[slug]`** com CTA de criar carta — é tráfego, não erro
- [ ] **`preferredRegion = ['gru1']`** nos route handlers

---

## 11. Analytics

```
lookup_started { riotIdHash }      lookup_succeeded { overall, tier }
lookup_failed  { motivo }          card_generated  { overall, tier, tipo }
card_png_downloaded                card_link_copied
card_page_viewed { referrer }      cta_create_own_clicked   ← loop viral
whatsapp_group_clicked             ← conversão final
```

**KPIs:** `cta_create_own_clicked / card_page_viewed` = coeficiente viral (meta > 0,3).
`lookup_succeeded / lookup_started` = saúde da integração (abaixo de 0,85, investigar).

---

## 12. Entrega em 3 PRs

### PR 1 — Lookup + carta
`/api/lookup` com cache, `<Carta />`, `/api/card`, os 4 estados da home, download do PNG.
**Aceite:** digitar um Riot ID real e a carta aparecer com os números corretos,
conferidos contra o perfil no tracker.gg. Nenhum campo de stat digitável na tela.

### PR 2 — Link público *(o que importa)*
Migrations, `/api/cards`, `/c/[slug]`, `opengraph-image`, CTAs, WhatsApp.
**Aceite:** colar `https://<dominio>/c/<slug>` no **WhatsApp, Discord e X** e a carta
aparecer no preview nos três. Se não aparecer, o produto não cresce.

### PR 3 — Operação
Analytics, rate limit, fallback manual, gate de 10 partidas, seed de ~50 cartas de pro
via `vlr_scraper.py --enrich`, página `/cartas`.
**Aceite:** eventos no painel e cartas de VCT no banco.

---

## 13. Deploy

```bash
vercel link && vercel env pull .env.local
npx supabase db push
vercel --prod
```

Conferir em produção: `/api/lookup` com um Riot ID real; validador de OG mostrando a carta;
Lighthouse mobile ≥ 90 na home.