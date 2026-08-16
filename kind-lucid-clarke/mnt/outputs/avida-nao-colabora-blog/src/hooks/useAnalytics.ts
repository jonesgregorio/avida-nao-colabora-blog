import { useCallback } from 'react'
import { trackEvent, type AnalyticsEvent, type TrackOpts } from '../lib/analytics'

export type { AnalyticsEvent }
export type TrackPayload = Omit<TrackOpts, 'user_id'>

/**
 * Hook para rastrear eventos de analytics.
 * Fire-and-forget: nunca bloqueia a UI.
 */
export function useAnalytics(userId?: string) {
  const track = useCallback(
    (event: AnalyticsEvent, payload: TrackPayload = {}) => trackEvent(event, { ...payload, user_id: userId ?? null }),
    [userId]
  )

  return { track }
}
