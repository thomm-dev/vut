'use client'

import { letraDoPercentil, rotuloPercentil } from '@/lib/tier'
import type { CardData } from '@/lib/types'

const NOMES: Record<string, { sigla: string; nome: string }> = {
  rw: { sigla: 'RW', nome: 'rounds ganhos' },
  kast: { sigla: 'KAST', nome: 'rounds com impacto' },
  acs: { sigla: 'ACS', nome: 'pontuação por round' },
  dd: { sigla: 'DDΔ', nome: 'dano por round' },
}

/** A letra S/A/B/C/D fica aqui, na tela de resultado — nunca na carta. */
export function LinhasStats({ carta, animar = true }: { carta: CardData; animar?: boolean }) {
  const linhas = (['rw', 'kast', 'acs', 'dd'] as const).map((k) => ({
    k,
    ...NOMES[k],
    stat: carta.stats[k],
  }))

  return (
    <ul className="divide-y divide-[var(--line)]">
      {linhas.map((l, i) => {
        const letra = letraDoPercentil(l.stat.percentile)
        return (
          <li
            key={l.k}
            className={`flex items-center gap-3 px-3 py-3 sm:px-4 ${animar ? 'surge' : ''}`}
            style={animar ? { animationDelay: `${i * 80}ms` } : undefined}
          >
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[12px] font-bold tracking-[0.1em]">{l.sigla}</div>
              <div className="mt-0.5 truncate font-mono text-[10px] tracking-[0.08em] text-[var(--dim)] uppercase">
                {l.nome}
              </div>
            </div>

            <div className="font-mono text-[16px] font-bold tabular-nums">{l.stat.display}</div>

            <div
              className="grid h-6 w-6 flex-none place-items-center border font-mono text-[11px] font-bold"
              style={{ color: letra.cor, borderColor: letra.cor }}
              title={`percentil ${l.stat.percentile} entre os jogadores das últimas partidas`}
            >
              {letra.letra}
            </div>

            <div className="w-[76px] flex-none text-right font-mono text-[10px] tracking-[0.06em] text-[var(--dim)]">
              {rotuloPercentil(l.stat.percentile)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
