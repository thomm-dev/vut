import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type FonteSatori = {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 700 | 800
  style: 'normal'
}

let cache: FonteSatori[] | null = null

/**
 * ImageResponse exige o buffer da fonte — nao da para referenciar por nome.
 * Os arquivos ficam commitados em assets/fonts e a rota roda em runtime nodejs.
 */
export async function fontes(): Promise<FonteSatori[]> {
  if (cache) return cache
  const dir = path.join(process.cwd(), 'assets', 'fonts')
  const pesos: FonteSatori['weight'][] = [400, 600, 700, 800]
  const carregadas = await Promise.all(
    pesos.map(async (w) => {
      const buf = await readFile(path.join(dir, `inter-${w}.woff`))
      return {
        name: 'Inter',
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        weight: w,
        style: 'normal' as const,
      }
    }),
  )
  cache = carregadas
  return cache
}
