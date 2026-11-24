import 'server-only'
import { TrackerError } from '../tracker/errors'

/**
 * API nao-oficial do HenrikDev (api.henrikdev.xyz), que le a API in-game da Riot.
 * E o caminho possivel hoje: a API publica da Tracker Network nao serve Valorant
 * (o staff deles manda pedir acesso direto a Riot) e o endpoint interno do site
 * responde 403 pedindo para nao raspar.
 *
 * Limite da chave basica: 30 requisicoes por minuto.
 */
const BASE = 'https://api.henrikdev.xyz/valorant'
const LIMITE_POR_MINUTO = 30
const TIMEOUT_MS = 10_000

export const chaveHenrik = () => process.env.HENRIKDEV_API_KEY?.trim() || null

/* ---------------------------- balde de fichas ----------------------------- */
/* Janela deslizante: 30 chamadas por minuto, sem espacamento fixo — uma busca  */
/* fria gasta 3 chamadas seguidas e nao pode levar 6s so por causa de fila.    */

const janela: number[] = []

async function esperarVaga() {
  for (;;) {
    const agora = Date.now()
    while (janela.length && agora - janela[0] > 60_000) janela.shift()
    if (janela.length < LIMITE_POR_MINUTO) {
      janela.push(agora)
      return
    }
    const esperar = 60_000 - (agora - janela[0]) + 50
    await new Promise((r) => setTimeout(r, Math.min(esperar, 5_000)))
  }
}

/* -------------------------------- fetch ---------------------------------- */

export type Resposta<T> = { dados: T; restante: number | null }

export async function henrik<T>(caminho: string): Promise<Resposta<T>> {
  const chave = chaveHenrik()
  if (!chave) throw new TrackerError('UNAUTHORIZED', 'HENRIKDEV_API_KEY ausente')

  await esperarVaga()

  let res: Response
  try {
    res = await fetch(BASE + caminho, {
      headers: { authorization: chave, accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    const nome = (e as Error)?.name
    throw new TrackerError(nome === 'TimeoutError' || nome === 'AbortError' ? 'TIMEOUT' : 'UNKNOWN')
  }

  const restante = Number(res.headers.get('x-ratelimit-remaining'))

  if (res.status === 404) throw new TrackerError('NOT_FOUND')
  if (res.status === 401 || res.status === 403) {
    console.error('[vut] HenrikDev recusou a chave:', res.status)
    throw new TrackerError('UNAUTHORIZED')
  }
  if (res.status === 429) {
    console.warn('[vut] HenrikDev: limite de 30 req/min estourado')
    throw new TrackerError('BLOCKED')
  }
  if (!res.ok) {
    let detalhe = ''
    try {
      const corpo = (await res.json()) as { errors?: { message?: string }[] }
      detalhe = corpo?.errors?.[0]?.message ?? ''
    } catch {
      /* corpo nao-JSON */
    }
    throw new TrackerError('UNKNOWN', `HTTP ${res.status} ${detalhe}`)
  }

  const corpo = (await res.json()) as { data?: T }
  if (corpo?.data === undefined) throw new TrackerError('UNKNOWN', 'resposta sem data')

  return { dados: corpo.data, restante: Number.isFinite(restante) ? restante : null }
}
