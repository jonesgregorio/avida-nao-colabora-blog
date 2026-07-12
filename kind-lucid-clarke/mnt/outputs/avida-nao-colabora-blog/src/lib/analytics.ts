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

// ─── Configurações de rastreamento (controladas no admin → Analytics) ────────
interface TrackConfig { track_pageviews: boolean; track_scroll: boolean; track_cta: boolean; track_errors: boolean; track_web_vitals: boolean; anonymize: boolean }
// Default: tudo ligado até carregar as flags reais (fail-open é seguro aqui).
let cfg: TrackConfig = { track_pageviews: true, track_scroll: true, track_cta: true, track_errors: true, track_web_vitals: true, anonymize: true }
let cfgLoaded = false
function loadConfig() {
  if (cfgLoaded) return
  cfgLoaded = true
  try {
    supabase.from('analytics_settings').select('config').eq('id', 1).maybeSingle()
      .then(({ data }) => { if (data?.config) cfg = { ...cfg, ...(data.config as Partial<TrackConfig>) } }, () => { /* usa default */ })
  } catch { /* usa default */ }
}

// Qual flag controla cada evento (eventos sem mapeamento são sempre enviados).
function allowedByConfig(event: string): boolean {
  if (event === 'page_view' || event === 'article_view') return cfg.track_pageviews
  if (event.startsWith('scroll_')) return cfg.track_scroll
  if (event === 'cta_click' || event === 'article_click') return cfg.track_cta
  if (event === 'error_404') return cfg.track_errors
  if (event === 'web_vital') return cfg.track_web_vitals
  return true
}

// Reduz o user-agent a "Dispositivo|Navegador" quando a anonimização está ligada.
function coarseUA(ua: string): string {
  const s = ua.toLowerCase()
  const device = /ipad|tablet/.test(s) ? 'Tablet' : /mobi|android|iphone/.test(s) ? 'Mobile' : 'Desktop'
  const browser = /edg\//.test(s) ? 'Edge' : /firefox\//.test(s) ? 'Firefox' : /chrome\//.test(s) ? 'Chrome' : /safari\//.test(s) ? 'Safari' : 'Outro'
  return `${device}|${browser}`
}

export function trackEvent(event: string, opts: TrackOpts = {}): void {
  try {
    loadConfig()
    if (!allowedByConfig(event)) return
    const rawUA = navigator.userAgent
    let referrer: string | null = document.referrer || null
    if (cfg.anonymize && referrer) { try { referrer = new URL(referrer).hostname } catch { /* mantém */ } }
    supabase.from('analytics_events').insert({
      user_id: opts.user_id ?? null,
      event,
      entity_id: opts.entity_id ?? null,
      entity_title: opts.entity_title ?? null,
      metadata: opts.metadata ?? null,
      session_id: getSessionId(),
      referrer,
      user_agent: cfg.anonymize ? coarseUA(rawUA) : rawUA,
    }).then(() => { /* ok */ }, () => { /* silencioso */ })
  } catch { /* noop */ }
}

// ─── Aquisição: de onde o visitante veio (Instagram, Google, YouTube, campanhas) ─
// Lê parâmetros UTM da URL (?utm_source=instagram&utm_campaign=lancamento) e/ou o
// referrer, classifica a fonte e registra 1 evento "visit_source" por sessão.
// É assim que campanhas do Instagram/YouTube/Google aparecem separadas no admin.

function classifySource(refHost: string, utmSource: string): string {
  const u = utmSource.toLowerCase()
  if (u) {
    if (/insta|ig/.test(u)) return 'Instagram'
    if (/youtube|yt/.test(u)) return 'YouTube'
    if (/google|goog|adwords|gads/.test(u)) return 'Google'
    if (/face|fb/.test(u)) return 'Facebook'
    if (/tiktok/.test(u)) return 'TikTok'
    if (/whats|wpp/.test(u)) return 'WhatsApp'
    if (/email|newsletter|mail/.test(u)) return 'E-mail'
    return utmSource.charAt(0).toUpperCase() + utmSource.slice(1)
  }
  const h = refHost.toLowerCase()
  if (!h) return 'Direto'
  if (/instagram|l\.instagram|ig\./.test(h)) return 'Instagram'
  if (/youtube|youtu\.be/.test(h)) return 'YouTube'
  if (/google\./.test(h)) return 'Google'
  if (/facebook|fb\.com|l\.facebook/.test(h)) return 'Facebook'
  if (/tiktok/.test(h)) return 'TikTok'
  if (/t\.co|twitter|x\.com/.test(h)) return 'Twitter/X'
  if (/bing\./.test(h)) return 'Bing'
  return h.replace(/^www\./, '')
}

let acqInit = false
export function initAcquisition(): void {
  if (acqInit) return
  acqInit = true
  try {
    const seenKey = 'avnc_src_seen'
    if (sessionStorage.getItem(seenKey)) return // 1x por sessão
    const qs = new URLSearchParams(window.location.search)
    const utmSource = qs.get('utm_source') || ''
    const utmMedium = qs.get('utm_medium') || ''
    const utmCampaign = qs.get('utm_campaign') || ''
    let refHost = ''
    try { refHost = document.referrer ? new URL(document.referrer).hostname : '' } catch { /* ignora */ }
    // Ignora referrer interno (mesma origem) — não é "fonte externa".
    if (refHost && refHost === window.location.hostname) refHost = ''

    const source = classifySource(refHost, utmSource)
    trackEvent('visit_source', {
      entity_id: source,
      entity_title: utmCampaign || undefined,
      metadata: { source, utm_source: utmSource || null, utm_medium: utmMedium || null, utm_campaign: utmCampaign || null, referrer_host: refHost || null },
    })
    sessionStorage.setItem(seenKey, '1')
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
