import 'server-only'

const SVC = 'https://imgsvc.trackercdn.com/url'

const TRACKER_HOSTS = ['trackercdn.com', 'titles.trackercdn.com']

/**
 * Redimensionador do proprio tracker. So aceita origens dele
 * (trackercdn.com, titles.trackercdn.com) — owcdn.net e rejeitado.
 * So reduz, nunca amplia.
 */
export function imgsvc(url: string, maxWidth = 144, quality = 100) {
  try {
    const host = new URL(url).hostname
    if (!TRACKER_HOSTS.some((h) => host === h || host.endsWith('.' + h))) return url
  } catch {
    return url
  }
  return `${SVC}/max-width(${maxWidth}),quality(${quality})/${encodeURIComponent(url)}/image.png`
}

/**
 * Satori decodifica png, jpeg, gif e svg — webp e avif quebram a renderizacao
 * inteira. Confere os bytes em vez de confiar no content-type.
 */
function tipoPorBytes(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 16))
  const eq = (i: number, bytes: number[]) => bytes.every((v, k) => b[i + k] === v)
  if (eq(0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (eq(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (eq(0, [0x47, 0x49, 0x46])) return 'image/gif'
  const texto = new TextDecoder().decode(b).trimStart()
  if (texto.startsWith('<svg') || texto.startsWith('<?xml')) return 'image/svg+xml'
  return null
}

const cache = new Map<string, { buf: ArrayBuffer; type: string }>()
const inflight = new Map<string, Promise<{ buf: ArrayBuffer; type: string } | null>>()

/**
 * Nenhum dos CDNs manda Access-Control-Allow-Origin, entao o pipeline inteiro de
 * imagem vive no servidor: baixa o binario aqui e embute como data URL no satori.
 * Sao poucos arquivos e praticamente imutaveis -> cache em memoria por instancia.
 */
export async function getAsset(url: string): Promise<{ buf: ArrayBuffer; type: string } | null> {
  const hit = cache.get(url)
  if (hit) return hit
  const pending = inflight.get(url)
  if (pending) return pending

  const p = (async () => {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': BROWSER_UA,
          // Sem avif/webp: os CDNs negociam conteudo e o satori so decodifica
          // png, jpeg, gif e svg.
          accept: 'image/png,image/jpeg;q=0.9,image/gif;q=0.8,image/svg+xml;q=0.8',
        },
        signal: AbortSignal.timeout(6000),
        cache: 'force-cache',
      })
      if (!res.ok) return null
      const buf = await res.arrayBuffer()
      if (buf.byteLength === 0) return null
      const type = tipoPorBytes(buf)
      if (!type) {
        console.warn('[vut] formato de imagem nao suportado pelo satori:', url)
        return null
      }
      const entry = { buf, type }
      if (cache.size < 300) cache.set(url, entry)
      return entry
    } catch {
      return null
    } finally {
      inflight.delete(url)
    }
  })()

  inflight.set(url, p)
  return p
}

export async function dataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null
  const a = await getAsset(url)
  if (!a) return null
  return `data:${a.type};base64,${Buffer.from(a.buf).toString('base64')}`
}

export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/** Bandeira do pais (so quando o tracker informa o pais). */
export function flagUrl(cc: string) {
  return `https://flagcdn.com/w80/${cc.toLowerCase()}.png`
}
