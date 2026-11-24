export type TrackerCode =
  | 'NOT_FOUND'
  | 'SEM_COMPETITIVO'
  | 'PRIVATE'
  | 'BLOCKED'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'MOCK'
  | 'UNKNOWN'

export class TrackerError extends Error {
  code: TrackerCode
  constructor(code: TrackerCode, message?: string) {
    super(message ?? code)
    this.code = code
    this.name = 'TrackerError'
  }
}

/** Mensagens da secao 8 — sempre em portugues, sempre acionaveis pelo jogador. */
export const MENSAGENS: Record<string, string> = {
  INVALID_ID: 'Riot ID inválido. O formato é nick#TAG, igual aparece no jogo.',
  NOT_FOUND:
    'Não achamos esse Riot ID. Confere a tag depois do # — é a do jogo, não a do tracker.',
  SEM_COMPETITIVO:
    'Essa conta não tem ranqueada recente. Joga uma competitiva e volta aqui.',
  // So o caminho antigo do tracker.gg tem conceito de perfil privado.
  PRIVATE: 'Seu perfil está privado no tracker. Libera em tracker.gg/valorant e tenta de novo.',
  BLOCKED: 'Muita gente gerando carta agora. Espera alguns segundos e tenta de novo.',
  UNAUTHORIZED: 'Nossa busca de dados está fora do ar. Já estamos vendo isso.',
  TIMEOUT: 'A busca demorou demais. Tenta de novo.',
  LOW_MATCHES: 'Joga mais algumas ranqueadas e volta aqui — precisamos de 10 partidas na temporada.',
  RATE_LIMITED: 'Você gerou muitas cartas na última hora. Tenta mais tarde.',
  // So aparece em dev: MOCK_TRACKER=1 com um Riot ID fora das fixtures.
  MOCK: 'Modo mock ligado no servidor — nenhuma busca real esta sendo feita.',
  UNKNOWN: 'Algo quebrou na busca. Tenta de novo.',
}

/** HTTP de saida por codigo (secao 8 do PLANO-LOOKUP-TRACKER). */
export const STATUS: Record<string, number> = {
  INVALID_ID: 400,
  NOT_FOUND: 404,
  SEM_COMPETITIVO: 422,
  PRIVATE: 403,
  BLOCKED: 503,
  UNAUTHORIZED: 503,
  LOW_MATCHES: 422,
  TIMEOUT: 504,
  MOCK: 501,
  RATE_LIMITED: 429,
  UNKNOWN: 500,
}
