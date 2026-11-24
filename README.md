# VUT — gerador de cartas

Landing page que transforma um Riot ID em carta colecionável de Valorant.
O jogador digita só `nick#TAG`; os números vêm do tracker.gg.

Next.js 15 (App Router) · TypeScript · Tailwind 4 · Supabase · deploy na Vercel (`gru1`).
Plano completo em [PLANO-VUT-CARD-GENERATOR.md](PLANO-VUT-CARD-GENERATOR.md).

## Rodar

```bash
npm install
cp .env.example .env.local     # MOCK_TRACKER=1 já roda sem Supabase e sem tracker
node scripts/preparar-assets.mjs   # gera assets/card/ a partir de public/
npm run dev
```

Sem chaves do Supabase o app usa um store em memória (some no restart) — serve para
desenvolver a LP.

> **`MOCK_TRACKER=1` faz a busca responder só com fixtures** (`heat#912` e `dedada#6625`).
> Qualquer outro Riot ID falha com o código `MOCK` e um aviso no console do servidor —
> não com "não encontrado", para ninguém confundir configuração com conta inexistente.
> Com `HENRIKDEV_API_KEY` configurada, deixe `MOCK_TRACKER=0`.

```bash
npm run build       # build de produção
npm run typecheck   # tsc --noEmit
```

## Variáveis de ambiente

| Variável | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | banco |
| `SUPABASE_SERVICE_ROLE_KEY` | escrita nas rotas (**nunca** com prefixo `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_SITE_URL` | base das URLs absolutas de og:image |
| `NEXT_PUBLIC_WHATSAPP_GROUP` | link do grupo (vazio esconde o botão) |
| `IP_HASH_SALT` | sal do SHA-256 do IP no rate limit |
| `HENRIKDEV_API_KEY` | **fonte dos dados** — sem ela o lookup não funciona |
| `TRN_API_KEY` | caminho antigo; a API pública da Tracker Network não cobre Valorant |
| `LER_SCORE_HTML` | `1` tenta ler o Tracker Score do HTML (hoje bloqueado pelo Cloudflare) |
| `MOCK_TRACKER` | `1` = fixtures locais (**só `heat#912` e `dedada#6625` existem**). Ignorado em produção |

## Banco

```bash
npx supabase db push    # supabase/migrations/0001_cards.sql, 0002_tracker_cache.sql
```

`cards` tem índice único em `(riot_key, serie)`, onde `riot_key = lower(riot_id)` é coluna
gerada: **um Riot ID gera uma carta por série**, e buscar de novo atualiza a carta existente
em vez de criar outra — o link já compartilhado continua valendo.

## Rotas

| Rota | O que faz |
|---|---|
| `/` | Riot ID → busca → revelação (4 estados) |
| `/c/[slug]` | carta pública + CTA do loop |
| `POST /api/lookup` | `{riotId}` → stats do tracker, com cache de 6h |
| `POST /api/cards` | `{riotId}` → grava e devolve `{slug, carta}` |
| `POST /api/cards/manual` | fallback manual → carta `tipo='manual'` |
| `GET /api/card?slug=` | PNG da carta (`&dl=1` força download, `&v=` ativa cache imutável) |
| `/c/[slug]/opengraph-image` | og:image 600×840 — a própria carta |
| `/c/[slug]/twitter-image` | variante 1200×630 para o X, que corta retrato |

## Decisões que não dá para desfazer sem quebrar algo

**Um renderizador só.** Preview, download e og:image saem todos de `cartaJsx()`
(`src/lib/render/carta.tsx`). Na tela, a carta é o próprio PNG dentro de um `<img>` — o que
o usuário vê é byte a byte o que ele baixa. A animação escalonada de 80ms ficou nas linhas
de percentil abaixo da carta, que são DOM.

**O pipeline de imagem vive no servidor.** Nenhum dos CDNs (`trackercdn.com`,
`titles.trackercdn.com`, `owcdn.net`) manda `Access-Control-Allow-Origin`, então montar o
PNG no browser está descartado. `getAsset()` baixa, confere os bytes e embute data URL.

**Sem webp/avif.** Os CDNs negociam formato pelo `Accept` e o satori só decodifica png,
jpeg, gif e svg — um webp derruba a renderização inteira com `TypeError: ... is not
iterable`. `getAsset()` pede png/jpeg e valida o magic number; formato não suportado vira
`null` e o slot cai no fallback em vez de quebrar a carta.

**O resvg não desenha `<text>` em SVG** sem fonte embutida. Por isso a marca do VUT no slot
de time (usada enquanto a lista do VLR estiver vazia) é só path e retângulo.

**Nenhum número vem do cliente.** `/api/cards` recebe só o Riot ID e refaz o lookup (no
cache) antes de gravar. Entrada manual existe só como fallback de falha, nasce
`tipo='manual'`, ganha o selo **NÃO VERIFICADA** no PNG e fica fora da leitura de percentis.

**De onde vêm os dados: HenrikDev.** O tracker.gg fechou os dois caminhos —
`api.tracker.gg/api/v2/...` responde 403 com a página *"You've Been Blocked"*, que pede
para não raspar o site, e a API pública deles (`public-api.tracker.gg`) **não cobre
Valorant**: o staff diz que serve Apex, CS:GO, Division 2 e Splitgate, e que acesso a
Valorant tem que ser pedido direto à Riot. Então a fonte é a
[API não-oficial do HenrikDev](https://docs.henrikdev.xyz), que lê a API in-game da Riot.

Três chamadas por busca fria, dentro das 30/min da chave básica:

| Chamada | Para quê |
|---|---|
| `/v2/account/{nick}/{tag}` | puuid e região (as outras rotas exigem região) |
| `/v3/mmr/{região}/pc/{nick}/{tag}` | rank atual, pico e partidas do ato corrente |
| `/v4/matches/...?mode=competitive&size=10` | as 10 partidas de onde sai todo o resto |

O balde de fichas é uma janela deslizante de 30/min (não espaçamento fixo), senão uma
busca fria levaria 6s só de fila. O cache de 6h guarda o **perfil já calculado**, não o
payload cru: as 10 partidas somam ~4 MB e nada disso é reutilizável depois da conta.

**Os quatro números são calculados aqui**, partida a partida, porque o HenrikDev entrega
evento cru e não stat agregado:

- **RW%** = rounds ganhos ÷ rounds jogados
- **ACS** = combat score ÷ rounds
- **DDΔ** = (dano causado − dano recebido) ÷ rounds
- **KAST%** = rounds com kill, assistência, sobrevivência ou troca. A troca sai da lista
  de kills: quem me matou morreu em até 5s para um companheiro.

**O percentil agora é relativo ao lobby, não à ranqueada inteira.** O Tracker Score era
percentil contra a base toda; sem ele, a comparação possível é contra os ~90 jogadores
que apareceram nas suas 10 partidas. A amostra é montada em memória e descartada — o
banco nunca recebe stat de terceiro, que é o que separa "o jogador pediu a carta dele" de
"montamos um banco com dados de quem não pediu nada". Todo texto de UI diz "últimas
partidas", não "ranqueada".

**O overall vem do rank** (`score_origem='rank'`), porque o matchmaking faz todo mundo
ficar perto de 50 no próprio lobby — percentil de lobby não distingue Ferro de Radiante.
A tabela `OVERALL_POR_TIER` em `src/lib/overall.ts` mapeia tier → overall base, e o
desempenho no lobby ajusta ±2. **Essa tabela é calibração, não dado medido**: está
ancorada nas cartas de referência (Diamante 2 → 76, dourado na casa dos 660–730) e deve
ser revista se aparecer uma distribuição real de ranks.

**Assets saem do valorant-api.com**, não do CDN do tracker: ícone de rank por número de
tier (o mesmo id que o Henrik devolve) e ícone de agente por uuid.

**Nenhum número é inventado.** `mapearPerfil()` falha explicitamente quando um stat vem
sem `value` ou sem `percentile` — nada de default silencioso. `value: 0` é valor legítimo
(DDΔ zero) e passa. Percentil abaixo da mediana sai como *Bottom X%*, não *Top*.

**Arte da carta.** O dono escolhe o atleta de capa pelo rótulo "clique para mudar
atleta" sobre a carta (`PATCH /api/cards/atleta`, coluna `cards.atleta`). Sem escolha, a
foto é sorteada entre as artes do VUT (`public/VUT_PLAYER_*.png`) de forma determinística
pelo Riot ID — nunca aleatória por visita, senão a arte mudaria entre o preview, o
download e o preview do link. O slot superior direito é sempre a marca do VUT.

Só quem gerou a carta troca o atleta: a rota compara o hash de IP com o gravado na
criação. Por isso o rótulo só aparece no resultado da home, não na página pública.
Para adicionar artes, solte `public/VUT_PLAYER_7.png` e rode o script — a lista do
seletor e o sorteio se ajustam sozinhos. `scripts/preparar-assets.mjs` recorta, redimensiona, desvanece a base do busto, gera as
miniaturas do seletor em `public/atletas/` e transforma o logo em branco sobre
transparente — o satori embute o binário como data URL, então peso de arquivo é peso por
render.

**Chamadas ao tracker:** sempre server-side, fila global de no máximo 1 req/s, cache de 6h
por Riot ID em `tracker_cache` e gate de 10 partidas na temporada.

## Diferenças em relação ao plano

- `cards` ganhou `riot_key`, `agente_role`, `partidas`, `temporada` e o percentil de cada
  stat (`rw_p`, `kast_p`, `acs_p`, `dd_p`) — sem o percentil não dá para mostrar a letra
  S/A/B/C/D nem o "top X%" na página pública.
- `twitter-image` 1200×630 foi acrescentada: o X corta imagem em retrato, e o critério de
  aceite do PR 2 é o preview aparecer no WhatsApp, no Discord **e** no X.
- Rate limit soma o balde em memória com a contagem de cartas por `ip_hash` na última hora,
  porque em serverless o balde vive por instância.
- O logo de time sorteado do VLR saiu: o slot é sempre a marca do VUT. A coluna
  `time_logo` continua na tabela para as cartas de pro (PR 3).
- A arte central não usa mais o `heroUrl` do agente — são as fotos do VUT. O ícone do
  agente mais jogado continua no slot do meio.

## Riot ID

Nick de Valorant aceita **espaço, acento e pontuação** — `Zé Duarte#BRL` é um ID
legítimo. A validação em `src/lib/riot-id.ts` só barra erro óbvio de digitação (nick de
3 a 16 caracteres sem `#`, tag de 3 a 5 sem espaço); quem decide se a conta existe é a
API. Isso é de propósito: validação apertada demais rejeita nome real antes de perguntar.

`parseRiotId` também dá trim separado nas duas partes, porque muita gente copia
`Zé Duarte #BRL` com espaço antes do `#`.

A API do HenrikDev é tolerante e resolve variantes para a mesma conta — testado:

| Digitado | Resolve |
|---|---|
| `Zé Duarte#BRL` | ✅ |
| `zé duarte#brl` | ✅ |
| `Zé Duarte #BRL` | ✅ |
| `ZéDuarte#BRL` | ✅ |
| `Ze Duarte#BRL` | ✅ |

**A carta usa sempre a grafia canônica que a Riot devolve**, não a digitada: quem busca
`ze duarte#brl` recebe a carta de `Zé Duarte#BRL`. Sem isso, cada variante viraria uma
carta diferente no índice `(riot_key, serie)`.

## Erros

Toda falha de busca vira **modal** (`src/components/ModalErro.tsx`), não um painel que
a pessoa pode não ver. O modal traz rótulo, veredito, a mensagem e uma dica explicando o
porquê; fecha no Esc, no botão ou no fundo, devolve o foco ao campo e preserva o Riot ID
digitado — quem errou a tag corrige só a tag. `INVALID_ID` é a exceção: é validação de
campo e fica embaixo do input, sem modal.

| Código | HTTP | Quando | Mensagem |
|---|---|---|---|
| `INVALID_ID` | 400 | Não bate com `nick#TAG` | Riot ID inválido. O formato é nick#TAG… |
| `NOT_FOUND` | 404 | HenrikDev devolve *Account not found* | Não achamos esse Riot ID. Confere a tag depois do #… |
| `SEM_COMPETITIVO` | 422 | Conta existe, zero ranqueada na janela | Essa conta não tem ranqueada recente… |
| `LOW_MATCHES` | 422 | Menos de 10 partidas no ato | Joga mais algumas ranqueadas e volta aqui… |
| `BLOCKED` | 503 | Estourou as 30 req/min da chave | Muita gente gerando carta agora… |
| `RATE_LIMITED` | 429 | 5 cartas/hora por `ip_hash` | Você gerou muitas cartas na última hora… |
| `UNAUTHORIZED` | 503 | Chave ausente ou recusada | Nossa busca de dados está fora do ar… |
| `TIMEOUT` | 504 | Passou de 10s | A busca demorou demais… |
| `UNKNOWN` | 500 | Resto | Algo quebrou na busca… |

**Não existe mais "perfil privado".** Aquilo era regra do tracker.gg, que marca como
privado quem nunca logou lá e liberou o perfil. Lendo a API in-game da Riot pelo
HenrikDev essa trava não se aplica. O código `PRIVATE` sobrou só no caminho antigo do
tracker, que está desativado.

Só `BLOCKED`, `UNAUTHORIZED`, `TIMEOUT` e `UNKNOWN` oferecem "preencher na mão": são as
falhas por culpa nossa. Em `NOT_FOUND`, `SEM_COMPETITIVO` e `LOW_MATCHES` não há carta a
fazer — preencher na mão ali seria inventar número.

## Validação

```bash
node scripts/validar-lookup.mjs            # bate dedada#6625 contra a seção 10 do plano
```

Precisa de `HENRIKDEV_API_KEY` e `MOCK_TRACKER=0`. **O script ainda espera os valores do
tracker.gg**: rank e pico batem, mas os quatro stats não vão bater, porque a janela mudou
de "o ato inteiro" para "as 10 últimas partidas" e o percentil deixou de ser contra a
base toda. Serve hoje para conferir rank, pico e as regras de formatação.

## O que falta (PR 3)

- Plugar PostHog ou GA4: os eventos já disparam via `track()` em `src/lib/analytics.ts`,
  hoje só no `console.debug` fora de produção.
- Seed das ~50 cartas de pro (`tipo='pro'`, `overallPro()` já implementado) e página `/cartas`.
- Revisar a calibração de `OVERALL_POR_TIER` — hoje é um arbitramento ancorado nas
  cartas de referência.
- Pedir acesso à API de Valorant da Riot: é o único caminho para percentil contra a base
  inteira (e o que devolve o sentido original de "à frente de X% das ranqueadas").
