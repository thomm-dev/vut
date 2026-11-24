import 'server-only'

/**
 * Assets vêm do valorant-api.com (CDN comunitário de assets do jogo, sem chave).
 * Evita depender do CDN do tracker.gg, que não serve mais a nossa busca.
 */
const EPISODIO_PADRAO = '03621f52-342b-cf4e-4f86-9350a49c6d04'

let episodio: string | null = null
let buscando: Promise<string> | null = null

/** O último conjunto de competitive tiers; o número do tier é o id que o Henrik devolve. */
async function episodioAtual(): Promise<string> {
  if (episodio) return episodio
  if (buscando) return buscando

  buscando = (async () => {
    try {
      const res = await fetch('https://valorant-api.com/v1/competitivetiers', {
        signal: AbortSignal.timeout(8000),
        cache: 'force-cache',
      })
      const json = (await res.json()) as { data?: { uuid: string }[] }
      const ultimo = json.data?.at(-1)?.uuid
      episodio = ultimo ?? EPISODIO_PADRAO
    } catch {
      episodio = EPISODIO_PADRAO
    } finally {
      buscando = null
    }
    return episodio
  })()

  return buscando
}

export async function iconeRank(tierId: number | null | undefined): Promise<string | null> {
  if (tierId === null || tierId === undefined || tierId < 0) return null
  const ep = await episodioAtual()
  return `https://media.valorant-api.com/competitivetiers/${ep}/${tierId}/largeicon.png`
}

export function iconeAgente(agenteId: string | null | undefined): string | null {
  return agenteId ? `https://media.valorant-api.com/agents/${agenteId}/displayicon.png` : null
}

/**
 * `region` do Henrik é região de servidor (na, eu, ap, kr, br, latam), não país.
 * Só vira bandeira quando a região é um país de verdade.
 */
export function paisPorRegiao(region: string | null | undefined): string | null {
  return region?.toLowerCase() === 'br' ? 'br' : null
}
