import { NextResponse } from 'next/server'
import { z } from 'zod'
import { totalAtletas } from '@/lib/render/locais'
import { ipHash } from '@/lib/rate-limit'
import { trocarAtleta } from '@/lib/store'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

const Corpo = z.object({
  slug: z.string().min(4).max(32),
  atleta: z.number().int().min(1).max(99).nullable(),
})

/** Lista de atletas disponíveis, para o seletor montar as opções. */
export async function GET() {
  return NextResponse.json(
    { ok: true, total: await totalAtletas() },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  )
}

/**
 * Troca o atleta de capa da carta. Só o dono (mesmo hash de IP da criação)
 * consegue — a carta é pública por slug, a edição não.
 */
export async function PATCH(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }

  const p = Corpo.safeParse(body)
  if (!p.success) {
    return NextResponse.json({ ok: false, message: 'Pedido inválido.' }, { status: 400 })
  }

  const total = await totalAtletas()
  if (p.data.atleta !== null && p.data.atleta > total) {
    return NextResponse.json({ ok: false, message: 'Esse atleta não existe.' }, { status: 400 })
  }

  try {
    const carta = await trocarAtleta(p.data.slug, p.data.atleta, ipHash(req))
    if (!carta) {
      return NextResponse.json(
        { ok: false, message: 'Essa carta não é sua ou não existe mais.' },
        { status: 403 },
      )
    }
    return NextResponse.json({ ok: true, carta })
  } catch (e) {
    console.error('[vut] falha ao trocar atleta', e)
    return NextResponse.json({ ok: false, message: 'Não deu para trocar agora.' }, { status: 500 })
  }
}
