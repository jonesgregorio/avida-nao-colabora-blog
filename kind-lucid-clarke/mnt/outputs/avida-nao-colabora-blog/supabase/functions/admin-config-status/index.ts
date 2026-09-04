import { requireAdminAal2 } from '../_shared/adminAuth.ts'
import { resolveAiModels, DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL } from '../_shared/aiModels.ts'

// admin-config-status — só leitura, só admin AAL2.
// Diz quais secrets do Supabase estão configurados (booleano, NUNCA o valor) e
// qual modelo de IA está em uso. Alimenta o painel de configuração do Admin.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Secrets que o produto usa. A UI agrupa por função.
const SECRET_KEYS = [
  'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY',
  'YOUTUBE_API_KEY', 'PEXELS_API_KEY',
  'RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ESSENTIAL', 'STRIPE_PRICE_PLUS_3990', 'STRIPE_PRICE_THERAPEUTIC',
  'TURNSTILE_SECRET_KEY', 'CRON_SECRET', 'SITE_URL',
  'GEMINI_MODEL', 'GROQ_MODEL', 'GEMINI_IMAGE_MODEL', 'AI_PROVIDER_ORDER',
  'UNSUBSCRIBE_SECRET', 'RESEND_WEBHOOK_SECRET', 'ADMIN_ALERT_EMAIL', 'APP_URL',
] as const

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  const secrets: Record<string, boolean> = {}
  for (const k of SECRET_KEYS) secrets[k] = !!(Deno.env.get(k) || '').trim()

  const models = await resolveAiModels()

  return json({
    secrets,
    models: {
      gemini: models.gemini,
      groq: models.groq,
      geminiSource: models.geminiSource,
      groqSource: models.groqSource,
      geminiDefault: DEFAULT_GEMINI_MODEL,
      groqDefault: DEFAULT_GROQ_MODEL,
    },
  })
})
