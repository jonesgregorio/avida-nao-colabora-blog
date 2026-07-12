import { supabase } from './supabase'

// ─── Rastreamento leve e privacy-safe para a área Analytics do admin ─────────
// Grava em analytics_events (insert anônimo liberado pela migration 077).
// NUNCA registra conteúdo sensível (diário, check-in, respostas). Sem IP.
// Fire-and-forget: nunca bloqueia nem quebra a UI.

function getSessionId(): string {
  const key = 'avnc_sid'
  try {
    let sid = sessionStorage.getItem(key)
    if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem(key, sid) }
    return sid
  } catch { return 'anon' }
}

export interface TrackOpts {
  entity_id?: string
  entity_title?: string
  user_id?: string | null
  metadata?: Record<string, unknown>
}

export function trackEvent(event: string, opts: TrackOpts = {}): void {
  try {
    supabase.from('analytics_events').insert({
      user_id: opts.user_id ?? null,
      event,
      entity_id: opts.entity_id ?? null,
      entity_title: opts.entity_title ?? null,
      metadata: opts.metadata ?? null,
      session_id: getSessionId(),
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
    }).then(() => { /* ok */ }, () => { /* silencioso */ })
  } catch { /* noop */ }
}

// ─── Core Web Vitals (nativo, sem dependência externa) ───────────────────────
const VITAL_THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000], FCP: [1800, 3000], TTFB: [800, 1800], CLS: [100, 250], INP: [200, 500],
}
function ratingFor(metric: string, v: number): 'bom' | 'atenção' | 'ruim' {
  const [good, poor] = VITAL_THRESHOLDS[metric] ?? [0, Infinity]
  return v <= good ? 'bom' : v <= poor ? 'atenção' : 'ruim'
}
function sendVital(metric: string, value: number) {
  const rating = ratingFor(metric, value)
  trackEvent('web_vital', { entity_id: metric, entity_title: rating, metadata: { value: Math.round(value), rating } })
}

let vitalsInit = false
export function initWebVitals(): void {
  if (vitalsInit || typeof PerformanceObserver === 'undefined') return
  vitalsInit = true

  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.responseStart) sendVital('TTFB', nav.responseStart)
  } catch { /* noop */ }

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') sendVital('FCP', e.startTime)
    }).observe({ type: 'paint', buffered: true })
  } catch { /* noop */ }

  try {
    let lcp = 0
    const po = new PerformanceObserver((list) => { const es = list.getEntries(); if (es.length) lcp = es[es.length - 1].startTime })
    po.observe({ type: 'largest-contentful-paint', buffered: true })
    const onHide = () => { if (document.visibilityState === 'hidden' && lcp) { sendVital('LCP', lcp); po.disconnect(); document.removeEventListener('visibilitychange', onHide) } }
    document.addEventListener('visibilitychange', onHide)
  } catch { /* noop */ }

  try {
    let cls = 0
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) cls += e.value
    })
    po.observe({ type: 'layout-shift', buffered: true })
    const onHide = () => { if (document.visibilityState === 'hidden') { sendVital('CLS', cls * 1000); po.disconnect(); document.removeEventListener('visibilitychange', onHide) } }
    document.addEventListener('visibilitychange', onHide)
  } catch { /* noop */ }
}
