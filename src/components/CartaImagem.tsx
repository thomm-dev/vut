'use client'

import { useEffect, useState } from 'react'
import Tilt from 'react-parallax-tilt'
import { EsqueletoCarta } from './EsqueletoCarta'

/**
 * A carta na tela e o mesmo PNG que o usuario baixa e que vai no og:image.
 * Um renderizador so — nada aqui redesenha a carta.
 */
export function CartaImagem({
  src,
  alt,
  prioridade = false,
  className = '',
  acao,
}: {
  src: string
  alt: string
  prioridade?: boolean
  className?: string
  /** Rotulo clicavel sobreposto a arte (ex.: trocar o atleta de capa). */
  acao?: { label: string; onClick: () => void }
}) {
  const [carregada, setCarregada] = useState(false)
  const [temHover, setTemHover] = useState(false)

  // Tilt desligado no touch.
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const atualiza = () => setTemHover(mq.matches)
    atualiza()
    mq.addEventListener('change', atualiza)
    return () => mq.removeEventListener('change', atualiza)
  }, [])

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={600}
      height={840}
      fetchPriority={prioridade ? 'high' : 'auto'}
      onLoad={() => setCarregada(true)}
      className={`block h-auto w-full transition-opacity duration-300 ${
        carregada ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ aspectRatio: '600 / 840' }}
    />
  )

  const conteudo = temHover ? (
    <Tilt
      tiltMaxAngleX={9}
      tiltMaxAngleY={9}
      perspective={1200}
      scale={1.02}
      transitionSpeed={900}
      glareEnable
      glareMaxOpacity={0.14}
      glareBorderRadius="0"
      className="w-full"
    >
      {img}
    </Tilt>
  ) : (
    img
  )

  return (
    <div className={`relative w-full min-w-0 overflow-hidden ${className}`}>
      {!carregada && (
        <div className="absolute inset-0">
          <EsqueletoCarta />
        </div>
      )}
      <div className={carregada ? 'revela-carta' : ''}>{conteudo}</div>

      {acao && carregada && (
        <button
          type="button"
          onClick={acao.onClick}
          className="surge absolute top-[50%] left-1/2 z-10 -translate-x-1/2 rounded-[2px] border border-[var(--line2)] bg-black/70 px-2 py-1.5 font-mono text-[11px] whitespace-nowrap tracking-[0.06em] text-[var(--txt)] uppercase backdrop-blur-[2px] transition-colors hover:border-[var(--dim)] hover:bg-black/85 sm:px-2.5 sm:text-[10px] sm:tracking-[0.1em]"
        >
          {acao.label}
        </button>
      )}
    </div>
  )
}
