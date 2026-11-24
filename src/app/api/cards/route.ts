import { NextResponse } from 'next/server'
import { executarLookup } from '@/lib/lookup'
import { consumir, ipHash } from '@/lib/rate-limit'
import { cartasNaUltimaHora, salvarCarta } from '@/lib/store'
import { MENSAGENS, STATUS } from '@/lib/tracker/errors'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

/**
 * Grava e devolve { slug }. Recebe so o Riot ID: os numeros sao refeitos aqui
 * (vindos do cache do lookup), nunca aceitos do cliente.
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

  const r = await executarLookup((body as { riotId?: unknown } | null)?.riotId)
  if (!r.ok) {
    return NextResponse.json(r.erro, { status: STATUS[r.erro.code] ?? 500 })
  }

  try {
    const carta = await salvarCarta(r.carta, hash)
    return NextResponse.json({ ok: true, slug: carta.slug, carta })
  } catch (e) {
    console.error('[vut] falha ao gravar carta', e)
    return NextResponse.json(
      { ok: false, code: 'UNKNOWN', message: MENSAGENS.UNKNOWN },
      { status: 500 },
    )
  }
}
