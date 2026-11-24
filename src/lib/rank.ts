const ORDEM = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Ascendant', 'Immortal']

/** "Diamond 2" -> 19. Validado: Diamante 1 = 18, Diamante 3 = 20, Ascendente 2 = 22. */
export function tierNum(tierName: string): number {
  if (/radiant/i.test(tierName)) return 27
  const m = tierName.match(/^(\D+)\s*(\d)?$/)
  if (!m) return 0
  const [, nome, div] = m
  const i = ORDEM.findIndex((x) => new RegExp('^' + x, 'i').test(nome.trim()))
  return i < 0 ? 0 : 3 + i * 3 + ((Number(div) || 1) - 1)
}

export function rankIconUrl(tierName: string) {
  return `https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/${tierNum(tierName)}.png`
}

/** Traducao pt-BR so para exibicao na UI. */
const PT: Record<string, string> = {
  Iron: 'Ferro',
  Bronze: 'Bronze',
  Silver: 'Prata',
  Gold: 'Ouro',
  Platinum: 'Platina',
  Diamond: 'Diamante',
  Ascendant: 'Ascendente',
  Immortal: 'Imortal',
  Radiant: 'Radiante',
  Unranked: 'Sem rank',
}

export function rankPt(tierName: string | null) {
  if (!tierName) return 'Sem rank'
  const m = tierName.match(/^(\D+)\s*(\d)?$/)
  if (!m) return tierName
  const base = PT[m[1].trim()] ?? m[1].trim()
  return m[2] ? `${base} ${m[2]}` : base
}
