import 'server-only'
import { createHash } from 'node:crypto'

/** Nunca guardar o IP cru. SHA-256 do IP + salt. */
export function ipHash(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0'
  const salt = process.env.IP_HASH_SALT ?? 'vut-dev-salt'
  return createHash('sha256').update(ip + salt).digest('hex').slice(0, 32)
}

const buckets = new Map<string, number[]>()

/** 5 cartas por hora por ip_hash (checklist, secao 10). */
export function consumir(key: string, limite = 5, janelaMs = 3_600_000) {
  const agora = Date.now()
  const hits = (buckets.get(key) ?? []).filter((t) => agora - t < janelaMs)
  if (hits.length >= limite) {
    return { ok: false as const, resetEm: janelaMs - (agora - hits[0]) }
  }
  hits.push(agora)
  buckets.set(key, hits)
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string)
  return { ok: true as const, restante: limite - hits.length }
}
