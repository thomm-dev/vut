import { ImageResponse } from 'next/og'
import { cartaJsx } from '@/lib/render/carta'
import { fontes } from '@/lib/render/fonts'
import { pad } from '@/lib/site'
import { getCarta } from '@/lib/store'
import { TIERS } from '@/lib/tier'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const alt = 'Carta VUT'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * O X/Twitter corta imagem em retrato no summary_large_image. Aqui a mesma
 * carta (mesmo renderizador) entra deitada, com a leitura ao lado.
 */
export default async function TwitterImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const carta = await getCarta(slug)
  const f = await fontes()

  if (!carta) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0a0a0b',
            color: '#e9eaec',
            fontFamily: 'Inter',
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          VUT
        </div>
      ),
      { ...size, fonts: f },
    )
  }

  const tier = TIERS.find((t) => t.key === carta.tier)
  const linha = (label: string, valor: string) => (
    <div
      style={{
        display: 'flex',
        width: 420,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#1c1e22',
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 800, color: '#e9eaec' }}>{valor}</span>
    </div>
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#0a0a0b',
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 600,
            height: 630,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', transform: 'scale(0.66)' }}>{await cartaJsx(carta)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: 560, paddingRight: 40 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#6b7280', letterSpacing: 4 }}>
            VUT · SÉRIE {carta.serie} #{pad(carta.serialNum)}
          </span>
          <span style={{ fontSize: 68, fontWeight: 800, color: '#ffffff', marginTop: 8 }}>
            {carta.nick}
          </span>
          <span style={{ fontSize: 30, fontWeight: 800, color: carta.cor, marginTop: 4 }}>
            {carta.overall} OVERALL · {tier?.label.toUpperCase() ?? carta.tier}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 22 }}>
            {linha('RW', carta.stats.rw.display)}
            {linha('KAST', carta.stats.kast.display)}
            {linha('ACS', carta.stats.acs.display)}
            {linha('DDΔ', carta.stats.dd.display)}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: f },
  )
}
