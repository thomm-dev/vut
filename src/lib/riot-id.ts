export type RiotId = {
  /** Como vai para a tela e para o banco, já normalizado: `nick#TAG`. */
  display: string
  nick: string
  tag: string
  /** Chave canônica de cache e índice. */
  key: string
  /** Segmento único de URL (tracker.gg): `Zé Duarte#BRL` -> `Z%C3%A9%20Duarte%23BRL` */
  encoded: string
}

/**
 * Nick do Valorant aceita espaço, acento e pontuação — "Zé Duarte#BRL" é um
 * Riot ID legítimo. A única coisa que o nick não pode ter é o próprio `#`.
 *
 * A validação aqui existe só para pegar erro óbvio de digitação antes de
 * gastar uma chamada; quem decide se a conta existe é a API.
 */
const NICK_MIN = 3
const NICK_MAX = 16
const TAG_RE = /^[^\s#]{3,5}$/

export function parseRiotId(input: unknown): RiotId | null {
  if (typeof input !== 'string') return null

  // Normaliza em NFC e colapsa espaços repetidos, mas preserva os internos.
  const limpo = input.normalize('NFC').replace(/\s+/g, ' ').trim()

  const i = limpo.indexOf('#')
  if (i < 0) return null

  // Trim nas duas partes: muita gente copia "Zé Duarte #BRL" com espaço antes do #.
  const nick = limpo.slice(0, i).trim()
  const tag = limpo.slice(i + 1).trim()

  if (nick.length < NICK_MIN || nick.length > NICK_MAX) return null
  if (nick.includes('#') || tag.includes('#')) return null
  if (!TAG_RE.test(tag)) return null

  const display = `${nick}#${tag}`
  return {
    display,
    nick,
    tag,
    key: display.toLowerCase(),
    encoded: encodeURIComponent(display),
  }
}

/** Validação para o cliente — mesma regra do servidor, sem duplicar regex. */
export function riotIdValido(input: string) {
  return parseRiotId(input) !== null
}

/**
 * Tira caracteres de controle e de direção de texto (bidi override serve para
 * disfarçar nome) e limita o tamanho.
 *
 * Pontuação legítima fica: apóstrofo, acento e cedilha são parte de nome de
 * gente, e nem o React nem o satori interpretam o texto como marcação.
 */
export function sanitizeText(s: string, max = 24): string {
  return s
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .slice(0, max)
    .trim()
}
