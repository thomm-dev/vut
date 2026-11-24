import type { Partida, Jogador } from './tipos'

/** Janela de troca: morte vingada ate 5s depois ainda conta KAST. */
const TRADE_MS = 5000

export type Metricas = {
  /** % de rounds ganhos */
  rw: number
  /** % de rounds com kill, assist, sobrevivencia ou troca */
  kast: number
  /** pontuacao de combate por round */
  acs: number
  /** (dano causado - dano recebido) por round */
  dd: number
  rounds: number
}

type Acumulado = {
  rounds: number
  roundsGanhos: number
  score: number
  dealt: number
  received: number
  kastRounds: number
}

const zero = (): Acumulado => ({
  rounds: 0,
  roundsGanhos: 0,
  score: 0,
  dealt: 0,
  received: 0,
  kastRounds: 0,
})

function finalizar(a: Acumulado): Metricas | null {
  if (a.rounds === 0) return null
  return {
    rw: (a.roundsGanhos / a.rounds) * 100,
    kast: (a.kastRounds / a.rounds) * 100,
    acs: a.score / a.rounds,
    dd: (a.dealt - a.received) / a.rounds,
    rounds: a.rounds,
  }
}

/**
 * KAST por round, a partir da lista de kills da partida:
 * K = matou · A = deu assistencia · S = sobreviveu · T = foi trocado.
 */
function roundsComKast(p: Partida, puuid: string): number {
  const porRound = new Map<number, typeof p.kills>()
  for (const k of p.kills) {
    const lista = porRound.get(k.round)
    if (lista) lista.push(k)
    else porRound.set(k.round, [k])
  }

  const meuTime = p.players.find((j) => j.puuid === puuid)?.team_id
  let total = 0

  for (let r = 0; r < p.rounds.length; r++) {
    const kills = porRound.get(r) ?? []

    const matou = kills.some((k) => k.killer?.puuid === puuid)
    const assistiu = kills.some((k) => k.assistants?.some((a) => a.puuid === puuid))
    const minhaMorte = kills.find((k) => k.victim?.puuid === puuid)

    if (matou || assistiu || !minhaMorte) {
      total++
      continue
    }

    // Trocado: quem me matou morreu logo depois, para um companheiro de time.
    const algoz = minhaMorte.killer?.puuid
    const trocado = kills.some(
      (k) =>
        k.victim?.puuid === algoz &&
        k.time_in_round_in_ms >= minhaMorte.time_in_round_in_ms &&
        k.time_in_round_in_ms - minhaMorte.time_in_round_in_ms <= TRADE_MS &&
        p.players.find((j) => j.puuid === k.killer?.puuid)?.team_id === meuTime,
    )
    if (trocado) total++
  }

  return total
}

function acumularPartida(acc: Acumulado, p: Partida, jogador: Jogador) {
  const time = p.teams.find((t) => t.team_id === jogador.team_id)
  const ganhos = time?.rounds?.won ?? 0
  const perdidos = time?.rounds?.lost ?? 0
  const rodadas = ganhos + perdidos
  if (rodadas === 0) return

  acc.rounds += rodadas
  acc.roundsGanhos += ganhos
  acc.score += jogador.stats?.score ?? 0
  acc.dealt += jogador.stats?.damage?.dealt ?? 0
  acc.received += jogador.stats?.damage?.received ?? 0
  acc.kastRounds += roundsComKast(p, jogador.puuid)
}

/** Metricas do dono do perfil somando todas as partidas da janela. */
export function metricasDoJogador(partidas: Partida[], puuid: string): Metricas | null {
  const acc = zero()
  for (const p of partidas) {
    const eu = p.players.find((j) => j.puuid === puuid)
    if (eu) acumularPartida(acc, p, eu)
  }
  return finalizar(acc)
}

/**
 * Amostra de comparacao: todos os jogadores vistos nas mesmas partidas, um
 * ponto por pessoa (media das partidas dela na janela).
 *
 * Nada disso e gravado — a amostra vive so durante o calculo. O banco nunca
 * recebe stat de terceiro, que e o que separa "o jogador pediu a carta dele"
 * de "montamos um banco com dados de quem nao pediu nada".
 */
export function amostraDoLobby(partidas: Partida[]): Map<string, Metricas> {
  const porJogador = new Map<string, Acumulado>()

  for (const p of partidas) {
    for (const j of p.players) {
      if (!j.puuid) continue
      let acc = porJogador.get(j.puuid)
      if (!acc) {
        acc = zero()
        porJogador.set(j.puuid, acc)
      }
      acumularPartida(acc, p, j)
    }
  }

  const saida = new Map<string, Metricas>()
  for (const [puuid, acc] of porJogador) {
    const m = finalizar(acc)
    if (m) saida.set(puuid, m)
  }
  return saida
}

/** Fracao da amostra que ficou abaixo do valor, em 0-100. */
export function percentilNaAmostra(valor: number, amostra: number[]): number {
  if (amostra.length < 2) return 50
  const abaixo = amostra.filter((v) => v < valor).length
  return Math.round((abaixo / amostra.length) * 100)
}

/** Agente mais jogado na janela, pelo numero de partidas. */
export function agenteMaisJogado(partidas: Partida[], puuid: string) {
  const contagem = new Map<string, { nome: string; id: string; n: number }>()
  for (const p of partidas) {
    const eu = p.players.find((j) => j.puuid === puuid)
    const nome = eu?.agent?.name
    const id = eu?.agent?.id
    if (!nome || !id) continue
    const atual = contagem.get(nome) ?? { nome, id, n: 0 }
    atual.n++
    contagem.set(nome, atual)
  }
  return [...contagem.values()].sort((a, b) => b.n - a.n)[0] ?? null
}
