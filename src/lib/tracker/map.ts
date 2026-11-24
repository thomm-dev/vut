import type { CardStats, Stat } from '../types'
import { TrackerError } from './errors'

export type PerfilTracker = {
  riotId: string
  pais: string | null
  avatar: string | null
  rankNome: string | null
  rankIcon: string | null
  peakNome: string | null
  peakIcon: string | null
  partidas: number
  agente: string | null
  agenteIcon: string | null
  agenteHero: string | null
  agenteRole: string | null
  temporada: string | null
  stats: CardStats
}

type Raw = Record<string, any>

type Formato = (v: number) => string

const PCT: Formato = (v) => `${v.toFixed(1)}%`
const UMA_CASA: Formato = (v) => v.toFixed(1)
const INTEIRO: Formato = (v) => String(Math.round(v))

/**
 * Nada de valor default: se o campo nao veio, falha explicitamente.
 * `value` 0 e legitimo (DD delta zero) — so `null`/`undefined` e ausencia.
 */
function stat(s: Raw | undefined, nome: string, fmt: Formato): Stat {
  const valor = s?.value
  const pct = s?.percentile
  if (valor === null || valor === undefined || pct === null || pct === undefined) {
    console.error(`[vut] stat ausente na resposta do tracker: ${nome}`, {
      temValor: valor !== null && valor !== undefined,
      temPercentil: pct !== null && pct !== undefined,
    })
    throw new TrackerError('UNKNOWN', `stat ausente: ${nome}`)
  }
  const v = Number(valor)
  return {
    value: v,
    // displayValue vem formatado pelo tracker; so formatamos se ele faltar
    display: typeof s?.displayValue === 'string' && s.displayValue ? s.displayValue : fmt(v),
    percentile: Math.round(Number(pct)),
  }
}

function statOpcional(s: Raw | undefined, fmt: Formato): Stat | undefined {
  if (s?.value === null || s?.value === undefined) return undefined
  const v = Number(s.value)
  return {
    value: v,
    display: typeof s.displayValue === 'string' && s.displayValue ? s.displayValue : fmt(v),
    percentile: Math.round(Number(s.percentile ?? 0)),
  }
}

/** O segmento que interessa e a temporada de competitivo. */
export function segmentoTemporada(d: Raw): Raw | undefined {
  const segments: Raw[] = Array.isArray(d?.segments) ? d.segments : []
  return (
    segments.find((x) => x.type === 'season' && x.attributes?.playlist === 'competitive') ??
    segments.find((x) => x.type === 'season')
  )
}

/** Caminhos validados da secao 3 do PLANO-LOOKUP-TRACKER. d = resposta.data */
export function mapearPerfil(raw: Raw, riotIdFallback: string): PerfilTracker {
  const d: Raw = raw?.data ?? raw
  const segments: Raw[] = Array.isArray(d?.segments) ? d.segments : []
  const s = segmentoTemporada(d)
  if (!s) throw new TrackerError('PRIVATE', 'sem segmento de temporada')
  const st: Raw = s.stats ?? {}

  // Agente mais jogado: o primeiro ordenado por partidas — mesmo criterio do TOP AGENTS.
  const top = segments
    .filter((x) => x.type === 'agent')
    .sort(
      (a, b) =>
        Number(b.stats?.matchesPlayed?.value ?? 0) - Number(a.stats?.matchesPlayed?.value ?? 0),
    )[0]

  const cc = d?.userInfo?.countryCode

  return {
    riotId: String(d?.platformInfo?.platformUserHandle ?? riotIdFallback),
    pais: cc ? String(cc).toLowerCase() : null,
    avatar: d?.platformInfo?.avatarUrl ?? null,
    rankNome: st?.rank?.metadata?.tierName ?? null,
    rankIcon: st?.rank?.metadata?.iconUrl ?? null,
    peakNome: st?.peakRank?.metadata?.tierName ?? null,
    peakIcon: st?.peakRank?.metadata?.iconUrl ?? null,
    partidas: Math.round(Number(st?.matchesPlayed?.value ?? 0)),
    agente: top?.metadata?.name ?? null,
    agenteIcon: top?.metadata?.imageUrl ?? null,
    agenteHero: top?.metadata?.heroUrl ?? top?.metadata?.portraitUrl ?? null,
    agenteRole: top?.metadata?.role ?? null,
    temporada: s.attributes?.seasonId ?? null,
    stats: {
      rw: stat(st?.roundsWinPct, 'roundsWinPct', PCT),
      kast: stat(st?.kAST, 'kAST', PCT),
      acs: stat(st?.scorePerRound, 'scorePerRound', UMA_CASA),
      dd: stat(st?.damageDeltaPerRound, 'damageDeltaPerRound', INTEIRO),
      hs: statOpcional(st?.headshotsPercentage, PCT),
    },
  }
}

/** Perfil privado: a API responde 200 mas sem nenhum segmento de temporada. */
export function pareceProfilePrivado(raw: Raw) {
  const d: Raw = raw?.data ?? raw
  const segs: Raw[] = Array.isArray(d?.segments) ? d.segments : []
  return segs.length === 0 || d?.metadata?.privacy === 'private' || !segmentoTemporada(d)
}
