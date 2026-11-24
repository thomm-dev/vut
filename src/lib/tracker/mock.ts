/**
 * Fixtures de dev (MOCK_TRACKER=1, ignorado em producao). Servem para rodar a LP sem bater no tracker.gg,
 * que esta atras de Cloudflare. Carta gerada em mock nunca vale como dado real.
 */
import type { PerfilTracker } from './map'

const base = {
  peakIcon: null,
  temporada: 'e10a3',
}

export const FIXTURES: Record<string, PerfilTracker> = {
  'heat#912': {
    ...base,
    riotId: 'heat#912',
    pais: 'br',
    avatar: null,
    rankNome: 'Diamond 2',
    rankIcon: 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/19.png',
    peakNome: 'Ascendant 2',
    peakIcon: 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/23.png',
    partidas: 142,
    agente: 'Jett',
    agenteIcon:
      'https://titles.trackercdn.com/valorant-api/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
    agenteHero:
      'https://titles.trackercdn.com/valorant-api/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png',
    agenteRole: 'Duelist',
    stats: {
      rw: { value: 52.4, display: '52.4%', percentile: 56 },
      kast: { value: 71.3, display: '71.3%', percentile: 71 },
      acs: { value: 249.8, display: '249.8', percentile: 86 },
      dd: { value: 24.1, display: '24', percentile: 83 },
      hs: { value: 23.9, display: '23.9%', percentile: 61 },
    },
  },
  'dedada#6625': {
    ...base,
    riotId: 'dedada#6625',
    pais: 'br',
    avatar: null,
    rankNome: 'Diamond 1',
    rankIcon: 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/18.png',
    peakNome: 'Diamond 3',
    peakIcon: 'https://trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/20.png',
    partidas: 98,
    agente: 'Jett',
    agenteIcon:
      'https://titles.trackercdn.com/valorant-api/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
    agenteHero:
      'https://titles.trackercdn.com/valorant-api/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/fullportrait.png',
    agenteRole: 'Duelist',
    stats: {
      rw: { value: 50.39, display: '50.4%', percentile: 56 },
      kast: { value: 70.86, display: '70.9%', percentile: 65 },
      acs: { value: 252.46, display: '252.5', percentile: 88 },
      dd: { value: 26.96, display: '27', percentile: 89 },
      hs: { value: 21.4, display: '21.4%', percentile: 52 },
    },
  },
}

export const idsDeFixture = () => Object.keys(FIXTURES)

export function fixture(key: string): PerfilTracker | null {
  const f = FIXTURES[key.toLowerCase()]
  if (f) return f
  return null
}
