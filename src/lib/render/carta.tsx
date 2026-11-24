import 'server-only'
import { ImageResponse } from 'next/og'
import type { CSSProperties } from 'react'
import { dataUrl, flagUrl, imgsvc, svgDataUrl } from '../assets'
import type { CardData } from '../types'
import { fontes } from './fonts'
import { fotoJogador, logoVut } from './locais'

export const LARGURA = 600
export const ALTURA = 840

/* Coluna da direita: agente em cima (centro alinhado com a caixa do overall,
 * ambos em y=61) e rank logo abaixo, com o mesmo respiro de 12px do resto. */
const AGENTE_Y = 25
const RANK_Y = AGENTE_Y + 72 + 12

/* ------------------------------- helpers -------------------------------- */

function rgba(hex: string, a: number) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/** Encolhe o nick longo: min(44, 370 / (len * 0.60)). */
function tamanhoNick(nick: string) {
  return Math.max(20, Math.min(44, 370 / Math.max(1, nick.length * 0.6)))
}

/** Silhueta padrao quando o agente nao tem arte — coordenadas da secao 5. */
const SILHUETA = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
    <g fill="#8f959e" fill-opacity="0.9">
      <ellipse cx="300" cy="330" rx="76" ry="88"/>
      <path d="M300 442 L151 606 L449 606 Z"/>
    </g>
  </svg>`,
)

/* Marcacao de canto: o mesmo detalhe dos paineis da LP (.painel::before /
 * ::after), aqui nos quatro cantos e na cor do tier. */
const CANTO = { tamanho: 18, traco: 2, recuo: 19 }

function canto(vertical: 'cima' | 'baixo', horizontal: 'esq' | 'dir', cor: string) {
  const { tamanho, traco, recuo } = CANTO
  const style: CSSProperties = {
    position: 'absolute',
    width: tamanho,
    height: tamanho,
    display: 'flex',
    borderStyle: 'solid',
    borderColor: cor,
    borderWidth: 0,
    [vertical === 'cima' ? 'top' : 'bottom']: recuo,
    [horizontal === 'esq' ? 'left' : 'right']: recuo,
    [vertical === 'cima' ? 'borderTopWidth' : 'borderBottomWidth']: traco,
    [horizontal === 'esq' ? 'borderLeftWidth' : 'borderRightWidth']: traco,
  }
  return <div style={style} />
}

const abs = (
  left: number,
  top: number,
  width: number,
  height: number,
  extra: CSSProperties = {},
): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
  height,
  display: 'flex',
  ...extra,
})

/* ------------------------------- assets --------------------------------- */

async function carregarAssets(c: CardData) {
  const [jogador, logo, agente, rank, bandeira] = await Promise.all([
    fotoJogador(c.riotId, c.atleta),
    logoVut(),
    dataUrl(c.agenteIcon ? imgsvc(c.agenteIcon, 144) : null),
    dataUrl(c.rankIcon ? imgsvc(c.rankIcon, 144) : null),
    dataUrl(c.pais ? flagUrl(c.pais) : null),
  ])
  return { jogador, logo, agente, rank, bandeira }
}

/**
 * A foto encosta na linha do nome: o busto fica ancorado embaixo e centralizado,
 * entao artes de proporcoes diferentes nao flutuam no meio da carta.
 */
const FOTO = { maxLargura: 520, maxAltura: 500, base: 622 }

function geometriaFoto(largura: number, altura: number) {
  const escala = Math.min(FOTO.maxLargura / largura, FOTO.maxAltura / altura)
  const w = Math.round(largura * escala)
  const h = Math.round(altura * escala)
  return { w, h, left: Math.round((LARGURA - w) / 2), top: FOTO.base - h }
}

/* ------------------------------- layout --------------------------------- */

type Linha = { label: string; valor: string; destaque: boolean }

/** Uma coluna de stat. Elemento solto: satori nao gosta de arrays aninhados. */
function colStat(l: Linha, left: number, width: number, top: number, cor: string) {
  return (
    <div
      style={abs(left, top, width, 32, {
        alignItems: 'center',
        justifyContent: 'space-between',
      })}
    >
      <span style={{ fontSize: 21, fontWeight: 700, color: '#767f8d' }}>{l.label}</span>
      <span style={{ fontSize: 26, fontWeight: 800, color: l.destaque ? cor : '#ffffff' }}>
        {l.valor}
      </span>
    </div>
  )
}

export async function cartaJsx(c: CardData) {
  const a = await carregarAssets(c)
  const foto = a.jogador ? geometriaFoto(a.jogador.largura, a.jogador.altura) : null
  const cor = c.cor
  const nickSize = tamanhoNick(c.nick)
  const verificada = c.tipo !== 'manual'

  return (
    <div
      style={{
        width: LARGURA,
        height: ALTURA,
        display: 'flex',
        position: 'relative',
        backgroundColor: cor,
        fontFamily: 'Inter',
      }}
    >
      {/* interior */}
      <div style={abs(5, 5, 590, 830, { backgroundColor: '#0b0d10' })} />

      {/* marcacao de canto */}
      {canto('cima', 'esq', cor)}
      {canto('cima', 'dir', cor)}
      {canto('baixo', 'esq', cor)}
      {canto('baixo', 'dir', cor)}

      {/* gradiente da cor, tres paradas para nao cortar duro no rodape */}
      <div
        style={abs(5, 190, 590, 460, {
          backgroundImage: `linear-gradient(180deg, ${rgba(cor, 0)} 0%, ${rgba(cor, 0.3)} 72%, ${rgba(cor, 0)} 100%)`,
        })}
      />

      {/* jogador: arte do VUT sorteada pelo Riot ID */}
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.jogador!.url}
          alt=""
          width={foto.w}
          height={foto.h}
          style={{ position: 'absolute', left: foto.left, top: foto.top }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={SILHUETA} alt="" width={600} height={840} style={{ position: 'absolute', left: 0, top: 0 }} />
      )}

      {/* overall */}
      <div
        style={abs(26, 22, 90, 78, {
          borderRadius: 9,
          backgroundColor: 'rgba(0,0,0,0.5)',
          borderWidth: 2.5,
          borderStyle: 'solid',
          borderColor: cor,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <span style={{ fontSize: 45, fontWeight: 800, color: '#ffffff' }}>{c.overall}</span>
      </div>

      {/* marca do VUT */}
      {a.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.logo.url}
          alt=""
          width={88}
          height={Math.round((88 * a.logo.altura) / a.logo.largura)}
          style={{ position: 'absolute', left: 35, top: 120 }}
        />
      )}

      {/* agente — sem moldura: so o icone */}
      {a.agente && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.agente}
          alt=""
          width={68}
          height={68}
          style={{
            position: 'absolute',
            left: 486,
            top: AGENTE_Y + 2,
            objectFit: 'cover',
          }}
        />
      )}

      {/* rank */}
      {a.rank && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.rank}
          alt=""
          width={68}
          height={68}
          style={{
            position: 'absolute',
            left: 486,
            top: a.agente ? RANK_Y : AGENTE_Y,
            objectFit: 'contain',
          }}
        />
      )}

      {/* nome: bandeira + nick, centralizados como grupo */}
      <div style={abs(0, 636, 600, 36, { alignItems: 'center', justifyContent: 'center' })}>
        {a.bandeira && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.bandeira} alt="" width={42} height={30} style={{ objectFit: 'contain', marginRight: 14 }} />
        )}
        <span style={{ fontSize: nickSize, fontWeight: 800, color: '#ffffff', letterSpacing: -0.5 }}>
          {c.nick}
        </span>
        <span
          style={{
            fontSize: Math.round(nickSize * 0.6),
            fontWeight: 700,
            color: '#767f8d',
            marginLeft: 10,
          }}
        >
          {c.tag}
        </span>
      </div>

      {/* divisor */}
      <div style={abs(42, 696, 516, 1.4, { backgroundColor: '#1a1e25' })} />

      {/* stats 2x2 — coluna esquerda na cor, direita em branco */}
      {colStat({ label: 'RW', valor: c.stats.rw.display, destaque: true }, 50, 236, 718, cor)}
      {colStat({ label: 'KAST', valor: c.stats.kast.display, destaque: false }, 318, 234, 718, cor)}
      {colStat({ label: 'ACS', valor: c.stats.acs.display, destaque: true }, 50, 236, 770, cor)}
      {colStat({ label: 'DDΔ', valor: c.stats.dd.display, destaque: false }, 318, 234, 770, cor)}

      {/* selo so nas cartas de fallback manual */}
      {!verificada && (
        <div
          style={abs(26, 166, 170, 26, {
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderStyle: 'solid',
            borderColor: '#e05a5a',
            borderRadius: 4,
          })}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e05a5a', letterSpacing: 1.5 }}>
            NÃO VERIFICADA
          </span>
        </div>
      )}
    </div>
  )
}

export async function cartaImageResponse(c: CardData) {
  return new ImageResponse(await cartaJsx(c), {
    width: LARGURA,
    height: ALTURA,
    fonts: await fontes(),
  })
}
