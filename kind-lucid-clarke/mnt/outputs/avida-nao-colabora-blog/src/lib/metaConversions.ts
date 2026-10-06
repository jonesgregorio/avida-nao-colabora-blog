import { supabase } from './supabase'
import { trackEvent } from './analytics'

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string }
    _fbq?: Window['fbq']
  }
}

const PIXEL_ID = String(import.meta.env.VITE_META_PIXEL_ID ?? '').trim()
const CONSENT_KEY = 'avnc_marketing_consent_v1'
const PENDING_REGISTRATION_KEY = 'avnc_meta_registration_pending_v1'
const BROWSER_REGISTRATION_KEY = 'avnc_meta_registration_browser_v1'
const SERVER_REGISTRATION_KEY = 'avnc_meta_registration_server_v1'
let initialized = false
let lastPageView = ''

interface RegistrationPayload {
  event_id: string
  event_source_url: string
  fbp: string | null
  fbc: string | null
}

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

function registrationStorageKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`
}

function readRegistrationPayload(userId: string): RegistrationPayload | null {
  try {
    const value = localStorage.getItem(registrationStorageKey(PENDING_REGISTRATION_KEY, userId))
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<RegistrationPayload>
    return parsed.event_id === `registration:${userId}` && typeof parsed.event_source_url === 'string'
      ? {
          event_id: parsed.event_id,
          event_source_url: parsed.event_source_url.slice(0, 500),
          fbp: typeof parsed.fbp === 'string' ? parsed.fbp.slice(0, 300) : null,
          fbc: typeof parsed.fbc === 'string' ? parsed.fbc.slice(0, 300) : null,
        }
      : null
  } catch {
    return null
  }
}

function registrationPayload(userId: string): RegistrationPayload {
  const eventId = `registration:${userId}`
  const saved = readRegistrationPayload(userId)
  const payload: RegistrationPayload = {
    event_id: eventId,
    // Preserva a página da criação da conta para a atribuição do envio posterior via CAPI.
    event_source_url: saved?.event_source_url || window.location.href,
    fbp: saved?.fbp || cookieValue('_fbp'),
    fbc: saved?.fbc || cookieValue('_fbc'),
  }
  try {
    localStorage.setItem(registrationStorageKey(PENDING_REGISTRATION_KEY, userId), JSON.stringify(payload))
  } catch { /* storage indisponível */ }
  return payload
}

function registrationWasSent(prefix: string, userId: string): boolean {
  try { return localStorage.getItem(registrationStorageKey(prefix, userId)) === '1' } catch { return false }
}

function markRegistrationSent(prefix: string, userId: string): void {
  try { localStorage.setItem(registrationStorageKey(prefix, userId), '1') } catch { /* storage indisponível */ }
}

function sendBrowserRegistrationOnce(userId: string, payload: RegistrationPayload): boolean {
  if (!PIXEL_ID || registrationWasSent(BROWSER_REGISTRATION_KEY, userId)) return false
  initMetaPixel()
  window.fbq?.('track', 'CompleteRegistration', { content_name: 'Conta criada', status: true }, { eventID: payload.event_id })
  markRegistrationSent(BROWSER_REGISTRATION_KEY, userId)
  return true
}

/**
 * Marca a conversão quando a conta realmente é criada, alinhada ao cadastro exibido no admin.
 * Para e-mail/senha ainda não existe sessão autenticada, então esta etapa envia somente o Pixel.
 */
export function trackMetaRegistrationCreated(userId: string): void {
  if (marketingConsent() !== 'granted') return
  const payload = registrationPayload(userId)
  if (sendBrowserRegistrationOnce(userId, payload)) {
    trackEvent('meta_conversion_delivery', {
      user_id: userId,
      metadata: { channel: 'browser', status: 'queued', event: 'CompleteRegistration' },
    })
  }
}

/**
 * Com uma sessão confirmada, completa ou repete com segurança o envio pelo servidor.
 * Pixel e CAPI usam o mesmo event_id para que a Meta deduplique os dois canais.
 */
export function trackMetaCompleteRegistration(userId: string): void {
  if (marketingConsent() !== 'granted') return
  const payload = registrationPayload(userId)
  sendBrowserRegistrationOnce(userId, payload)
  if (registrationWasSent(SERVER_REGISTRATION_KEY, userId)) return

  void supabase.functions.invoke('meta-conversions', {
    body: payload,
  }).then(({ data, error }) => {
    const result = data && typeof data === 'object' ? data as { ok?: boolean; events_received?: number } : null
    if (!error && result?.ok === true) {
      markRegistrationSent(SERVER_REGISTRATION_KEY, userId)
      try { localStorage.removeItem(registrationStorageKey(PENDING_REGISTRATION_KEY, userId)) } catch { /* storage indisponível */ }
      trackEvent('meta_conversion_delivery', {
        user_id: userId,
        metadata: { channel: 'server', status: 'accepted', event: 'CompleteRegistration', events_received: result.events_received ?? null },
      })
      return
    }
    trackEvent('meta_conversion_delivery', {
      user_id: userId,
      metadata: { channel: 'server', status: 'failed', event: 'CompleteRegistration', error_code: 'invoke_error' },
    })
    if (import.meta.env.DEV) console.warn('[meta] CAPI indisponível', error?.message || 'Resposta inválida')
  }).catch(() => {
    trackEvent('meta_conversion_delivery', {
      user_id: userId,
      metadata: { channel: 'server', status: 'failed', event: 'CompleteRegistration', error_code: 'network_error' },
    })
  })
}
