import 'server-only'
import { BROWSER_UA } from '../assets'
import { supabaseAdmin } from '../supabase'
import type { RiotId } from '../riot-id'
import { TrackerError } from './errors'
import { mapearPerfil, pareceProfilePrivado, type PerfilTracker } from './map'
import { fixture } from './mock'

/**
 * Dois caminhos para o mesmo schema de resposta:
 *
 * - OFICIAL: a API publica da Tracker Network, autenticada por `TRN-Api-Key`.
 *   E o unico caminho suportado por eles e o que a propria pagina de bloqueio
 *   indica (tracker.gg/developers). Chave em `TRN_API_KEY`.
 *
 * - WEB: o endpoint interno que o site consome. Hoje responde 403 com uma
 *   pagina "You've Been Blocked" pedindo explicitamente para nao raspar o site.
 *   Fica como ultimo recurso para quem ainda nao tem chave, sem retry: insistir
 *   contra um bloqueio declarado nao e opcao.
 */
const API_OFICIAL = 'https://public-api.tracker.gg/v2/valorant/standard/profile/riot'
const API_WEB = 'https://api.tracker.gg/api/v2/valorant/standard/profile/riot'
const PERFIL_WEB = 'https://tracker.gg/valorant/profile/riot'

const CACHE_MS = 6 * 60 * 60 * 1000 // 6h
const TIMEOUT_MS = 10_000

const chaveTrn = () => process.env.TRN_API_KEY?.trim() || null

/** MOCK nunca vale em producao: carta de producao so com dado real. */
const emMock = () => process.env.MOCK_TRACKER === '1' && process.env.NODE_ENV !== 'production'

/* --------------------------------------------------------------------------
 * Fila global: no maximo 1 req/s para o tracker. Nunca disparar em paralelo.
 * ------------------------------------------------------------------------ */
let cadeia: Promise<unknown> = Promise.resolve()
let ultima = 0

function naFila<T>(fn: () => Promise<T>): Promise<T> {
  const p = cadeia.then(async () => {
    const espera = 1000 - (Date.now() - ultima)
    if (espera > 0) await new Promise((r) => setTimeout(r, espera))
    ultima = Date.now()
    return fn()
  })
  cadeia = p.catch(() => undefined)
  return p as Promise<T>
}

async function pegar(url: string, accept: string, extra: Record<string, string> = {}) {
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'user-agent': BROWSER_UA,
        accept,
        'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
        referer: 'https://tracker.gg/',
        ...extra,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (e) {
    const nome = (e as Error)?.name
    throw new TrackerError(nome === 'TimeoutError' || nome === 'AbortError' ? 'TIMEOUT' : 'UNKNOWN')
  }
  if (res.status === 404) throw new TrackerError('NOT_FOUND')
  if (res.status === 401) throw new TrackerError('UNAUTHORIZED')
  if (res.status === 403 || res.status === 429 || res.status === 451) {
    throw new TrackerError('BLOCKED', `HTTP ${res.status} em ${new URL(url).host}`)
  }
  if (!res.ok) throw new TrackerError('UNKNOWN', 'HTTP ' + res.status)
  return res
}

/* ------------------------------- cache 6h -------------------------------- */

const mem = new Map<string, { at: number; payload: unknown }>()

async function doCache(key: string): Promise<unknown | null> {
  const m = mem.get(key)
  if (m && Date.now() - m.at < CACHE_MS) return m.payload

  const sb = supabaseAdmin()
  if (!sb) return null
  const { data } = await sb
    .from('tracker_cache')
    .select('payload, fetched_at')
    .eq('riot_id', key)
    .maybeSingle()
  if (!data) return null
  const at = new Date(data.fetched_at).getTime()
  if (Date.now() - at > CACHE_MS) return null
  mem.set(key, { at, payload: data.payload })
  return data.payload
}

async function gravarCache(key: string, payload: unknown, score: number | null) {
  mem.set(key, { at: Date.now(), payload })
  if (mem.size > 500) mem.delete(mem.keys().next().value as string)
  const sb = supabaseAdmin()
  if (!sb) return
  try {
    await sb.from('tracker_cache').upsert({
      riot_id: key,
      payload,
      score,
      score_origem: score != null ? 'html' : 'estimado',
      fetched_at: new Date().toISOString(),
    })
  } catch {
    /* cache e otimizacao, nao pode derrubar a busca */
  }
}

/* -------------------------------- perfil --------------------------------- */

let avisouChave = false

export async function buscarPerfil(riot: RiotId): Promise<PerfilTracker> {
  if (emMock()) {
    const f = fixture(riot.key)
    if (f) return f
    throw new TrackerError('NOT_FOUND')
  }

  const cacheado = await doCache(riot.key)
  if (cacheado) return mapearPerfil(cacheado, riot.display)

  const chave = chaveTrn()
  if (!chave && !avisouChave) {
    avisouChave = true
    console.error(
      '[vut] TRN_API_KEY ausente. O endpoint interno do tracker.gg responde 403 ' +
        '("You\'ve Been Blocked"). Peca uma chave em https://tracker.gg/developers ' +
        'e configure TRN_API_KEY.',
    )
  }

  const url = (chave ? API_OFICIAL : API_WEB) + '/' + riot.encoded + (chave ? '' : '?source=web')
  const extra: Record<string, string> = chave ? { 'trn-api-key': chave } : {}

  // Sem retry: 403 aqui e bloqueio declarado, nao instabilidade.
  const raw = (await naFila(() =>
    pegar(url, 'application/json', extra).then((r) => r.json()),
  )) as Record<string, unknown>

  if (pareceProfilePrivado(raw)) throw new TrackerError('PRIVATE')

  const score = await lerTrackerScoreHtml(riot)
  await gravarCache(riot.key, raw, score)
  return mapearPerfil(raw, riot.display)
}

/* ----------------------------- tracker score ----------------------------- */

const scoreMem = new Map<string, { at: number; v: number | null }>()

/**
 * O Tracker Score (0-1000) nao vem em nenhuma das duas APIs: o site calcula no
 * cliente. Ler do HTML do perfil hoje esbarra no desafio do Cloudflare, entao a
 * leitura so acontece com LER_SCORE_HTML=1 — fora isso o score sai estimado
 * pelos percentis, com erro medido de 1 a 4 pontos de overall.
 */
export async function lerTrackerScoreHtml(riot: RiotId): Promise<number | null> {
  if (emMock() || process.env.LER_SCORE_HTML !== '1') return null
  const hit = scoreMem.get(riot.key)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v

  let v: number | null = null
  try {
    const html = await naFila(() =>
      pegar(PERFIL_WEB + '/' + riot.encoded + '/overview?playlist=competitive', 'text/html').then(
        (r) => r.text(),
      ),
    )
    v = extrairScore(html)
  } catch {
    v = null
  }
  scoreMem.set(riot.key, { at: Date.now(), v })
  return v
}

export function extrairScore(html: string): number | null {
  const padroes = [
    /Tracker\s*Score[\s\S]{0,400}?>\s*(\d{1,4})\s*<[\s\S]{0,160}?\/\s*1000/i,
    /Tracker\s*Score[^0-9]{0,200}(\d{1,4})\s*\/\s*1000/i,
    /"trackerScore"\s*:\s*\{[^}]*?"value"\s*:\s*(\d{1,4})/i,
    /"trackerScore"\s*:\s*(\d{1,4})/i,
  ]
  for (const re of padroes) {
    const m = html.match(re)
    if (m) {
      const n = Number(m[1])
      if (n > 0 && n <= 1000) return n
    }
  }
  return null
}

export function urlPerfilPublico(riot: RiotId) {
  return PERFIL_WEB + '/' + riot.encoded + '/overview?playlist=competitive'
}
