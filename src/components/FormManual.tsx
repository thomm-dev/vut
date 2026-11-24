'use client'

import { useState } from 'react'
import type { CardData } from '@/lib/types'
import { Painel, Rotulo } from './ui'

const RANKS = [
  'Iron 1', 'Iron 2', 'Iron 3',
  'Bronze 1', 'Bronze 2', 'Bronze 3',
  'Silver 1', 'Silver 2', 'Silver 3',
  'Gold 1', 'Gold 2', 'Gold 3',
  'Platinum 1', 'Platinum 2', 'Platinum 3',
  'Diamond 1', 'Diamond 2', 'Diamond 3',
  'Ascendant 1', 'Ascendant 2', 'Ascendant 3',
  'Immortal 1', 'Immortal 2', 'Immortal 3',
  'Radiant',
]

type Campos = {
  riotId: string
  trackerScore: string
  rank: string
  rw: string
  kast: string
  acs: string
  dd: string
}

function CampoNum({
  rotulo,
  dica,
  valor,
  onChange,
  ...rest
}: {
  rotulo: string
  dica?: string
  valor: string
  onChange: (v: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return (
    <label className="block">
      <span className="rotulo">{rotulo}</span>
      <input
        className="campo mt-2 h-[48px]"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        autoComplete="off"
        {...rest}
      />
      {dica ? <span className="mt-1 block font-mono text-[10px] text-[var(--dim)]">{dica}</span> : null}
    </label>
  )
}

/**
 * Entrada manual so existe como fallback quando a busca falha, e a carta
 * resultante nasce marcada como nao confiavel.
 */
export function FormManual({
  riotId,
  onPronta,
  onCancelar,
}: {
  riotId: string
  onPronta: (c: CardData) => void
  onCancelar: () => void
}) {
  const [c, setC] = useState<Campos>({
    riotId,
    trackerScore: '',
    rank: 'Gold 1',
    rw: '',
    kast: '',
    acs: '',
    dd: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const set = (k: keyof Campos) => (v: string) => setC((s) => ({ ...s, [k]: v }))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const res = await fetch('/api/cards/manual', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(c),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErro(json?.message ?? 'Não deu para gerar. Confere os campos.')
        return
      }
      onPronta(json.carta as CardData)
    } catch {
      setErro('Sem resposta do servidor.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Painel className="mt-3 p-4">
      <Rotulo tom="warn">Entrada manual</Rotulo>
      <p className="mt-3 text-[14px] leading-snug">
        Não conseguimos ler seu perfil. Dá para preencher na mão, mas a carta sai com o selo{' '}
        <strong>NÃO VERIFICADA</strong> e não entra em placar.
      </p>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-[var(--dim)]">
        Os números estão no seu perfil em tracker.gg, na aba Overview.
      </p>

      <form className="mt-4 grid gap-3" onSubmit={enviar}>
        <label className="block">
          <span className="rotulo">Riot ID</span>
          <input
            className="campo mt-2 h-[48px]"
            value={c.riotId}
            onChange={(e) => set('riotId')(e.target.value)}
            placeholder="nick#TAG"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>

        <label className="block">
          <span className="rotulo">Rank atual</span>
          <select
            className="campo mt-2 h-[48px]"
            value={c.rank}
            onChange={(e) => set('rank')(e.target.value)}
          >
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <CampoNum
          rotulo="Tracker Score"
          dica="0 a 1000 — aparece na barra inferior do perfil"
          valor={c.trackerScore}
          onChange={set('trackerScore')}
          placeholder="629"
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <CampoNum rotulo="RW %" valor={c.rw} onChange={set('rw')} placeholder="50.4" required />
          <CampoNum rotulo="KAST %" valor={c.kast} onChange={set('kast')} placeholder="70.9" required />
          <CampoNum rotulo="ACS" valor={c.acs} onChange={set('acs')} placeholder="252.5" required />
          <CampoNum rotulo="DD" valor={c.dd} onChange={set('dd')} placeholder="27" required />
        </div>

        {erro && <p className="font-mono text-[11px] text-[var(--erro)]">{erro}</p>}

        <button type="submit" className="btn btn-primario w-full" disabled={enviando}>
          {enviando ? 'Gerando' : 'Gerar carta não verificada'}
        </button>
        <button type="button" className="btn btn-secundario w-full" onClick={onCancelar}>
          Voltar
        </button>
      </form>
    </Painel>
  )
}
