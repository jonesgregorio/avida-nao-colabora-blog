export type CampaignVariant = 'ig_landing' | 'site_home'

export interface CampaignAttribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  landing_path: string
  click_id_type: string | null
  experiment_variant: CampaignVariant | null
}

const FIRST_TOUCH_KEY = 'avnc_campaign_first_touch_v1'
const MAX_VALUE_LENGTH = 160

function clean(value: string | null): string | null {
  const normalized = value?.trim().slice(0, MAX_VALUE_LENGTH) ?? ''
  return normalized || null
}

export function experimentVariantFromContent(content: string | null): CampaignVariant | null {
  const value = (content ?? '').trim().toLowerCase()
  if (['ab_ig_landing', 'ig_landing', 'landing_checkin'].includes(value)) return 'ig_landing'
  if (['ab_site_home', 'site_home', 'home'].includes(value)) return 'site_home'
  return null
}

function clickIdType(params: URLSearchParams): string | null {
  if (params.has('fbclid')) return 'fbclid'
  if (params.has('gclid')) return 'gclid'
  if (params.has('gbraid')) return 'gbraid'
  if (params.has('wbraid')) return 'wbraid'
  if (params.has('msclkid')) return 'msclkid'
  if (params.has('ttclid')) return 'ttclid'
  return null
}

export function parseCampaignAttribution(search: string, landingPath: string): CampaignAttribution | null {
  const params = new URLSearchParams(search)
  const utm_source = clean(params.get('utm_source'))
  const utm_medium = clean(params.get('utm_medium'))
  const utm_campaign = clean(params.get('utm_campaign'))
  const utm_content = clean(params.get('utm_content'))
  const utm_term = clean(params.get('utm_term'))
  const detectedClickId = clickIdType(params)

  if (!utm_source && !utm_medium && !utm_campaign && !utm_content && !utm_term && !detectedClickId) return null

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    landing_path: landingPath || '/',
    click_id_type: detectedClickId,
    experiment_variant: experimentVariantFromContent(utm_content),
  }
}

function validStoredAttribution(value: unknown): CampaignAttribution | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<CampaignAttribution>
  if (typeof candidate.landing_path !== 'string') return null
  return {
    utm_source: clean(candidate.utm_source ?? null),
    utm_medium: clean(candidate.utm_medium ?? null),
    utm_campaign: clean(candidate.utm_campaign ?? null),
    utm_content: clean(candidate.utm_content ?? null),
    utm_term: clean(candidate.utm_term ?? null),
    landing_path: candidate.landing_path.slice(0, MAX_VALUE_LENGTH) || '/',
    click_id_type: clean(candidate.click_id_type ?? null),
    experiment_variant: candidate.experiment_variant === 'ig_landing' || candidate.experiment_variant === 'site_home'
      ? candidate.experiment_variant
      : experimentVariantFromContent(candidate.utm_content ?? null),
  }
}

export function currentCampaignAttribution(): CampaignAttribution | null {
  if (typeof window === 'undefined') return null
  const current = parseCampaignAttribution(window.location.search, window.location.pathname)
  if (current) {
    try { localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(current)) } catch { /* storage indisponível */ }
    return current
  }
  try {
    const saved = localStorage.getItem(FIRST_TOUCH_KEY)
    return saved ? validStoredAttribution(JSON.parse(saved)) : null
  } catch {
    return null
  }
}

export function campaignMetadata(fallback?: unknown): Record<string, string | null> {
  const attribution = validStoredAttribution(fallback) ?? currentCampaignAttribution()
  return attribution ? { ...attribution } : {}
}

export function campaignAttributionForSignup(): CampaignAttribution | undefined {
  return currentCampaignAttribution() ?? undefined
}

export function experimentVariant(): CampaignVariant | null {
  return currentCampaignAttribution()?.experiment_variant ?? null
}
