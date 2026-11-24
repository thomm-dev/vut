import 'server-only'
import { customAlphabet } from 'nanoid'
import { supabaseAdmin } from './supabase'
import { corDoTier } from './tier'
import type { CardData, Stat, TierKey } from './types'

const novoSlug = customAlphabet('abcdefghijkmnpqrstuvwxyz23456789', 8)

type NovaCarta = Omit<CardData, 'slug' | 'serialNum' | 'createdAt'>

/* ------------------------- serializacao de linha ------------------------- */

function statRow(s: Stat) {
  return { v: s.value, p: s.percentile }
}

function pct(v: number) {
  return `${v.toFixed(1)}%`
}

function rowToCard(r: Record<string, any>): CardData {
  const mk = (v: number, p: number, display: string): Stat => ({
    value: Number(v ?? 0),
    percentile: Number(p ?? 0),
    display,
  })
  return {
    slug: r.slug,
    riotId: r.riot_id,
    nick: r.nick,
    tag: r.tag,
    pais: r.pais ?? null,
    tipo: r.tipo,
    rankNome: r.rank_nome ?? null,
    rankIcon: r.rank_icon ?? null,
    peakNome: r.peak_nome ?? null,
    peakIcon: r.peak_icon ?? null,
    timeLogo: r.time_logo ?? null,
    trackerScore: r.tracker_score ?? null,
    scoreOrigem: r.score_origem ?? null,
    agente: r.agente ?? null,
    agenteIcon: r.agente_icon ?? null,
    agenteHero: r.agente_hero ?? null,
    agenteRole: r.agente_role ?? null,
    atleta: r.atleta ?? null,
    overall: r.overall,
    percentil: Number(r.percentil ?? 0),
    tier: r.tier as TierKey,
    cor: corDoTier(r.tier as TierKey),
    stats: {
      rw: mk(r.rw, r.rw_p, pct(Number(r.rw ?? 0))),
      kast: mk(r.kast, r.kast_p, pct(Number(r.kast ?? 0))),
      acs: mk(r.acs, r.acs_p, Number(r.acs ?? 0).toFixed(1)),
      dd: mk(r.dd, r.dd_p, String(Math.round(Number(r.dd ?? 0)))),
    },
    partidas: r.partidas ?? 0,
    temporada: r.temporada ?? null,
    serie: r.serie ?? 1,
    serialNum: Number(r.serial_num ?? 0),
    createdAt: r.created_at ?? new Date().toISOString(),
  }
}

function cardToRow(c: NovaCarta, slug: string, ipHash: string | null) {
  return {
    slug,
    riot_id: c.riotId,
    nick: c.nick,
    tag: c.tag,
    pais: c.pais,
    tipo: c.tipo,
    rank_nome: c.rankNome,
    rank_icon: c.rankIcon,
    peak_nome: c.peakNome,
    peak_icon: c.peakIcon,
    time_logo: c.timeLogo,
    tracker_score: c.trackerScore,
    score_origem: c.scoreOrigem,
    agente: c.agente,
    agente_icon: c.agenteIcon,
    agente_hero: c.agenteHero,
    agente_role: c.agenteRole,
    atleta: c.atleta,
    overall: c.overall,
    percentil: c.percentil,
    tier: c.tier,
    rw: statRow(c.stats.rw).v,
    rw_p: statRow(c.stats.rw).p,
    kast: statRow(c.stats.kast).v,
    kast_p: statRow(c.stats.kast).p,
    acs: statRow(c.stats.acs).v,
    acs_p: statRow(c.stats.acs).p,
    dd: statRow(c.stats.dd).v,
    dd_p: statRow(c.stats.dd).p,
    partidas: c.partidas,
    temporada: c.temporada,
    serie: c.serie,
    ip_hash: ipHash,
  }
}

/* ------------------------- fallback em memoria --------------------------- */
/* Sem chaves do Supabase (dev) o app roda inteiro aqui. Some no restart.    */

type Memoria = { cartas: Map<string, CardData>; serial: number }

const g = globalThis as typeof globalThis & { __vutMemoria?: Memoria }
// globalThis: em dev cada rota pode ter sua propria instancia do modulo.
g.__vutMemoria ??= { cartas: new Map<string, CardData>(), serial: 1 }
const memoria = g.__vutMemoria.cartas

/* --------------------------------- API ----------------------------------- */

/**
 * Um Riot ID gera uma carta por serie: buscar de novo atualiza a carta
 * existente em vez de criar outra — preserva o link ja compartilhado.
 */
export async function salvarCarta(c: NovaCarta, ipHash: string | null): Promise<CardData> {
  const sb = supabaseAdmin()

  if (!sb) {
    const existente = [...memoria.values()].find(
      (x) => x.riotId.toLowerCase() === c.riotId.toLowerCase() && x.serie === c.serie,
    )
    const carta: CardData = {
      ...c,
      slug: existente?.slug ?? novoSlug(),
      serialNum: existente?.serialNum ?? g.__vutMemoria!.serial++,
      createdAt: existente?.createdAt ?? new Date().toISOString(),
    }
    memoria.set(carta.slug, carta)
    return carta
  }

  const { data: atual } = await sb
    .from('cards')
    .select('slug')
    .eq('riot_key', c.riotId.toLowerCase())
    .eq('serie', c.serie)
    .maybeSingle()

  if (atual?.slug) {
    const { data, error } = await sb
      .from('cards')
      .update(cardToRow(c, atual.slug, ipHash))
      .eq('slug', atual.slug)
      .select()
      .single()
    if (error) throw error
    return rowToCard(data)
  }

  const { data, error } = await sb
    .from('cards')
    .insert(cardToRow(c, novoSlug(), ipHash))
    .select()
    .single()
  if (error) throw error
  return rowToCard(data)
}

export async function getCarta(slug: string): Promise<CardData | null> {
  const sb = supabaseAdmin()
  if (!sb) return memoria.get(slug) ?? null
  const { data } = await sb.from('cards').select('*').eq('slug', slug).maybeSingle()
  return data ? rowToCard(data) : null
}

/**
 * Troca o atleta de capa. A carta e publica pelo slug, a edicao nao: so passa
 * quem tem o mesmo hash de IP gravado na criacao (nunca o IP cru).
 *
 * No store em memoria (dev, sem Supabase) nao ha ip_hash guardado, entao a
 * checagem nao acontece — a protecao real existe com banco.
 */
export async function trocarAtleta(
  slug: string,
  atleta: number | null,
  ipHash: string,
): Promise<CardData | null> {
  const sb = supabaseAdmin()

  if (!sb) {
    const atual = memoria.get(slug)
    if (!atual) return null
    const nova = { ...atual, atleta }
    memoria.set(slug, nova)
    return nova
  }

  const { data: dono } = await sb.from('cards').select('ip_hash').eq('slug', slug).maybeSingle()
  if (!dono) return null
  if (dono.ip_hash && dono.ip_hash !== ipHash) return null

  const { data, error } = await sb
    .from('cards')
    .update({ atleta })
    .eq('slug', slug)
    .select()
    .single()
  if (error) throw error
  return rowToCard(data)
}

export async function cartasRecentes(limite = 24): Promise<CardData[]> {
  const sb = supabaseAdmin()
  if (!sb) {
    return [...memoria.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limite)
  }
  const { data } = await sb
    .from('cards')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)
  return (data ?? []).map(rowToCard)
}

/**
 * Rate limit duravel: em serverless o balde em memoria vive por instancia,
 * entao conta tambem as cartas criadas por esse ip_hash na ultima hora.
 */
export async function cartasNaUltimaHora(ipHash: string): Promise<number> {
  const sb = supabaseAdmin()
  if (!sb) return 0
  const desde = new Date(Date.now() - 3_600_000).toISOString()
  const { count } = await sb
    .from('cards')
    .select('slug', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', desde)
  return count ?? 0
}

export async function totalCartas(): Promise<number> {
  const sb = supabaseAdmin()
  if (!sb) return memoria.size
  const { count } = await sb.from('cards').select('slug', { count: 'exact', head: true })
  return count ?? 0
}
