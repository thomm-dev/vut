import 'server-only'
import type { RiotId } from '../riot-id'
import { TrackerError } from '../tracker/errors'
import type { PerfilTracker } from '../tracker/map'
import { iconeAgente, iconeRank, paisPorRegiao } from './assets'
import {
  agenteMaisJogado,
  amostraDoLobby,
  metricasDoJogador,
  percentilNaAmostra,
  type Metricas,
} from './calculo'
import { perfilEmCache, gravarPerfil } from './cache'
import { henrik } from './client'
import type { Conta, Mmr, Partida } from './tipos'

/** Janela de análise: a API devolve no máximo 10 partidas por chamada. */
export const JANELA_PARTIDAS = 10

export type PerfilHenrik = PerfilTracker & {
  tierId: number | null
  peakTierId: number | null
  /** Quantas pessoas entraram na amostra de comparação (lobbies da janela). */
  amostra: number
  partidasAnalisadas: number
}

const pct = (v: number) => `${v.toFixed(1)}%`

/** Ato corrente: o array `seasonal` vem do mais antigo para o mais novo. */
function atoCorrente(mmr: Mmr) {
  const atual = mmr.latest_update?.season?.id
  const porId = atual ? mmr.seasonal?.find((s) => s.season?.id === atual) : undefined
  return porId ?? mmr.seasonal?.at(-1) ?? null
}

export async function buscarPerfilHenrik(riot: RiotId): Promise<PerfilHenrik> {
  const cacheado = await perfilEmCache(riot.key)
  if (cacheado) return cacheado

  const nome = encodeURIComponent(riot.nick)
  const tag = encodeURIComponent(riot.tag)

  // 1. conta: puuid e região (a região é obrigatória nas rotas seguintes)
  const { dados: conta } = await henrik<Conta>(`/v2/account/${nome}/${tag}`)
  const regiao = conta.region?.toLowerCase()
  if (!conta.puuid || !regiao) throw new TrackerError('NOT_FOUND')
  const plataforma = conta.platforms?.[0]?.toLowerCase() === 'console' ? 'console' : 'pc'

  // 2 e 3, em paralelo: rank/pico/partidas do ato, e a janela de partidas
  const [{ dados: mmr }, { dados: partidas }] = await Promise.all([
    henrik<Mmr>(`/v3/mmr/${regiao}/${plataforma}/${nome}/${tag}`),
    henrik<Partida[]>(
      `/v4/matches/${regiao}/${plataforma}/${nome}/${tag}?mode=competitive&size=${JANELA_PARTIDAS}`,
    ),
  ])

  if (!Array.isArray(partidas) || partidas.length === 0) {
    // Sem competitivo recente não há de onde tirar stat — nada de inventar.
    // Não é "perfil privado": aqui lemos a API da Riot, não o tracker.gg.
    throw new TrackerError('SEM_COMPETITIVO', 'sem partidas de competitivo na janela')
  }

  const minhas = metricasDoJogador(partidas, conta.puuid)
  if (!minhas) throw new TrackerError('UNKNOWN', 'nenhuma partida utilizável')

  const amostra = amostraDoLobby(partidas)
  amostra.delete(conta.puuid)
  const valores = (f: (m: Metricas) => number) => [...amostra.values()].map(f)

  const agente = agenteMaisJogado(partidas, conta.puuid)
  const tierAtual = mmr.current?.tier ?? null
  const tierPico = mmr.peak?.tier ?? null

  const [rankIcon, peakIcon] = await Promise.all([
    iconeRank(tierAtual?.id),
    iconeRank(tierPico?.id),
  ])

  const atoAtual = atoCorrente(mmr)
  const partidasAto = Number(atoAtual?.games ?? 0) || partidas.length

  const perfil: PerfilHenrik = {
    riotId: `${conta.name ?? riot.nick}#${conta.tag ?? riot.tag}`,
    pais: paisPorRegiao(regiao),
    avatar: conta.card ? `https://media.valorant-api.com/playercards/${conta.card}/smallart.png` : null,
    rankNome: tierAtual?.name ?? null,
    rankIcon,
    peakNome: tierPico?.name ?? null,
    peakIcon,
    partidas: partidasAto,
    agente: agente?.nome ?? null,
    agenteIcon: iconeAgente(agente?.id),
    agenteHero: null, // a arte central da carta é a foto do VUT
    agenteRole: null,
    temporada: atoAtual?.season?.short ?? partidas[0]?.metadata?.season?.short ?? null,
    tierId: tierAtual?.id ?? null,
    peakTierId: tierPico?.id ?? null,
    amostra: amostra.size,
    partidasAnalisadas: partidas.length,
    stats: {
      rw: {
        value: minhas.rw,
        display: pct(minhas.rw),
        percentile: percentilNaAmostra(minhas.rw, valores((m) => m.rw)),
      },
      kast: {
        value: minhas.kast,
        display: pct(minhas.kast),
        percentile: percentilNaAmostra(minhas.kast, valores((m) => m.kast)),
      },
      acs: {
        value: minhas.acs,
        display: minhas.acs.toFixed(1),
        percentile: percentilNaAmostra(minhas.acs, valores((m) => m.acs)),
      },
      dd: {
        value: minhas.dd,
        display: String(Math.round(minhas.dd)),
        percentile: percentilNaAmostra(minhas.dd, valores((m) => m.dd)),
      },
    },
  }

  await gravarPerfil(riot.key, perfil)
  // "ZéDuarte#BRL" e "Ze Duarte#BRL" caem na mesma conta: grava também sob a
  // chave canônica para a próxima variante não gastar outra busca.
  const canonica = perfil.riotId.toLowerCase()
  if (canonica !== riot.key) await gravarPerfil(canonica, perfil)

  return perfil
}
