'use client'

import { useEffect, useRef, useState } from 'react'
import { Rotulo } from './ui'

/**
 * Escolha do atleta de capa. As miniaturas são a mesma arte que entra na carta
 * (geradas por scripts/preparar-assets.mjs), então o que se vê aqui é o que sai.
 */
export function SeletorAtleta({
  total,
  atual,
  salvando,
  erro,
  onEscolher,
  onFechar,
}: {
  total: number
  atual: number | null
  salvando: boolean
  erro: string | null
  onEscolher: (atleta: number) => void
  onFechar: () => void
}) {
  const fechar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fechar.current?.focus()
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = anterior
    }
  }, [onFechar])

  const opcoes = Array.from({ length: total }, (_, i) => i + 1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="atleta-titulo"
    >
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        className="veu absolute inset-0 cursor-default bg-black/75"
        onClick={onFechar}
      />

      <div className="folha painel relative flex max-h-[88vh] w-full max-w-[420px] flex-col p-5 pb-6 sm:mx-4 sm:pb-5">
        <Rotulo>escolher atleta</Rotulo>
        <h2 id="atleta-titulo" className="mt-3 text-[19px] leading-tight font-bold">
          Quem entra na sua carta
        </h2>
        <p className="mt-2 text-[14px] leading-snug text-[var(--dim)]">
          A arte de capa é só sua — os números continuam os mesmos.
        </p>

        <div className="-mx-1 mt-4 grid grid-cols-3 gap-2 overflow-y-auto px-1">
          {opcoes.map((n) => {
            const selecionado = atual === n
            return (
              <button
                key={n}
                type="button"
                disabled={salvando}
                onClick={() => onEscolher(n)}
                aria-pressed={selecionado}
                aria-label={`Atleta ${n}`}
                className={`relative overflow-hidden rounded-[2px] border bg-[#08090a] transition-colors disabled:opacity-50 ${
                  selecionado
                    ? 'border-[var(--txt)]'
                    : 'border-[var(--line2)] hover:border-[var(--dim)]'
                }`}
                style={{ aspectRatio: '3 / 4' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/atletas/${n}.webp`}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
                {selecionado && (
                  <span className="absolute inset-x-0 bottom-0 bg-[var(--txt)] py-1 text-center font-mono text-[9px] font-bold tracking-[0.1em] text-black uppercase">
                    na carta
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {erro && <p className="mt-3 font-mono text-[11px] text-[var(--erro)]">{erro}</p>}

        <button
          ref={fechar}
          type="button"
          className="btn btn-secundario mt-4 w-full"
          onClick={onFechar}
        >
          {salvando ? 'Trocando' : 'Fechar'}
        </button>
      </div>
    </div>
  )
}
