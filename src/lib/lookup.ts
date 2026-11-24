import 'server-only'
import { montarCarta, MIN_PARTIDAS } from './card'
import { chaveHenrik } from './henrik/client'
import { buscarPerfilHenrik } from './henrik/perfil'
import { parseRiotId } from './riot-id'
import { buscarPerfil, lerTrackerScoreHtml } from './tracker/client'
import { MENSAGENS, TrackerError } from './tracker/errors'
import { fixture, idsDeFixture } from './tracker/mock'
import type { PerfilTracker } from './tracker/map'
import type { CardData, LookupResponse } from './types'

export type CartaCrua = Omit<CardData, 'slug' | 'serialNum' | 'createdAt'>

export type ResultadoLookup =
  | { ok: true; carta: CartaCrua }
  | { ok: false; erro: Extract<LookupResponse, { ok: false }> }

/** MOCK nunca vale em producao: carta de producao so com dado real. */
const emMock = () => process.env.MOCK_TRACKER === '1' && process.env.NODE_ENV !== 'production'

/**
 * Busca o perfil e monta a carta. A entrada e so o Riot ID.
 *
 * Fonte: HenrikDev quando ha chave (unico caminho que funciona hoje — a API
 * publica da Tracker Network nao serve Valorant). Sem chave, cai no caminho
 * antigo do tracker.gg, que responde 403.
 */
async function buscarPerfilDoJogador(riot: ReturnType<typeof parseRiotId> & object) {
  if (emMock()) {
    const f = fixture(riot.key)
    if (!f) {
      // Erro de configuracao, nao de busca: nao pode se passar por 404 real.
      console.error(
        `[vut] MOCK_TRACKER=1 e "${riot.display}" nao esta nas fixtures ` +
          `(${idsDeFixture().join(', ')}). Desligue MOCK_TRACKER no .env.local ` +
          `para buscar de verdade.`,
      )
      throw new TrackerError(
        'MOCK',
        `Modo mock ligado: so ${idsDeFixture().join(' e ')} existem.`,
      )
    }
    console.warn('[vut] MOCK_TRACKER=1 — dado de fixture, nao da API real.')
    return { perfil: f as PerfilTracker, score: null as number | null }
  }
  if (chaveHenrik()) {
    return { perfil: await buscarPerfilHenrik(riot), score: null as number | null }
  }
  const perfil = await buscarPerfil(riot)
  return { perfil, score: await lerTrackerScoreHtml(riot) }
}

export async function executarLookup(riotIdRaw: unknown): Promise<ResultadoLookup> {
  const riot = typeof riotIdRaw === 'string' ? parseRiotId(riotIdRaw) : null
  if (!riot) {
    return { ok: false, erro: { ok: false, code: 'INVALID_ID', message: MENSAGENS.INVALID_ID } }
  }

  try {
    const { perfil, score } = await buscarPerfilDoJogador(riot)

    // Gate de elegibilidade: percentil sem significado abaixo de 10 partidas.
    if (perfil.partidas < MIN_PARTIDAS) {
      return {
        ok: false,
        erro: {
          ok: false,
          code: 'LOW_MATCHES',
          message: MENSAGENS.LOW_MATCHES,
          partidas: perfil.partidas,
        },
      }
    }

    return { ok: true, carta: montarCarta(riot, perfil, score) }
  } catch (e) {
    const code = e instanceof TrackerError ? e.code : 'UNKNOWN'
    if (!(e instanceof TrackerError)) console.error('[vut] lookup falhou', e)
    else if (code === 'UNKNOWN') console.error('[vut] lookup falhou:', e.message)
    return { ok: false, erro: { ok: false, code, message: MENSAGENS[code] ?? MENSAGENS.UNKNOWN } }
  }
}
