import { supabase } from './supabase'

const HEARTBEAT_MS = 15000
const TICK_MS = 5000
const IDLE_AFTER_MS = 60000

function isSmokeTest() {
  try { return sessionStorage.getItem('avnc_smoke') === '1' } catch { return false }
}

function getSessionId() {
  const key = 'avnc_sid'
  try {
    let sid = sessionStorage.getItem(key)
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem(key, sid)
    }
    return sid
  } catch { return 'anon' }
}

function currentArticleSlug() {
  const match = location.pathname.match(/^\/blog\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

function estimatedReadSeconds() {
  const content = document.querySelector('.article-content')?.textContent || ''
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(60, Math.round((Math.max(words, 1) / 200) * 60))
}

export function initArticleActiveTimeTracking() {
  if (typeof window === 'undefined' || isSmokeTest()) return () => undefined

  let slug: string | null = null
  let activeSeconds = 0
  let lastSentSeconds = 0
  let lastActivityAt = Date.now()
  let lastTickAt = Date.now()
  let estimatedSeconds = 60

  const touch = () => { lastActivityAt = Date.now() }
  const activityEvents: (keyof WindowEventMap)[] = ['scroll', 'pointerdown', 'keydown', 'touchstart']
  for (const event of activityEvents) window.addEventListener(event, touch, { passive: true })

  const flush = () => {
    if (!slug || activeSeconds <= 0 || activeSeconds === lastSentSeconds) return
    const seconds = activeSeconds
    lastSentSeconds = seconds
    void supabase.from('analytics_events').insert({
      event: 'article_active_time',
      entity_id: slug,
      entity_title: null,
      metadata: { active_seconds: seconds, estimated_read_seconds: estimatedSeconds },
      session_id: getSessionId(),
      referrer: null,
      user_agent: null,
    })
  }

  const switchArticleIfNeeded = () => {
    const nextSlug = currentArticleSlug()
    if (nextSlug === slug) return
    flush()
    slug = nextSlug
    activeSeconds = 0
    lastSentSeconds = 0
    lastActivityAt = Date.now()
    lastTickAt = Date.now()
    estimatedSeconds = nextSlug ? estimatedReadSeconds() : 60
  }

  const tick = () => {
    switchArticleIfNeeded()
    const now = Date.now()
    const elapsed = Math.min(TICK_MS, Math.max(0, now - lastTickAt))
    lastTickAt = now
    if (!slug) return
    if (document.visibilityState !== 'visible') return
    if (now - lastActivityAt > IDLE_AFTER_MS) return
    activeSeconds += Math.round(elapsed / 1000)
  }

  const tickTimer = window.setInterval(tick, TICK_MS)
  const heartbeatTimer = window.setInterval(flush, HEARTBEAT_MS)
  const routeTimer = window.setInterval(switchArticleIfNeeded, 1000)

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
    else { lastActivityAt = Date.now(); lastTickAt = Date.now() }
  }
  const onPageHide = () => flush()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  switchArticleIfNeeded()

  return () => {
    flush()
    window.clearInterval(tickTimer)
    window.clearInterval(heartbeatTimer)
    window.clearInterval(routeTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', onPageHide)
    for (const event of activityEvents) window.removeEventListener(event, touch)
  }
}
