export type TierKey = 'BRONZE' | 'OURO' | 'ESMERALDA' | 'DIAMANTE' | 'RADIANTE'
export type CardTipo = 'tracker' | 'manual' | 'pro'
export type ScoreOrigem = 'html' | 'estimado' | 'rank'

/** Um stat do tracker: { value, displayValue, percentile }. */
export type Stat = {
  value: number
  display: string
  percentile: number
}

export type CardStats = {
  rw: Stat
  kast: Stat
  acs: Stat
  dd: Stat
  hs?: Stat
}

/** Tudo que a carta precisa para ser desenhada. Uma fonte de verdade. */
export type CardData = {
  slug: string
  riotId: string
  nick: string
  tag: string
  pais: string | null
  tipo: CardTipo
  rankNome: string | null
  rankIcon: string | null
  peakNome: string | null
  peakIcon: string | null
  timeLogo: string | null
  trackerScore: number | null
  scoreOrigem: ScoreOrigem | null
  agente: string | null
  agenteIcon: string | null
  agenteHero: string | null
  agenteRole: string | null
  /** Atleta de capa escolhido (1..N). null = sorteado pelo Riot ID. */
  atleta: number | null
  overall: number
  percentil: number
  tier: TierKey
  cor: string
  stats: CardStats
  partidas: number
  temporada: string | null
  serie: number
  serialNum: number
  createdAt: string
}

export type LookupOk = { ok: true; card: CardData }
export type LookupErr = {
  ok: false
  code:
    | 'INVALID_ID'
    | 'NOT_FOUND'
    | 'SEM_COMPETITIVO'
    | 'PRIVATE'
    | 'BLOCKED'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'LOW_MATCHES'
    | 'MOCK'
    | 'RATE_LIMITED'
    | 'UNKNOWN'
  message: string
  partidas?: number
}
export type LookupResponse = LookupOk | LookupErr
