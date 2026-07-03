import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type AnalyticsEvent =
  | 'article_view'
  | 'article_click'
  | 'questionnaire_start'
  | 'questionnaire_complete'
  | 'trail_start'
  | 'trail_complete'
  | 'daily_content_view'
  | 'daily_content_expand'
  | 'pdf_export'
  | 'diary_entry'
  | 'plan_upgrade_click'
  | 'auth_signup'
  | 'auth_login'

export interface TrackPayload {
  entity_id?: string
  entity_title?: string
  metadata?: Record<string, unknown>
}

/**
 * Hook para rastrear eventos de analytics.
 * Fire-and-forget: nunca bloqueia a UI.
 */
export function useAnalytics(userId?: string) {
  const track = useCallback(
    async (event: AnalyticsEvent, payload: TrackPayload = {}) => {
      try {
        await supabase.from('analytics_events').insert({
          user_id: userId || null,
          event,
          entity_id: payload.entity_id || null,
          entity_title: payload.entity_title || null,
          metadata: payload.metadata || null,
          session_id: getSessionId(),
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
        })
      } catch {
        // silencioso — tracking nunca deve quebrar a UI
      }
    },
    [userId]
  )

  return { track }
}

// Session ID persistido no sessionStorage (mesmo tab)
function getSessionId(): string {
  const key = 'avnc_sid'
  let sid = sessionStorage.getItem(key)
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem(key, sid)
  }
  return sid
}
