/**
 * Prepara os assets locais da carta: recorta, redimensiona e grava em assets/card/.
 *
 * Roda uma vez (ou quando trocar as artes em public/):
 *   node scripts/preparar-assets.mjs
 *
 * O satori recebe os binarios embutidos como data URL, entao vale a pena guardar
 * versoes ja no tamanho de uso — nao faz sentido embutir 2 MB para desenhar em 500px.
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const RAIZ = path.join(import.meta.dirname, '..')
const PUBLIC = path.join(RAIZ, 'public')
const SAIDA = path.join(RAIZ, 'assets', 'card')
// Miniaturas do seletor de atleta: precisam ser servíveis pelo navegador.
const MINIATURAS = path.join(PUBLIC, 'atletas')

await mkdir(SAIDA, { recursive: true })
await mkdir(MINIATURAS, { recursive: true })

/* --------------------------- fotos de jogador ---------------------------- */

const fotos = (await readdir(PUBLIC))
  .filter((f) => /^VUT_PLAYER_\d+\.png$/i.test(f))
  .sort()

if (!fotos.length) throw new Error('Nenhuma VUT_PLAYER_*.png em public/')

/**
 * O recorte do busto termina em corte reto na cintura. Sobre a carta isso vira
 * uma linha dura, entao o alpha da base vai a zero nos ultimos 16% da altura.
 */
async function desvanecerBase(entrada, proporcao = 0.16) {
  const { data, info } = await sharp(entrada)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const faixa = Math.round(height * proporcao)
  for (let y = height - faixa; y < height; y++) {
    const fator = (height - y) / faixa
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4 + 3
      data[i] = Math.round(data[i] * fator)
    }
  }
  // palette: o satori embute o binario como data URL — peso aqui e peso por render
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
    .toBuffer()
}

for (const [i, f] of fotos.entries()) {
  const destino = path.join(SAIDA, `player-${i + 1}.png`)
  const recortada = await sharp(path.join(PUBLIC, f))
    .trim({ threshold: 1 }) // tira a moldura transparente
    .resize({ width: 620, withoutEnlargement: true })
    .png()
    .toBuffer()
  const buf = await desvanecerBase(recortada)
  await writeFile(destino, buf)

  // Mesma arte que vai na carta, pequena, para o seletor não mentir.
  const mini = await sharp(buf)
    .resize({ width: 220, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
  await writeFile(path.join(MINIATURAS, `${i + 1}.webp`), mini)

  const m = await sharp(buf).metadata()
  console.log(
    `player-${i + 1}.png  ${m.width}x${m.height}  ${Math.round(buf.length / 1024)}KB` +
      `  · miniatura ${Math.round(mini.length / 1024)}KB`,
  )
}

/* ------------------------------- logo VUT -------------------------------- */
/* O arquivo vem como letra branca sobre preto SEM alpha (e com marca d'agua   */
/* do Miro no canto). Corta o rodape, usa a luminancia como alpha e recorta.   */

const origemLogo = path.join(PUBLIC, 'vut-logo.png')
const meta = await sharp(origemLogo).metadata()
const alturaUtil = Math.round(meta.height * 0.9) // fora o canto da marca d'agua

const base = sharp(origemLogo).extract({
  left: 0,
  top: 0,
  width: meta.width,
  height: alturaUtil,
})

const alfa = await base.clone().greyscale().raw().toBuffer()

const logo = await sharp({
  create: {
    width: meta.width,
    height: alturaUtil,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .joinChannel(alfa, { raw: { width: meta.width, height: alturaUtil, channels: 1 } })
  .png()
  .toBuffer()

const logoFinal = await sharp(logo)
  .trim({ threshold: 10 })
  .resize({ width: 320, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toBuffer()

await writeFile(path.join(SAIDA, 'vut-logo.png'), logoFinal)
const ml = await sharp(logoFinal).metadata()
console.log(`vut-logo.png  ${ml.width}x${ml.height}  ${Math.round(logoFinal.length / 1024)}KB`)
