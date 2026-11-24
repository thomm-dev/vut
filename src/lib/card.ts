import type { CardData } from './types'
import type { PerfilTracker } from './tracker/map'
import type { PerfilHenrik } from './henrik/perfil'
import type { RiotId } from './riot-id'
import { parseRiotId, sanitizeText } from './riot-id'
import { estimarScore, overallComum, overallPorRank, percentilGeral } from './overall'
import { tierPorScore } from './tier'
import { rankIconUrl } from './rank'

export const SERIE_ATUAL = 1
export const MIN_PARTIDAS = 10

type CartaCrua = Omit<CardData, 'slug' | 'serialNum' | 'createdAt'>

const temRank = (p: PerfilTracker | PerfilHenrik): p is PerfilHenrik => 'tierId' in p

/**
 * Monta a carta a partir do perfil. Nenhum numero vem do usuario.
 *
 * Duas origens de overall:
 * - 'html'/'estimado': Tracker Score (overall = score / 10), caminho do tracker.gg.
 * - 'rank': sem Tracker Score, o rank define a faixa e o desempenho nas ultimas
 *   partidas ajusta dentro dela. Ver OVERALL_POR_TIER.
 */
export function montarCarta(
  riot: RiotId,
  p: PerfilTracker | PerfilHenrik,
  scoreHtml: number | null,
): CartaCrua {
  const percentil = percentilGeral(p.stats)

  // O nome que vale é o que a Riot devolveu, não o que foi digitado: quem
  // buscou "ze duarte#brl" recebe a carta de "Zé Duarte#BRL" — mesma grafia,
  // mesma chave no banco, uma carta só por jogador.
  const canonico = parseRiotId(p.riotId) ?? riot

  let overall: number
  let trackerScore: number
  let scoreOrigem: CardData['scoreOrigem']

  const porRank = temRank(p) && p.tierId ? overallPorRank(p.tierId, percentil) : null

  if (porRank !== null) {
    overall = porRank
    trackerScore = porRank * 10
    scoreOrigem = 'rank'
  } else {
    trackerScore = scoreHtml ?? estimarScore(p.stats)
    overall = overallComum(trackerScore)
    scoreOrigem = scoreHtml != null ? 'html' : 'estimado'
  }

  const tier = tierPorScore(trackerScore)

  return {
    riotId: canonico.display,
    nick: sanitizeText(canonico.nick, 16),
    tag: sanitizeText(canonico.tag, 5),
    pais: p.pais,
    tipo: 'tracker',
    rankNome: p.rankNome,
    rankIcon: p.rankIcon ?? (p.rankNome ? rankIconUrl(p.rankNome) : null),
    peakNome: p.peakNome,
    peakIcon: p.peakIcon ?? (p.peakNome ? rankIconUrl(p.peakNome) : null),
    timeLogo: null, // slot da marca do VUT; time real so nas cartas de pro (PR 3)
    trackerScore,
    scoreOrigem,
    agente: p.agente,
    agenteIcon: p.agenteIcon,
    agenteHero: p.agenteHero,
    agenteRole: p.agenteRole,
    atleta: null, // escolha do dono; sem escolha, a foto sai do hash do Riot ID
    overall,
    percentil,
    tier: tier.key,
    cor: tier.cor,
    stats: p.stats,
    partidas: p.partidas,
    temporada: p.temporada,
    serie: SERIE_ATUAL,
  }
}
