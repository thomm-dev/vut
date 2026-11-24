import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AcoesCarta } from '@/components/AcoesCarta'
import { CartaImagem } from '@/components/CartaImagem'
import { LinhasStats } from '@/components/LinhasStats'
import { PageView } from '@/components/PageView'
import { Marca, Painel, Rotulo } from '@/components/ui'
import { rankPt } from '@/lib/rank'
import { pad, SITE, urlCarta, versaoCarta, WHATSAPP } from '@/lib/site'
import { getCarta } from '@/lib/store'
import { rotuloPercentil, TIERS } from '@/lib/tier'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const c = await getCarta(slug)
  if (!c) return { title: 'Carta não encontrada' }

  const titulo = `${c.nick} · ${c.overall} OVR · VUT`
  const descricao =
    c.tipo === 'manual'
      ? `Carta não verificada — Série ${c.serie} #${pad(c.serialNum)}`
      : `${rotuloPercentil(c.percentil)} nas últimas partidas — Série ${c.serie} #${pad(c.serialNum)}`

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      title: titulo,
      description: descricao,
      url: `${SITE}/c/${slug}`,
      images: [{ url: `${SITE}/c/${slug}/opengraph-image`, width: 600, height: 840, alt: titulo }],
    },
    twitter: {
      // O X corta retrato: la vai a variante deitada de 1200x630.
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: [{ url: `${SITE}/c/${slug}/twitter-image`, width: 1200, height: 630, alt: titulo }],
    },
  }
}

export default async function PaginaCarta({ params }: Props) {
  const { slug } = await params
  const carta = await getCarta(slug)
  if (!carta) notFound()

  const tier = TIERS.find((t) => t.key === carta.tier)

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-4 sm:pt-8">
      <PageView slug={slug} />

      <header className="flex items-center justify-between pb-4">
        <a href="/" aria-label="VUT">
          <Marca />
        </a>
        <Rotulo tom={carta.tipo === 'manual' ? 'warn' : 'ok'}>
          {carta.tipo === 'manual' ? 'não verificada' : 'verificada no tracker'}
        </Rotulo>
      </header>

      <div className="mx-auto w-full max-w-[380px] min-w-0">
        <CartaImagem
          src={urlCarta(carta.slug, versaoCarta(carta))}
          alt={`Carta de ${carta.nick}, overall ${carta.overall}`}
          prioridade
        />
      </div>

      <Painel className="mt-3 p-4">
        <h1 className="text-[18px] leading-none font-bold">
          {carta.nick}
          <span className="ml-2 font-mono text-[13px] font-normal text-[var(--dim)]">
            #{carta.tag}
          </span>
        </h1>
        <p className="mt-2.5 text-[14px] leading-snug">
          <span className="font-bold" style={{ color: carta.cor }}>
            {carta.overall} overall · {tier?.label ?? carta.tier}
          </span>
          {carta.tipo !== 'manual' && (
            <> — à frente de {Math.round(carta.percentil)}% dos jogadores das partidas dele.</>
          )}
        </p>
        <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-[var(--dim)] uppercase">
          {rankPt(carta.rankNome)}
          {carta.peakNome ? ` · pico ${rankPt(carta.peakNome)}` : ''}
          {carta.agente ? ` · ${carta.agente}` : ''} · série {carta.serie} #{pad(carta.serialNum)}
        </p>
      </Painel>

      {carta.tipo !== 'manual' && (
        <Painel className="mt-3">
          <div className="px-3 pt-3 sm:px-4">
            <Rotulo>Comparado com as últimas partidas</Rotulo>
          </div>
          <div className="mt-2">
            <LinhasStats carta={carta} animar={false} />
          </div>
        </Painel>
      )}

      <div className="mt-3">
        <AcoesCarta carta={carta} whatsapp={WHATSAPP} contexto="publica" />
      </div>

      <p className="mt-6 text-center font-mono text-[10px] leading-relaxed tracking-[0.1em] text-[var(--dim)] uppercase">
        a sua sai em 5 segundos — só o Riot ID
      </p>
    </main>
  )
}
