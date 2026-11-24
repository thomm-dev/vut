import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SERIE_ATUAL } from '@/lib/card'
import { overallComum } from '@/lib/overall'
import { rankIconUrl } from '@/lib/rank'
import { consumir, ipHash } from '@/lib/rate-limit'
import { parseRiotId, sanitizeText } from '@/lib/riot-id'
import { cartasNaUltimaHora, salvarCarta } from '@/lib/store'
import { tierPorScore } from '@/lib/tier'
import { MENSAGENS } from '@/lib/tracker/errors'
import type { Stat } from '@/lib/types'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

const RANKS = [
  'Iron 1', 'Iron 2', 'Iron 3',
  'Bronze 1', 'Bronze 2', 'Bronze 3',
  'Silver 1', 'Silver 2', 'Silver 3',
  'Gold 1', 'Gold 2', 'Gold 3',
  'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3',
  'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
  'Immortal 1', 'Immortal 2', 'Immortal 3',
  'Radiant',
] as const

const Corpo = z.object({
  riotId: z.string().min(5).max(24),
  trackerScore: z.coerce.number().int().min(0).max(1000),
  rank: z.enum(RANKS).optional(),
  rw: z.coerce.number().min(0).max(100),
  kast: z.coerce.number().min(0).max(100),
  acs: z.coerce.number().min(0).max(600),
  dd: z.coerce.number().min(-200).max(200),
})

const semPercentil = (value: number, display: string): Stat => ({ value, display, percentile: 0 })

/**
 * Fallback manual. A carta nasce marcada como nao confiavel: tipo 'manual',
 * selo NAO VERIFICADA no PNG, e fora de qualquer placar futuro.
 */
export async function POST(req: Request) {
  const hash = ipHash(req)
  const recentes = await cartasNaUltimaHora(hash).catch(() => 0)
  if (!consumir(hash).ok || recentes >= 5) {
    return NextResponse.json(
      { ok: false, code: 'RATE_LIMITED', message: MENSAGENS.RATE_LIMITED },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const p = Corpo.safeParse(body)
  if (!p.success) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_ID', message: 'Confere os campos: tem número fora da faixa.' },
      { status: 400 },
    )
  }

  const riot = parseRiotId(p.data.riotId)
  if (!riot) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_ID', message: MENSAGENS.INVALID_ID },
      { status: 400 },
    )
  }

  const d = p.data
  const tier = tierPorScore(d.trackerScore)

  try {
    const carta = await salvarCarta(
      {
        riotId: riot.display,
        nick: sanitizeText(riot.nick, 16),
        tag: sanitizeText(riot.tag, 5),
        pais: null,
        tipo: 'manual',
        rankNome: d.rank ?? null,
        rankIcon: d.rank ? rankIconUrl(d.rank) : null,
        peakNome: null,
        peakIcon: null,
        timeLogo: null,
        trackerScore: d.trackerScore,
        scoreOrigem: null,
        agente: null,
        agenteIcon: null,
        agenteHero: null,
        agenteRole: null,
        atleta: null,
        overall: overallComum(d.trackerScore),
        percentil: 0,
        tier: tier.key,
        cor: tier.cor,
        stats: {
          rw: semPercentil(d.rw, `${d.rw.toFixed(1)}%`),
          kast: semPercentil(d.kast, `${d.kast.toFixed(1)}%`),
          acs: semPercentil(d.acs, d.acs.toFixed(1)),
          dd: semPercentil(d.dd, String(Math.round(d.dd))),
        },
        partidas: 0,
        temporada: null,
        serie: SERIE_ATUAL,
      },
      hash,
    )
    return NextResponse.json({ ok: true, slug: carta.slug, carta })
  } catch (e) {
    console.error('[vut] falha ao gravar carta manual', e)
    return NextResponse.json({ ok: false, code: 'UNKNOWN', message: MENSAGENS.UNKNOWN }, { status: 500 })
  }
}
