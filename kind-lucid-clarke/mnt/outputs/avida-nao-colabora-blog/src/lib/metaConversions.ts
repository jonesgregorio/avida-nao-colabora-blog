import { supabase } from './supabase'

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string }
    _fbq?: Window['fbq']
  }
}

const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID ?? '').trim()
const CONSENT_KEY = 'avnc_marketing_consent_v1'
let initialized = false
let lastPageView = ''

export type MarketingConsent = 'granted' | 'denied' | null

export function marketingConsent(): MarketingConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

export function setMarketingConsent(value: Exclude<MarketingConsent, null>): void {
  try { localStorage.setItem(CONSENT_KEY, value) } catch { /* storage indisponível */ }
}

function cookieValue(name: string): string | null {
  try {
    const prefix = `${name}=`
    const value = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(prefix))
    return value ? decodeURIComponent(value.slice(prefix.length)).slice(0, 300) : null
  } catch {
    return null
  }
}

export function initMetaPixel(): void {
  if (initialized || !PIXEL_ID || typeof window === 'undefined' || marketingConsent() !== 'granted') return
  initialized = true

  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue?.push(args)
  }) as NonNullable<Window['fbq']>
  fbq.queue = []
  fbq.loaded = true
  fbq.version = '2.0'
  window.fbq = fbq
  window._fbq = fbq

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)
  fbq('init', PIXEL_ID)
}

export function trackMetaPageView(): void {
  if (!PIXEL_ID || marketingConsent() !== 'granted') return
  initMetaPixel()
  const pageKey = `${window.location.pathname}${window.location.search}`
  if (lastPageView === pageKey) return
  lastPageView = pageKey
  window.fbq?.('track', 'PageView')
}

export function trackMetaCompleteRegistration(userId: string): void {
  if (marketingConsent() !== 'granted') return
  const eventId = `registration:${userId}`
  if (PIXEL_ID) {
    initMetaPixel()
    window.fbq?.('track', 'CompleteRegistration', { status: true }, { eventID: eventId })
  }

  void supabase.functions.invoke('meta-conversions', {
    body: {
      event_id: eventId,
      event_source_url: window.location.href,
      fbp: cookieValue('_fbp'),
      fbc: cookieValue('_fbc'),
    },
  }).then(({ error }) => {
    if (error && import.meta.env.DEV) console.warn('[meta] CAPI indisponível', error.message)
  }).catch(() => undefined)
}
