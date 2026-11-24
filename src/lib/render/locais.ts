import 'server-only'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { hashEstavel } from '../hash'

export type AssetLocal = { url: string; largura: number; altura: number }

const DIR = path.join(process.cwd(), 'assets', 'card')

const cache = new Map<string, AssetLocal | null>()

/** Dimensoes do PNG direto do IHDR — evita depender de biblioteca de imagem. */
function dimensoesPng(buf: Buffer) {
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) }
}

async function carregar(arquivo: string): Promise<AssetLocal | null> {
  if (cache.has(arquivo)) return cache.get(arquivo) ?? null
  let asset: AssetLocal | null = null
  try {
    const buf = await readFile(path.join(DIR, arquivo))
    const { largura, altura } = dimensoesPng(buf)
    asset = { url: `data:image/png;base64,${buf.toString('base64')}`, largura, altura }
  } catch {
    console.warn('[vut] asset local ausente:', arquivo, '— rode node scripts/preparar-assets.mjs')
  }
  cache.set(arquivo, asset)
  return asset
}

export const logoVut = () => carregar('vut-logo.png')

let fotos: string[] | null = null

async function listarFotos() {
  if (fotos) return fotos
  try {
    const n = (f: string) => Number(f.match(/\d+/)?.[0] ?? 0)
    fotos = (await readdir(DIR))
      .filter((f) => /^player-\d+\.png$/.test(f))
      .sort((a, b) => n(a) - n(b))
  } catch {
    fotos = []
  }
  return fotos
}

/** Quantos atletas de capa existem hoje. */
export async function totalAtletas() {
  return (await listarFotos()).length
}

/**
 * Foto de capa. Com escolha do dono, usa a escolha; sem escolha, sorteia de
 * forma deterministica pelo Riot ID — nunca aleatorio, senao a carta trocaria
 * de arte entre o preview, o download e o preview do link.
 */
export async function fotoJogador(
  riotId: string,
  atleta?: number | null,
): Promise<AssetLocal | null> {
  const lista = await listarFotos()
  if (!lista.length) return null

  if (atleta != null && Number.isInteger(atleta) && atleta >= 1 && atleta <= lista.length) {
    return carregar(lista[atleta - 1])
  }
  return carregar(lista[hashEstavel(riotId.toLowerCase()) % lista.length])
}
