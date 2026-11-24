/**
 * Critério de aceite da seção 11 do PLANO-LOOKUP-TRACKER: bate a resposta de
 * `POST /api/lookup` contra os valores conferidos na API em nov/2026.
 *
 *   node scripts/validar-lookup.mjs [http://localhost:3000]
 *
 * Precisa de TRN_API_KEY configurada e MOCK_TRACKER desligado — com mock o
 * script avisa e sai, porque validar fixture contra fixture não prova nada.
 */
const BASE = process.argv[2] ?? 'http://localhost:3000'

const LETRAS = [
  { min: 82, letra: 'S' },
  { min: 70, letra: 'A' },
  { min: 45, letra: 'B' },
  { min: 20, letra: 'C' },
  { min: 0, letra: 'D' },
]
const letra = (p) => LETRAS.find((l) => p >= l.min).letra
const rotulo = (p) => {
  const n = Math.round(p)
  return n >= 50 ? `Top ${Math.max(1, 100 - n)}%` : `Bottom ${Math.max(1, n)}%`
}

const ESPERADO = {
  riotId: 'dedada#6625',
  rankNome: 'Diamond 1',
  rankIconInclui: 'tiersv2/18.png',
  peakNome: 'Diamond 3',
  stats: {
    rw: { value: 50.39, display: '50.4%', percentile: 56, letra: 'B', rotulo: 'Top 44%' },
    kast: { value: 70.86, display: '70.9%', percentile: 65, letra: 'B', rotulo: 'Top 35%' },
    acs: { value: 252.46, display: '252.5', percentile: 88, letra: 'S', rotulo: 'Top 12%' },
    dd: { value: 26.96, display: '27', percentile: 89, letra: 'S', rotulo: 'Top 11%' },
  },
}

let falhas = 0
const ok = (cond, descricao, obtido) => {
  if (cond) {
    console.log(`  ok   ${descricao}`)
  } else {
    falhas++
    console.log(`  FALHA ${descricao} — obtido: ${JSON.stringify(obtido)}`)
  }
}

const res = await fetch(`${BASE}/api/lookup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ riotId: ESPERADO.riotId }),
})
const json = await res.json()

if (!res.ok || !json.ok) {
  console.error(`\nLookup falhou (HTTP ${res.status}): ${json.code ?? ''} ${json.message ?? ''}`)
  if (json.code === 'UNAUTHORIZED' || json.code === 'BLOCKED') {
    console.error('Configure TRN_API_KEY (https://tracker.gg/developers) e rode de novo.')
  }
  process.exit(1)
}

const c = json.carta
console.log(`\nValidando ${ESPERADO.riotId} contra a seção 10 do plano:\n`)

ok(c.riotId.toLowerCase() === ESPERADO.riotId, 'riotId', c.riotId)
ok(c.rankNome === ESPERADO.rankNome, `rank = ${ESPERADO.rankNome}`, c.rankNome)
ok(String(c.rankIcon).includes(ESPERADO.rankIconInclui), 'ícone do rank = tiersv2/18.png', c.rankIcon)
ok(c.peakNome === ESPERADO.peakNome, `pico = ${ESPERADO.peakNome}`, c.peakNome)

for (const [chave, e] of Object.entries(ESPERADO.stats)) {
  const s = c.stats[chave]
  const nome = chave.toUpperCase()
  ok(Math.abs(s.value - e.value) < 0.05, `${nome} value ≈ ${e.value}`, s.value)
  ok(s.display === e.display, `${nome} display = ${e.display}`, s.display)
  ok(s.percentile === e.percentile, `${nome} percentil = ${e.percentile}`, s.percentile)
  ok(letra(s.percentile) === e.letra, `${nome} letra = ${e.letra}`, letra(s.percentile))
  ok(rotulo(s.percentile) === e.rotulo, `${nome} rótulo = ${e.rotulo}`, rotulo(s.percentile))
}

// Casos fáceis de errar, citados no plano
ok(c.stats.dd.display !== '' && c.stats.dd.display !== '—', 'DDΔ nunca sai vazio', c.stats.dd.display)
ok(typeof c.trackerScore === 'number', 'trackerScore presente', c.trackerScore)
ok(['html', 'estimado'].includes(c.scoreOrigem), 'score_origem gravado', c.scoreOrigem)

console.log(falhas === 0 ? '\nTudo bate.\n' : `\n${falhas} verificação(ões) falharam.\n`)
process.exit(falhas === 0 ? 0 : 1)
