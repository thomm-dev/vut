'use client'

/** Eventos da secao 11 do plano. */
export type Evento =
  | 'lookup_started'
  | 'lookup_succeeded'
  | 'lookup_failed'
  | 'card_generated'
  | 'card_athlete_changed'
  | 'card_png_downloaded'
  | 'card_link_copied'
  | 'card_page_viewed'
  | 'cta_create_own_clicked'
  | 'whatsapp_group_clicked'

type Props = Record<string, string | number | boolean | null | undefined>

type ComAnalytics = typeof globalThis & {
  posthog?: { capture: (e: string, p?: Props) => void }
  gtag?: (cmd: string, e: string, p?: Props) => void
}

export function track(evento: Evento, props: Props = {}) {
  if (typeof window === 'undefined') return
  const w = window as ComAnalytics
  try {
    w.posthog?.capture(evento, props)
    w.gtag?.('event', evento, props)
  } catch {
    /* analytics nunca derruba a UI */
  }
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[vut:track]', evento, props)
  }
}

/** Nunca mandar o Riot ID cru para o analytics. */
export function hashCurto(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
