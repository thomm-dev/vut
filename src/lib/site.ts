export const SITE =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

export const WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_GROUP ?? ''

export const NOME = 'VUT'
export const DESCRICAO = 'Prove seu valor na ranqueada, gere sua carta e compartilhe.'

/** URL do PNG da carta — a mesma para preview, download e og:image. */
export function urlCarta(slug: string, v?: string | number, download = false) {
  const q = new URLSearchParams({ slug })
  if (v !== undefined) q.set('v', String(v))
  if (download) q.set('dl', '1')
  return `/api/card?${q.toString()}`
}

/** Muda quando algo visivel na carta muda — e o que invalida o cache do PNG. */
export function versaoCarta(c: {
  overall: number
  trackerScore: number | null
  atleta: number | null
}) {
  return `${c.overall}-${c.trackerScore ?? 0}-${c.atleta ?? 'h'}`
}

export function urlPublica(slug: string) {
  return `${SITE}/c/${slug}`
}

export function pad(n: number, casas = 5) {
  return String(n).padStart(casas, '0')
}
