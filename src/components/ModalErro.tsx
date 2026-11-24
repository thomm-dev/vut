'use client'

import { useEffect, useRef } from 'react'
import { Rotulo } from './ui'

export type ErroLookup = {
  code: string
  message: string
  partidas?: number
}

type Conteudo = { rotulo: string; titulo: string; dica?: string }

/**
 * Cada caso ganha título e uma dica que explica o porquê — a mensagem sozinha
 * responde "o que houve", a dica responde "e agora".
 */
const CONTEUDO: Record<string, Conteudo> = {
  NOT_FOUND: {
    rotulo: 'não encontrado',
    titulo: 'Confere o Riot ID',
    dica: 'No jogo, seu Riot ID inteiro aparece no topo do menu principal. A tag depois do # muda quando você troca de nome, e não é a mesma que fica na URL do tracker.',
  },
  SEM_COMPETITIVO: {
    rotulo: 'sem ranqueada',
    titulo: 'Sem ranqueada pra ler',
    dica: 'A carta sai dos números das suas últimas ranqueadas. Sem partida recente não tem de onde tirar — e a gente não inventa número.',
  },
  LOW_MATCHES: {
    rotulo: 'ainda não dá',
    titulo: 'Falta ranqueada nessa temporada',
    dica: 'Abaixo de 10 partidas no ato os números ainda oscilam demais pra virar carta.',
  },
  BLOCKED: {
    rotulo: 'fila cheia',
    titulo: 'Aguenta aí um instante',
    dica: 'Nossa busca tem limite de consultas por minuto. Em alguns segundos libera.',
  },
  RATE_LIMITED: {
    rotulo: 'limite por hora',
    titulo: 'Você já gerou muitas cartas',
    dica: 'São 5 cartas por hora. A sua carta anterior continua valendo no link que você já tem.',
  },
  TIMEOUT: { rotulo: 'demorou demais', titulo: 'A busca estourou o tempo' },
  UNAUTHORIZED: { rotulo: 'fora do ar', titulo: 'Nossa busca de dados caiu' },
  PRIVATE: { rotulo: 'perfil privado', titulo: 'Esse perfil está privado' },
  // So aparece em dev — em producao o mock e ignorado.
  MOCK: {
    rotulo: 'modo mock',
    titulo: 'O servidor está em modo mock',
    dica: 'MOCK_TRACKER=1 no .env.local faz o servidor responder só com fixtures. Desligue para buscar de verdade.',
  },
  UNKNOWN: { rotulo: 'erro', titulo: 'Algo quebrou na busca' },
}

/** Casos em que preencher na mão faz sentido: a busca falhou por culpa nossa. */
const PERMITE_MANUAL = ['BLOCKED', 'UNAUTHORIZED', 'TIMEOUT', 'PRIVATE', 'UNKNOWN']

export function ModalErro({
  erro,
  onFechar,
  onManual,
}: {
  erro: ErroLookup
  onFechar: () => void
  onManual: () => void
}) {
  const primeiroBotao = useRef<HTMLButtonElement>(null)
  const c = CONTEUDO[erro.code] ?? CONTEUDO.UNKNOWN

  useEffect(() => {
    primeiroBotao.current?.focus()

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar()
    }
    document.addEventListener('keydown', aoTeclar)

    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = overflowAnterior
    }
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="erro-titulo"
      aria-describedby="erro-mensagem"
    >
      <button
        type="button"
        aria-label="Fechar"
        tabIndex={-1}
        className="veu absolute inset-0 cursor-default bg-black/75"
        onClick={onFechar}
      />

      <div className="folha painel relative w-full max-w-[420px] p-5 pb-6 sm:mx-4 sm:pb-5">
        <Rotulo tom={['LOW_MATCHES', 'SEM_COMPETITIVO'].includes(erro.code) ? 'warn' : 'erro'}>
          {c.rotulo}
        </Rotulo>

        <h2 id="erro-titulo" className="mt-3 text-[19px] leading-tight font-bold">
          {c.titulo}
        </h2>

        <p id="erro-mensagem" className="mt-2 text-[15px] leading-snug">
          {erro.message}
        </p>

        {erro.partidas !== undefined && (
          <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-[var(--dim)]">
            {erro.partidas} de 10 partidas na temporada.
          </p>
        )}

        {c.dica && (
          <p className="mt-3 border-t border-[var(--line)] pt-3 font-mono text-[11px] leading-relaxed text-[var(--dim)]">
            {c.dica}
          </p>
        )}

        <div className="mt-5 grid gap-2">
          <button
            ref={primeiroBotao}
            type="button"
            className="btn btn-primario w-full"
            onClick={onFechar}
          >
            {erro.code === 'NOT_FOUND' ? 'Corrigir o Riot ID' : 'Tentar de novo'}
          </button>

          {PERMITE_MANUAL.includes(erro.code) && (
            <button type="button" className="btn btn-secundario w-full" onClick={onManual}>
              Preencher na mão
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
