/** Recortes da resposta do HenrikDev — só o que a carta usa. */

export type Conta = {
  puuid: string
  region: string
  name: string
  tag: string
  account_level?: number
  card?: string
  platforms?: string[]
}

export type Tier = { id: number; name: string }

export type Mmr = {
  account?: { puuid?: string }
  current?: {
    tier?: Tier | null
    rr?: number
    elo?: number | null
    leaderboard_placement?: number | null
  }
  peak?: { tier?: Tier | null; season?: { short?: string } }
  seasonal?: {
    season?: { id?: string; short?: string }
    wins?: number
    games?: number
    end_tier?: Tier | null
  }[]
  latest_update?: { season?: { id?: string; short?: string } }
}

export type Jogador = {
  puuid: string
  name?: string
  tag?: string
  team_id?: string
  agent?: { id?: string; name?: string }
  tier?: Tier | null
  stats?: {
    score?: number
    kills?: number
    deaths?: number
    assists?: number
    headshots?: number
    bodyshots?: number
    legshots?: number
    damage?: { dealt?: number; received?: number }
  }
}

export type Kill = {
  round: number
  time_in_round_in_ms: number
  killer?: { puuid?: string }
  victim?: { puuid?: string }
  assistants?: { puuid?: string }[]
}

export type Partida = {
  metadata?: {
    match_id?: string
    started_at?: string
    season?: { id?: string; short?: string }
    queue?: { id?: string; name?: string }
  }
  players: Jogador[]
  teams: { team_id?: string; rounds?: { won?: number; lost?: number }; won?: boolean }[]
  rounds: unknown[]
  kills: Kill[]
}
