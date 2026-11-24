import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import { cartaJsx, ALTURA, LARGURA } from '@/lib/render/carta'
import { fontes } from '@/lib/render/fonts'
import { getCarta } from '@/lib/store'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']

/**
 * Um renderizador so: preview, download e og:image saem todos daqui.
 * Se fossem implementacoes diferentes elas divergiriam e o PNG baixado
 * nao seria o que o usuario viu.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')
  const versionada = searchParams.has('v')
  const download = searchParams.get('dl') === '1'

  if (!slug) return NextResponse.json({ erro: 'slug obrigatorio' }, { status: 400 })

  const carta = await getCarta(slug)
  if (!carta) return NextResponse.json({ erro: 'carta nao encontrada' }, { status: 404 })

  const headers: Record<string, string> = {
    'cache-control': versionada
      ? 'public, immutable, max-age=31536000'
      : 'public, max-age=300, s-maxage=86400, stale-while-revalidate=604800',
  }
  if (download) {
    headers['content-disposition'] = `attachment; filename="vut-${carta.nick}-${carta.overall}.png"`
  }

  return new ImageResponse(await cartaJsx(carta), {
    width: LARGURA,
    height: ALTURA,
    fonts: await fontes(),
    headers,
  })
}
