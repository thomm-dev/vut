import type { Metadata, Viewport } from 'next'
import { DESCRICAO, NOME, SITE } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: `${NOME} · gerador de cartas de Valorant`,
    template: `%s · ${NOME}`,
  },
  description: DESCRICAO,
  applicationName: NOME,
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: NOME,
    title: `${NOME} · gerador de cartas de Valorant`,
    description: DESCRICAO,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
