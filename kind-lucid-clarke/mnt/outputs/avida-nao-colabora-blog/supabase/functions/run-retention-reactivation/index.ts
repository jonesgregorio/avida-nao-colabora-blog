import { createClient } from 'npm:@supabase/supabase-js@2'

const SITE = Deno.env.get('SITE_URL') || 'https://avidanaocolabora.com'
const MAX_PER_RUN = 20
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Candidate = {
  user_id: string; email: string; full_name: string | null; plan: string;
  days_inactive: number; email_enabled: boolean; receive_selfcare_reminders: boolean
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Missing configuration' }, 500)
  const admin = createClient(url, serviceKey)
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\\s+/i, '').trim()
  const { data: internal } = await admin.rpc('get_automation_token')
  if (!token || ![serviceKey, internal].filter(Boolean).includes(token)) return json({ error: 'Unauthorized' }, 401)

  const { data, error } = await admin.rpc('get_reactivation_email_candidates')
  if (error) return json({ error: error.message }, 500)
  const candidates = (data ?? []) as Candidate[]
  const enabled = Deno.env.get('REACTIVATION_SEND_ENABLED') === 'true'
  if (!enabled) return json({ ok: true, mode: 'dry_run', eligible: candidates.length, sent: 0 })
  let sent = 0, failed = 0
  for (const candidate of candidates.slice(0, MAX_PER_RUN)) {
    if (!candidate.email_enabled || !candidate.receive_selfcare_reminders || candidate.days_inactive < 7) continue
    // Delivery service handles consent/unsubscribe and idempotency.
    const response = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: candidate.user_id, to_email: candidate.email,
        template_key: 'value_reactivation_return',
        variables: {
          nome: candidate.full_name?.trim() || 'você',
          cta_link: `${SITE}/`,
          link_preferencias: `${SITE}/perfil`,
        },
        idempotency_key: `value_reactivation_return:${candidate.user_id}:v1`,
        related_entity_type: 'retention',
        related_entity_id: candidate.user_id,
        metadata: { kind: 'opted_in_reactivation', plan: candidate.plan },
      }),
    })
    const payload = await response.json().catch(() => ({})) as { skipped?: boolean; error?: string }
    if (response.ok && !payload.skipped && !payload.error) sent++
    else failed++
  }
  return json({ ok: true, mode: 'send', eligible: candidates.length, processed: Math.min(MAX_PER_RUN, candidates.length), sent, failed })
})
