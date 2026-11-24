import 'server-only'
import { supabaseAdmin } from '../supabase'
import type { PerfilHenrik } from './perfil'

const CACHE_MS = 6 * 60 * 60 * 1000 // 6h

/**
 * Cache do perfil JA CALCULADO, nao do payload cru: as 10 partidas somam ~4 MB
 * e nada disso e reutilizavel depois do calculo. Guardar o resultado mantem o
 * banco pequeno e nao persiste stat de terceiro.
 *
 * Chave com prefixo para nao colidir com o payload do caminho antigo do tracker.
 */
const chave = (riotKey: string) => `henrik:${riotKey}`

type Entrada = { at: number; perfil: PerfilHenrik }

// globalThis: em dev cada rota pode ter sua propria instancia do modulo.
const g = globalThis as typeof globalThis & { __vutPerfis?: Map<string, Entrada> }
g.__vutPerfis ??= new Map<string, Entrada>()
const mem = g.__vutPerfis

export async function perfilEmCache(riotKey: string): Promise<PerfilHenrik | null> {
  const k = chave(riotKey)

  const m = mem.get(k)
  if (m && Date.now() - m.at < CACHE_MS) return m.perfil

  const sb = supabaseAdmin()
  if (!sb) return null
  const { data } = await sb
    .from('tracker_cache')
    .select('payload, fetched_at')
    .eq('riot_id', k)
    .maybeSingle()
  if (!data) return null

  const at = new Date(data.fetched_at).getTime()
  if (Date.now() - at > CACHE_MS) return null

  const perfil = data.payload as PerfilHenrik
  mem.set(k, { at, perfil })
  return perfil
}

export async function gravarPerfil(riotKey: string, perfil: PerfilHenrik) {
  const k = chave(riotKey)
  mem.set(k, { at: Date.now(), perfil })
  if (mem.size > 500) mem.delete(mem.keys().next().value as string)

  const sb = supabaseAdmin()
  if (!sb) return
  try {
    await sb.from('tracker_cache').upsert({
      riot_id: k,
      payload: perfil,
      score: null,
      score_origem: 'rank',
      fetched_at: new Date().toISOString(),
    })
  } catch {
    /* cache e otimizacao, nao pode derrubar a busca */
  }
}
