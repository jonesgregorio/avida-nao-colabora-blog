import { supabase } from './supabase'

// ─── Rastreamento leve e privacy-safe para a área Analytics do admin ─────────
// Grava em analytics_events (insert anônimo liberado pela migration 077).
// NUNCA registra conteúdo sensível (diário, check-in, respostas). Sem IP.
// Fire-and-forget: nunca bloqueia nem quebra a UI.

// Achado ao vivo: o workflow "Production Smoke" (.github/workflows/production-smoke.yml)
// roda de verdade contra avidanaocolabora.com depois de todo merge na main, pra garantir
// que o site no ar funciona — navegador real, JS real. Sem essa checagem, cada rodada
// gera visit_source "Direto" (sem referrer/UTM) e pageviews reais, inflando os números
// de "Visitas e origem" no Admin com tráfego que não é gente de verdade. O teste injeta
// essa flag via page.addInitScript ANTES de qualquer navegação (tests/e2e/production-smoke.spec.mjs)
// — visitantes reais nunca têm esse item no sessionStorage.
function isSmokeTest(): boolean {
  try { return sessionStorage.getItem('avnc_smoke') === '1' } catch { return false }
}

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
export type AnalyticsEvent =
  | 'page_view' | 'route_change' | 'error_404' | 'article_view' | 'article_click'
  | 'article_scroll_50' | 'article_scroll_75' | 'article_scroll_100' | 'cta_click'
  | 'blog_search' | 'questionnaire_start' | 'questionnaire_complete' | 'trail_start' | 'trail_complete'
  | 'pdf_export' | 'diary_entry' | 'plan_upgrade_click'
  | 'auth_signup' | 'auth_login' | 'web_vital' | 'visit_source' | 'diary_open' | 'checkin_start'
  | 'checkin_complete' | 'emotional_map_view' | 'weekly_report_view' | 'monthly_report_view'
  | 'self_care_plan_view' | 'professional_guidance_request' | 'professional_guidance_view'
  | 'signup_click' | 'register_success' | 'login_success' | 'plan_click' | 'checkout_started'
  | 'subscription_started' | 'upgrade_started' | 'upgrade_completed' | 'downgrade_requested'
  | 'cancel_started' | 'cancel_completed' | 'article_share' | 'article_save';

const BLOCKED_KEYS = new Set(['password', 'token', 'access_token', 'refresh_token', 'diary_text', 'message_body', 'personal_note', 'health_description', 'email'])
const seenEvents = new Set<string>()
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === undefined || typeof value === 'function') return undefined
  if (typeof value === 'string') return value.slice(0, 500)
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, 20).map(v => sanitize(v, depth + 1)).filter(v => v !== undefined)
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([k]) => !BLOCKED_KEYS.has(k.toLowerCase())).map(([k, v]) => [k, sanitize(v, depth + 1)]).filter(([, v]) => v !== undefined))
  return undefined
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
  if (event.startsWith('scroll_') || event.startsWith('article_scroll_')) return cfg.track_scroll
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

export function trackEvent(event: AnalyticsEvent | string, opts: TrackOpts = {}): void {
  try {
    if (isSmokeTest()) return
    // O painel administrativo não representa aquisição/uso do site público.
    if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) return
    loadConfig()
    const normalized = (event === 'scroll_50' ? 'article_scroll_50' : event === 'scroll_75' ? 'article_scroll_75' : event === 'scroll_100' ? 'article_scroll_100' : event)
      .trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (!normalized || !allowedByConfig(normalized)) return
    const rawUA = navigator.userAgent
    let referrer: string | null = document.referrer || null
    if (cfg.anonymize && referrer) { try { referrer = new URL(referrer).hostname } catch { /* mantém */ } }
    const key = ['page_view', 'article_view', 'article_scroll_50', 'article_scroll_75', 'article_scroll_100'].includes(normalized) ? `${getSessionId()}:${normalized}:${opts.entity_id ?? location.pathname}` : ''
    if (key && seenEvents.has(key)) return
    if (key) seenEvents.add(key)
    supabase.from('analytics_events').insert({
      user_id: opts.user_id ?? null,
      event: normalized,
      entity_id: opts.entity_id ?? null,
      entity_title: opts.entity_title ?? null,
      metadata: sanitize({ path: location.pathname, ...(opts.metadata ?? {}) }) ?? null,
      session_id: getSessionId(),
      referrer,
      user_agent: cfg.anonymize ? coarseUA(rawUA) : rawUA,
    }).then(({ error }) => { if (error && import.meta.env.DEV) console.warn('[analytics] evento não salvo', normalized, error.message) })
  } catch (error) { if (import.meta.env.DEV) console.warn('[analytics] evento inválido', error) }
}

// ─── Aquisição: de onde o visitante veio (Instagram, Google, YouTube, campanhas) ─
// Lê parâmetros UTM da URL (?utm_source=instagram&utm_campaign=lancamento) e/ou o
// referrer, classifica a fonte e registra 1 evento "visit_source" por sessão.
// É assim que campanhas do Instagram/YouTube/Google aparecem separadas no admin.

type Attribution = {
  source: string
  medium: string | null
  campaign: string | null
  referrer_host: string | null
  landing_path: string
  attribution_method: 'utm' | 'click_id' | 'referrer' | 'persisted_first_touch' | 'unknown'
  click_id_type: string | null
}

const FIRST_TOUCH_KEY = 'avnc_first_touch_v2'

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
    if (/bing|microsoft/.test(u)) return 'Bing'
    return utmSource.charAt(0).toUpperCase() + utmSource.slice(1)
  }
  const h = refHost.toLowerCase()
  if (!h) return 'Origem não identificada'
  if (/instagram|l\.instagram|ig\./.test(h)) return 'Instagram'
  if (/youtube|youtu\.be/.test(h)) return 'YouTube'
  if (/google\./.test(h)) return 'Google'
  if (/facebook|fb\.com|l\.facebook/.test(h)) return 'Facebook'
  if (/tiktok/.test(h)) return 'TikTok'
  if (/t\.co|twitter|x\.com/.test(h)) return 'Twitter/X'
  if (/bing\./.test(h)) return 'Bing'
  return h.replace(/^www\./, '')
}

function clickIdAttribution(qs: URLSearchParams): { source: string; medium: string; type: string } | null {
  if (qs.get('gclid') || qs.get('gbraid') || qs.get('wbraid')) return { source: 'Google', medium: 'paid', type: qs.get('gclid') ? 'gclid' : qs.get('gbraid') ? 'gbraid' : 'wbraid' }
  if (qs.get('fbclid')) return { source: 'Facebook/Instagram', medium: 'social', type: 'fbclid' }
  if (qs.get('msclkid')) return { source: 'Bing', medium: 'paid', type: 'msclkid' }
  if (qs.get('ttclid')) return { source: 'TikTok', medium: 'social', type: 'ttclid' }
  return null
}

function readFirstTouch(): Attribution | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Attribution
    return parsed?.source ? parsed : null
  } catch { return null }
}

function saveFirstTouch(value: Attribution) {
  try { localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(value)) } catch { /* storage indisponível */ }
}

let acqInit = false
export function initAcquisition(): void {
  if (acqInit) return
  acqInit = true
  try {
    // Admin não entra nas métricas de aquisição.
    if (location.pathname === '/admin' || location.pathname.startsWith('/admin/')) return

    const seenKey = 'avnc_src_seen'
    if (sessionStorage.getItem(seenKey)) return // 1x por sessão

    const qs = new URLSearchParams(window.location.search)
    const utmSource = qs.get('utm_source') || ''
    const utmMedium = qs.get('utm_medium') || ''
    const utmCampaign = qs.get('utm_campaign') || ''
    let refHost = ''
    try { refHost = document.referrer ? new URL(document.referrer).hostname : '' } catch { /* ignora */ }
    if (refHost && refHost === window.location.hostname) refHost = ''

    const click = clickIdAttribution(qs)
    const hasExplicitSignal = Boolean(utmSource || click || refHost)
    const persisted = readFirstTouch()

    let attribution: Attribution
    if (utmSource) {
      attribution = {
        source: classifySource(refHost, utmSource),
        medium: utmMedium || null,
        campaign: utmCampaign || null,
        referrer_host: refHost || null,
        landing_path: location.pathname,
        attribution_method: 'utm',
        click_id_type: click?.type ?? null,
      }
    } else if (click) {
      attribution = {
        source: click.source,
        medium: click.medium,
        campaign: utmCampaign || null,
        referrer_host: refHost || null,
        landing_path: location.pathname,
        attribution_method: 'click_id',
        click_id_type: click.type,
      }
    } else if (refHost) {
      attribution = {
        source: classifySource(refHost, ''),
        medium: 'referral',
        campaign: null,
        referrer_host: refHost,
        landing_path: location.pathname,
        attribution_method: 'referrer',
        click_id_type: null,
      }
    } else if (persisted && persisted.source !== 'Origem não identificada') {
      attribution = {
        ...persisted,
        landing_path: location.pathname,
        attribution_method: 'persisted_first_touch',
      }
    } else {
      attribution = {
        source: 'Origem não identificada',
        medium: null,
        campaign: null,
        referrer_host: null,
        landing_path: location.pathname,
        attribution_method: 'unknown',
        click_id_type: null,
      }
    }

    // First touch só é substituído quando existe um sinal externo real. Assim uma
    // visita posterior sem referrer não apaga uma origem previamente conhecida.
    if (hasExplicitSignal && attribution.source !== 'Origem não identificada') saveFirstTouch(attribution)

    trackEvent('visit_source', {
      entity_id: attribution.source,
      entity_title: attribution.campaign || undefined,
      metadata: {
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        referrer_host: attribution.referrer_host,
        landing_path: attribution.landing_path,
        attribution_method: attribution.attribution_method,
        click_id_type: attribution.click_id_type,
        // Nunca salvamos o valor do click-id: apenas qual identificador permitiu atribuir.
        first_touch_source: readFirstTouch()?.source ?? null,
      },
    })
    sessionStorage.setItem(seenKey, '1')
  } catch { /* noop */ }
}

type CustomInteraction = 'click' | 'submit' | 'view'
interface CustomEventDefinition { name: string; selector: string | null; url_pattern: string | null; interaction_type?: CustomInteraction | null }
let customInit = false
let customUserId: string | null = null
let customDefinitions: CustomEventDefinition[] = []
const customViewSeen = new Set<string>()
function customEventMatches(row: CustomEventDefinition, target: Element | null) {
  if (!row.selector || !target) return false
  try { return Boolean(target.closest(row.selector)) } catch { return false }
}
function customEventAllowedHere(row: CustomEventDefinition) { return !row.url_pattern || location.pathname.includes(row.url_pattern) }
export function trackCustomViews(): void {
  customDefinitions.filter(row => (row.interaction_type ?? 'click') === 'view' && customEventAllowedHere(row)).forEach(row => {
    const key = `${getSessionId()}:${row.name}:${location.pathname}`
    if (customViewSeen.has(key) || !document.querySelector(row.selector!)) return
    customViewSeen.add(key)
    trackEvent(row.name, { user_id: customUserId, entity_id: row.selector!, metadata: { custom_event: true, interaction: 'view' } })
  })
}
/** Aplica definições ativas do Admin com listeners delegados e tolerantes a seletor inválido. */
export function initCustomEvents(userId?: string | null): void {
  customUserId = userId ?? null
  if (customInit) return
  customInit = true
  supabase.from('analytics_custom_events').select('name,selector,url_pattern,interaction_type').eq('is_active', true)
    .then(({ data, error }) => {
      if (error) { if (import.meta.env.DEV) console.warn('[analytics] eventos personalizados indisponíveis', error.message); return }
      customDefinitions = ((data ?? []) as CustomEventDefinition[]).filter(row => {
        if (!row.selector) return false
        try { document.querySelector(row.selector) } catch { if (import.meta.env.DEV) console.warn('[analytics] seletor inválido', row.selector); return false }
        return true
      })
      trackCustomViews()
    })
  document.addEventListener('click', (e) => {
    const target = e.target as Element | null
    customDefinitions.filter(row => (row.interaction_type ?? 'click') === 'click' && customEventAllowedHere(row) && customEventMatches(row, target)).forEach(row => {
      trackEvent(row.name, { user_id: customUserId, entity_id: row.selector!, metadata: { custom_event: true, interaction: 'click' } })
    })
  })
  document.addEventListener('submit', (e) => {
    const target = e.target as Element | null
    customDefinitions.filter(row => row.interaction_type === 'submit' && customEventAllowedHere(row) && customEventMatches(row, target)).forEach(row => {
      trackEvent(row.name, { user_id: customUserId, entity_id: row.selector!, metadata: { custom_event: true, interaction: 'submit' } })
    })
  })
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
  trackEvent('web_vital', { entity_id: metric, entity_title: rating, metadata: { metric_name: metric, value: Math.round(value), rating, path: location.pathname } })
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
