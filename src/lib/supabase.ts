import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let admin: SupabaseClient | null | undefined

/**
 * Cliente de servico. Retorna null quando as chaves nao estao no ambiente —
 * nesse caso o app roda inteiro em memoria (dev), sem quebrar.
 */
export function supabaseAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  admin =
    url && key
      ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null
  if (!admin && process.env.NODE_ENV !== 'production') {
    console.warn('[vut] Supabase sem chaves — usando store em memoria (dev).')
  }
  return admin
}

export const temSupabase = () => supabaseAdmin() !== null
