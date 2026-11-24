import type { CardStats } from './types'

export function clamp(min: number, max: number, v: number) {
  return Math.min(max, Math.max(min, v))
}

/** Carta de jogador comum — teto 79.
 *  A fronteira dos 80 e exclusiva de VCT: ninguem grinda ate la. */
export function overallComum(trackerScore: number) {
  return clamp(40, 79, Math.round(trackerScore / 10))
}

/** Fallback quando a leitura do Tracker Score falhar. Pesos da secao 4. */
const PESOS = { acs: 0.3, dd: 0.25, kast: 0.25, rw: 0.2 }

export function estimarScore(s: CardStats) {
  return clamp(
    0,
    1000,
    Math.round(
      (s.acs.percentile * PESOS.acs +
        s.dd.percentile * PESOS.dd +
        s.kast.percentile * PESOS.kast +
        s.rw.percentile * PESOS.rw) *
        10,
    ),
  )
}

/** Carta de pro (rating do VLR.gg) — piso 80, teto 99. */
export function overallPro(vlrRating: number) {
  return clamp(80, 99, Math.round(80 + (vlrRating - 0.8) * 25))
}

/** Percentil geral do jogador, usado na linha "voce esta a frente de X%". */
export function percentilGeral(s: CardStats) {
  return (
    Math.round(
      (s.acs.percentile * PESOS.acs +
        s.dd.percentile * PESOS.dd +
        s.kast.percentile * PESOS.kast +
        s.rw.percentile * PESOS.rw) *
        10,
    ) / 10
  )
}

/* -------------------------------------------------------------------------
 * Overall sem o Tracker Score.
 *
 * O Tracker Score era percentil contra a base inteira de ranqueada — sinal
 * absoluto. O que sobrou hoje e: (a) o rank, que e absoluto, e (b) a comparacao
 * com os jogadores das proprias partidas, que e relativa (o matchmaking coloca
 * voce contra gente do seu nivel, entao todo mundo tende a ~50).
 *
 * Por isso o rank define a faixa e o desempenho no lobby so ajusta +-2.
 *
 * A TABELA ABAIXO E CALIBRACAO, NAO DADO MEDIDO. Esta ancorada nas cartas de
 * referencia do produto (Diamante 2 -> 76, dourado na casa dos 660-730) e deve
 * ser revista se aparecer uma distribuicao real de ranks.
 * ----------------------------------------------------------------------- */

/** id do tier (3 = Ferro 1 ... 27 = Radiante) -> overall base. */
export const OVERALL_POR_TIER: Record<number, number> = {
  3: 42, 4: 44, 5: 46, // Ferro
  6: 49, 7: 51, 8: 53, // Bronze
  9: 55, 10: 57, 11: 59, // Prata
  12: 61, 13: 63, 14: 65, // Ouro
  15: 67, 16: 69, 17: 71, // Platina
  18: 73, 19: 75, 20: 77, // Diamante
  21: 78, 22: 78, 23: 79, // Ascendente
  24: 79, 25: 79, 26: 79, // Imortal
  27: 79, // Radiante
}

export const AJUSTE_MAX = 2

export function overallPorRank(tierId: number, percentilLobby: number) {
  const base = OVERALL_POR_TIER[tierId]
  if (base === undefined) return null
  const ajuste = ((clamp(0, 100, percentilLobby) - 50) / 50) * AJUSTE_MAX
  return clamp(40, 79, Math.round(base + ajuste))
}
