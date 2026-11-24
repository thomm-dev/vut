'use client'

import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics'
import { urlCarta, versaoCarta } from '@/lib/site'
import type { CardData } from '@/lib/types'

function Icone({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const I_DOWNLOAD = 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16'
const I_LINK = 'M9 15 15 9M10.5 6.5 12 5a4.95 4.95 0 1 1 7 7l-1.5 1.5M13.5 17.5 12 19a4.95 4.95 0 1 1-7-7l1.5-1.5'
const I_SHARE = 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3m0 0 4 4m-4-4L8 7'
const I_WPP = 'M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 20.5l1.7-5.5A8.4 8.4 0 1 1 21 11.5Z'

export function AcoesCarta({
  carta,
  whatsapp,
  contexto,
}: {
  carta: CardData
  whatsapp: string
  contexto: 'home' | 'publica'
}) {
  const [copiado, setCopiado] = useState(false)
  const [podeCompartilhar, setPodeCompartilhar] = useState(false)
  const [origem, setOrigem] = useState('')

  useEffect(() => {
    setOrigem(window.location.origin)
    setPodeCompartilhar(typeof navigator !== 'undefined' && !!navigator.share)
  }, [])

  const link = `${origem}/c/${carta.slug}`
  const png = urlCarta(carta.slug, versaoCarta(carta), true)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const el = document.createElement('textarea')
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setCopiado(true)
    track('card_link_copied', { slug: carta.slug, contexto })
    setTimeout(() => setCopiado(false), 2000)
  }

  async function compartilhar() {
    try {
      await navigator.share({
        title: `${carta.nick} · ${carta.overall} OVR`,
        text: `Minha carta no VUT: ${carta.overall} de overall.`,
        url: link,
      })
      track('card_link_copied', { slug: carta.slug, contexto, via: 'share' })
    } catch {
      /* usuario cancelou */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {contexto === 'publica' && (
        <a href="/" className="btn btn-primario w-full" onClick={() => track('cta_create_own_clicked', { slug: carta.slug })}>
          Criar minha carta
        </a>
      )}

      <div className="grid grid-cols-2 gap-2">
        <a
          href={png}
          download={`vut-${carta.nick}-${carta.overall}.png`}
          className={`btn ${contexto === 'home' ? 'btn-primario' : 'btn-secundario'}`}
          onClick={() => track('card_png_downloaded', { slug: carta.slug, contexto })}
        >
          <Icone d={I_DOWNLOAD} />
          PNG
        </a>

        {podeCompartilhar ? (
          <button type="button" className="btn btn-secundario" onClick={compartilhar}>
            <Icone d={I_SHARE} />
            Compartilhar
          </button>
        ) : (
          <button type="button" className="btn btn-secundario" onClick={copiar}>
            <Icone d={I_LINK} />
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
        )}
      </div>

      {podeCompartilhar && (
        <button type="button" className="btn btn-secundario w-full" onClick={copiar}>
          <Icone d={I_LINK} />
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
      )}

      {whatsapp ? (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secundario w-full"
          onClick={() => track('whatsapp_group_clicked', { slug: carta.slug, contexto })}
        >
          <Icone d={I_WPP} />
          Entrar no ULTIATE TEAM
        </a>
      ) : null}

      <p className="px-1 pt-1 font-mono text-[10px] leading-relaxed tracking-[0.06em] text-[var(--dim)]">
        {link || '—'}
      </p>
    </div>
  )
}
