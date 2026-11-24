import { Home } from '@/components/Home'
import { WHATSAPP } from '@/lib/site'
import { totalCartas } from '@/lib/store'

export const runtime = 'nodejs'
export const preferredRegion = ['gru1']
export const dynamic = 'force-dynamic'

export default async function Pagina() {
  const total = await totalCartas().catch(() => 0)
  return <Home whatsapp={WHATSAPP} total={total} />
}
