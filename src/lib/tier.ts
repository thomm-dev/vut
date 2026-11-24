import type { TierKey } from './types'

/** Escala de cor pelo Tracker Score (secao 4). Uma variavel, quatro usos. */
export const TIERS: { key: TierKey; min: number; cor: string; label: string }[] = [
  { key: 'RADIANTE', min: 925, cor: '#e23bd0', label: 'S' },
  { key: 'DIAMANTE', min: 850, cor: '#22c9e8', label: 'A' },
  { key: 'ESMERALDA', min: 750, cor: '#2fd47a', label: 'B' },
  { key: 'OURO', min: 600, cor: '#f0a92c', label: 'C' },
  { key: 'BRONZE', min: 0, cor: '#b87a4a', label: 'D' },
]

export function tierPorScore(trackerScore: number) {
  return TIERS.find((t) => trackerScore >= t.min) ?? TIERS[TIERS.length - 1]
}

export function corDoTier(key: TierKey) {
  return (TIERS.find((t) => t.key === key) ?? TIERS[TIERS.length - 1]).cor
}

/** A letra S/A/B/C/D do tracker — derivada do percentil (secao 3.3). */
export const LETRAS = [
  { min: 82, letra: 'S', cor: '#32b5e8' },
  { min: 70, letra: 'A', cor: '#3ddc84' },
  { min: 45, letra: 'B', cor: '#f0c22c' },
  { min: 20, letra: 'C', cor: '#e8873a' },
  { min: 0, letra: 'D', cor: '#e05a5a' },
] as const

export function letraDoPercentil(p: number) {
  return LETRAS.find((l) => p >= l.min) ?? LETRAS[LETRAS.length - 1]
}

/**
 * O site mostra *Bottom* abaixo da mediana. Rotular tudo como "Top" inverte o
 * sentido: percentil 8 e Bottom 8%, nao Top 92%.
 */
export function rotuloPercentil(p: number) {
  const n = Math.round(p)
  return n >= 50 ? `Top ${Math.max(1, 100 - n)}%` : `Bottom ${Math.max(1, n)}%`
}
