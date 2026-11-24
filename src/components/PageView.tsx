'use client'

import { useEffect } from 'react'
import { track } from '@/lib/analytics'

export function PageView({ slug }: { slug: string }) {
  useEffect(() => {
    track('card_page_viewed', { slug, referrer: document.referrer || 'direto' })
  }, [slug])
  return null
}
