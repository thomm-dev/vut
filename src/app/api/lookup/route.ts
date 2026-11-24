import { NextResponse } from 'next/server'
import { executarLookup } from '@/lib/lookup'
import { STATUS } from '@/lib/tracker/errors'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = null
  }
  const riotId = (body as { riotId?: unknown } | null)?.riotId

  const r = await executarLookup(riotId)
  if (!r.ok) {
    return NextResponse.json(r.erro, { status: STATUS[r.erro.code] ?? 500 })
  }

  return NextResponse.json({ ok: true, carta: r.carta })
}
