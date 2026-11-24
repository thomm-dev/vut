import { ImageResponse } from 'next/og'
import { ALTURA, cartaJsx, LARGURA } from '@/lib/render/carta'
import { fontes } from '@/lib/render/fonts'
import { getCarta } from '@/lib/store'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const alt = 'Carta VUT'
export const size = { width: LARGURA, height: ALTURA }
export const contentType = 'image/png'

/** og:image = a propria carta, pelo mesmo renderizador de /api/card. */
export default async function Og({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const carta = await getCarta(slug)
  const f = await fontes()

  if (!carta) {
    return new ImageResponse(
      (
        <div
          style={{
            width: LARGURA,
            height: ALTURA,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0b',
            color: '#e9eaec',
            fontFamily: 'Inter',
            fontSize: 40,
            fontWeight: 800,
          }}
        >
          VUT
        </div>
      ),
      { ...size, fonts: f },
    )
  }

  return new ImageResponse(await cartaJsx(carta), { ...size, fonts: f })
}
