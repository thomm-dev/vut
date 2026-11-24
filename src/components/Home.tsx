'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { hashCurto, track } from '@/lib/analytics'
import { riotIdValido } from '@/lib/riot-id'
import { urlCarta, versaoCarta } from '@/lib/site'
import { rotuloPercentil, TIERS } from '@/lib/tier'
import type { CardData } from '@/lib/types'
import { AcoesCarta } from './AcoesCarta'
import { CartaImagem } from './CartaImagem'
import { EsqueletoCarta } from './EsqueletoCarta'
import { FormManual } from './FormManual'
import { LinhasStats } from './LinhasStats'
import { ModalErro, type ErroLookup } from './ModalErro'
import { SeletorAtleta } from './SeletorAtleta'
import { Kpi, Marca, Painel, Rotulo } from './ui'

type Estado =
  | { t: 'entrada' }
  | { t: 'buscando' }
  | { t: 'pronta'; carta: CardData }
  | { t: 'manual' }

const TEATRO_MS = 2200 // o AHA precisa de peso; nao pular

export function Home({ whatsapp, total }: { whatsapp: string; total: number }) {
  const [riotId, setRiotId] = useState('')
  const [estado, setEstado] = useState<Estado>({ t: 'entrada' })
  // Falha de busca vira modal: e aviso, nao um estado em que a pessoa fica presa.
  const [erro, setErro] = useState<ErroLookup | null>(null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [totalAtletas, setTotalAtletas] = useState(0)
  const [trocando, setTrocando] = useState(false)
  const [erroAtleta, setErroAtleta] = useState<string | null>(null)
  const [erroCampo, setErroCampo] = useState<string | null>(null)
  const [passo, setPasso] = useState(0)
  const [partidasLidas, setPartidasLidas] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultadoRef = useRef<HTMLDivElement>(null)

  const buscando = estado.t === 'buscando'
  const carta = estado.t === 'pronta' ? estado.carta : null

  /* --------------------------- log de 3 linhas --------------------------- */
  // O passo avanca por tempo; o conteudo da linha 2 vem da busca quando chega.
  useEffect(() => {
    if (!buscando) return
    setPasso(1)
    const t1 = setTimeout(() => setPasso(2), 700)
    const t2 = setTimeout(() => setPasso(3), 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [buscando])

  const linhasLog = [
    `localizando ${riotId.trim()}`,
    partidasLidas ? `lendo ${partidasLidas} partidas ranqueadas` : 'lendo partidas ranqueadas',
    'calculando percentis',
  ].slice(0, passo)

  useEffect(() => {
    if (estado.t !== 'pronta' || totalAtletas) return
    fetch('/api/cards/atleta')
      .then((r) => r.json())
      .then((j) => setTotalAtletas(j?.total ?? 0))
      .catch(() => setTotalAtletas(0))
  }, [estado.t, totalAtletas])

  useEffect(() => {
    if (estado.t === 'pronta') {
      resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [estado.t])

  /* ------------------------------- busca --------------------------------- */
  const gerar = useCallback(async () => {
    const id = riotId.trim()
    if (!riotIdValido(id)) {
      setErroCampo('Formato: nick#TAG — ex.: heat#912')
      inputRef.current?.focus()
      return
    }
    setErroCampo(null)
    setPartidasLidas(null)
    setEstado({ t: 'buscando' })
    track('lookup_started', { riotIdHash: hashCurto(id.toLowerCase()) })

    const inicio = Date.now()
    const esperaMinima = async () => {
      const resta = TEATRO_MS - (Date.now() - inicio)
      if (resta > 0) await new Promise((r) => setTimeout(r, resta))
    }

    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ riotId: id }),
      })
      const json = await res.json()

      if (!res.ok || !json.ok) {
        await esperaMinima()
        track('lookup_failed', { motivo: json?.code ?? 'UNKNOWN' })
        setEstado({ t: 'entrada' })
        setErro({
          code: json?.code ?? 'UNKNOWN',
          message: json?.message ?? 'Algo quebrou na busca. Tenta de novo.',
          partidas: json?.partidas,
        })
        return
      }

      const c = json.carta as CardData
      if (c.partidas) setPartidasLidas(c.partidas)
      await esperaMinima()
      track('lookup_succeeded', { overall: c.overall, tier: c.tier })
      track('card_generated', { overall: c.overall, tier: c.tier, tipo: c.tipo })
      setEstado({ t: 'pronta', carta: c })
    } catch {
      await esperaMinima()
      track('lookup_failed', { motivo: 'NETWORK' })
      setEstado({ t: 'entrada' })
      setErro({
        code: 'UNKNOWN',
        message: 'Sem resposta do servidor. Confere a conexão e tenta de novo.',
      })
    }
  }, [riotId])

  async function trocarAtleta(atleta: number) {
    if (!carta) return
    setTrocando(true)
    setErroAtleta(null)
    try {
      const res = await fetch('/api/cards/atleta', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: carta.slug, atleta }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setErroAtleta(json?.message ?? 'Não deu para trocar agora.')
        return
      }
      setEstado({ t: 'pronta', carta: json.carta as CardData })
      track('card_athlete_changed', { slug: carta.slug, atleta })
    } catch {
      setErroAtleta('Sem resposta do servidor.')
    } finally {
      setTrocando(false)
    }
  }

  function fecharErro() {
    setErro(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function reiniciar() {
    setEstado({ t: 'entrada' })
    setErro(null)
    setPasso(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  /* ------------------------------- KPIs ---------------------------------- */
  const tierLabel = carta ? (TIERS.find((t) => t.key === carta.tier)?.label ?? '—') : null
  const emEspera = buscando ? '···' : '—'

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pb-16 pt-4 sm:pt-8">
      {/* cabecalho */}
      <header className="flex items-center justify-between pb-5">
        <Marca />
        <Rotulo tom={buscando ? 'warn' : carta ? 'ok' : 'dim'}>
          {buscando ? 'buscando' : carta ? 'carta pronta' : 'online'}
        </Rotulo>
      </header>

      <div className="pb-5">
        <h1 className="text-4xl leading-[1.05] font-extrabold italic tracking-tighter sm:text-[32px]">
          VALORANT ULTIMATE TEAM
        </h1>
        <p className="mt-2.5 max-w-[42ch] text-[14px] leading-snug text-[var(--dim)] sm:text-[15px]">
          Prove seu valor na ranqueada, gere sua carta, compartilhe. Não gostou do resultado, jogue mais partidas e melhore ela ainda mais!
        </p>
      </div>

      {/* ------------------------- estado 1: entrada ------------------------ */}
      {(estado.t === 'entrada' || buscando) && (
        <Painel className="mt-3 p-4 sm:p-5">
          <Rotulo>Seu Riot ID</Rotulo>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!buscando) gerar()
            }}
          >
            <input
              ref={inputRef}
              className={`campo ${erroCampo ? 'campo-erro' : ''}`}
              value={riotId}
              onChange={(e) => {
                setRiotId(e.target.value)
                if (erroCampo) setErroCampo(null)
              }}
              placeholder="nick#TAG"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={24}
              disabled={buscando}
              aria-label="Riot ID"
              aria-invalid={!!erroCampo}
            />
            <p
              className={`mt-2 font-mono text-[11px] leading-relaxed ${erroCampo ? 'text-[var(--erro)]' : 'text-[var(--dim)]'
                }`}
            >
              {erroCampo ?? 'É o nome que aparece no jogo, com a tag depois do #.'}
            </p>
            <button type="submit" className="btn btn-primario mt-3 w-full" disabled={buscando}>
              {buscando ? 'Buscando' : 'Gerar carta'}
            </button>
          </form>
        </Painel>
      )}

      {/* ------------------------- estado 2: busca -------------------------- */}
      {buscando && (
        <div className="mt-3 space-y-3">
          <Painel className="p-3">
            <ul className="font-mono text-[11px] leading-[1.9] tracking-[0.04em] text-[var(--dim)]">
              {linhasLog.map((l, i) => (
                <li key={i} className={`surge ${i === linhasLog.length - 1 ? 'cursor' : ''}`}>
                  <span className="mr-2 text-[var(--txt)]">&#9642;</span>
                  {l}
                </li>
              ))}
            </ul>
          </Painel>
          <div className="mx-auto w-full max-w-[380px] min-w-0">
            <EsqueletoCarta />
          </div>
        </div>
      )}

      {/* ---------------------- estado 3 e 4: revelacao --------------------- */}
      <div ref={resultadoRef}>
        {carta && (
          <div className="mt-3 space-y-3">
            <div className="mx-auto w-full max-w-[380px] min-w-0">
              <CartaImagem
                src={urlCarta(carta.slug, versaoCarta(carta))}
                alt={`Carta de ${carta.nick}, overall ${carta.overall}`}
                prioridade
                acao={
                  totalAtletas > 1
                    ? { label: 'clique para mudar atleta', onClick: () => setSeletorAberto(true) }
                    : undefined
                }
              />
            </div>

            <Painel className="p-4">
              <p className="text-[15px] leading-snug">
                <span className="font-bold" style={{ color: carta.cor }}>
                  Overall {carta.overall}
                </span>{' '}
                {carta.tipo === 'manual'
                  ? '— carta preenchida na mão, sem conferência no tracker.'
                  : `— você está à frente de ${Math.round(carta.percentil)}% dos jogadores das suas últimas partidas.`}
              </p>

              <p className="mt-2 font-mono text-[10px] tracking-[0.08em] text-[var(--dim)] uppercase">
                {carta.rankNome ?? 'sem rank'}
                {carta.peakNome ? ` · pico ${carta.peakNome}` : ''}
                {carta.agente ? ` · ${carta.agente}` : ''}
                {carta.partidas ? ` · ${carta.partidas} partidas` : ''}
              </p>
            </Painel>


            {/* faixa de KPIs */}
            <Painel className="grid grid-cols-2 sm:grid-cols-4">
              <Kpi
                rotulo="Overall"
                valor={carta ? carta.overall : emEspera}
                cor={carta?.cor}
                sub={carta ? rotuloPercentil(carta.percentil) : 'por partida'}
              />
              <Kpi
                rotulo="Tier"
                valor={tierLabel ?? emEspera}
                cor={carta?.cor}
                sub={
                  carta
                    ? carta.scoreOrigem === 'rank'
                      ? (carta.rankNome ?? 'pela cor')
                      : `score ${carta.trackerScore}`
                    : 'pela cor'
                }
              />
              <Kpi
                rotulo="Verificação"
                valor={carta ? (carta.tipo === 'manual' ? 'manual' : 'tracker') : emEspera}
                sub={
                  carta
                    ? carta.scoreOrigem === 'rank'
                      ? `${carta.partidas} no ato`
                      : carta.scoreOrigem === 'html'
                        ? 'score lido'
                        : 'score estimado'
                    : 'partidas reais'
                }
              />
              <Kpi
                rotulo="Cartas"
                valor={total + (carta ? 1 : 0)}
                sub={carta ? `série ${carta.serie} · #${carta.serialNum}` : 'geradas'}
              />
            </Painel>


            {carta.tipo !== 'manual' && (
              <Painel>
                <div className="px-3 pt-3 sm:px-4">
                  <Rotulo>Comparado com as suas últimas partidas</Rotulo>
                </div>
                <div className="mt-2">
                  <LinhasStats carta={carta} />
                </div>
              </Painel>
            )}

            <AcoesCarta carta={carta} whatsapp={whatsapp} contexto="home" />

            <button type="button" className="btn btn-secundario w-full" onClick={reiniciar}>
              Buscar outro Riot ID
            </button>
          </div>
        )}

        {/* --------------------- fallback: entrada manual -------------------- */}
        {estado.t === 'manual' && (
          <FormManual
            riotId={riotId}
            onCancelar={reiniciar}
            onPronta={(c) => {
              track('card_generated', { overall: c.overall, tier: c.tier, tipo: c.tipo })
              setEstado({ t: 'pronta', carta: c })
            }}
          />
        )}
      </div>

      {seletorAberto && carta && (
        <SeletorAtleta
          total={totalAtletas}
          atual={carta.atleta}
          salvando={trocando}
          erro={erroAtleta}
          onEscolher={trocarAtleta}
          onFechar={() => {
            setSeletorAberto(false)
            setErroAtleta(null)
          }}
        />
      )}

      {erro && (
        <ModalErro
          erro={erro}
          onFechar={fecharErro}
          onManual={() => {
            setErro(null)
            setEstado({ t: 'manual' })
          }}
        />
      )}

      {/* rodape: o loop, em tres linhas */}
      {estado.t === 'entrada' && (
        <ol className="mt-6 grid gap-1.5 font-mono text-[10px] leading-relaxed tracking-[0.1em] text-[var(--dim)] uppercase">
          <li>01 — Insira seu o Riot ID</li>
          <li>02 — A gente busca os números das suas partidas</li>
          <li>03 — Sua carta sai pronta pra compartilhar</li>
        </ol>
      )}
    </main>
  )
}
