import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireAdminAal2 } from '../_shared/adminAuth.ts'
import { researchOfficialSources, selectSearchOpportunities, type SearchMetric } from '../_shared/editorialResearch.ts'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)
  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)
  let body: { query?: unknown; theme?: unknown }
  try {
    const text = await req.text()
    if (text.length > 3000) return json({ error: 'Pedido muito grande' }, 413)
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return json({ error: 'JSON inválido' }, 400)
    body = parsed
  } catch { return json({ error: 'JSON inválido' }, 400) }
  if (typeof body.query !== 'string' || !body.query.trim() || body.query.length > 120 || typeof body.theme !== 'string' || !body.theme.trim() || body.theme.length > 300) return json({ error: 'Informe tema e termo de pesquisa válidos.' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const to = new Date().toISOString().slice(0, 10), from = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
  const [research, metrics] = await Promise.all([
    researchOfficialSources(body.query),
    admin.from('seo_search_performance_daily').select('day,dimension_key,clicks,impressions,position').eq('dimension', 'query').gte('day', from).lte('day', to).order('day', { ascending: false }).limit(2000),
  ])
  const warnings = [...research.warnings]
  const rows = (metrics.data || []) as SearchMetric[]
  const stale = !rows.length || Date.now() - Date.parse(rows[0].day) > 7 * 86400000
  if (metrics.error || rows.length >= 2000 || stale) warnings.push('Search Console sem dados recentes completos disponíveis para orientar este artigo.')
  const opportunities = metrics.error || rows.length >= 2000 || stale ? [] : selectSearchOpportunities(body.theme, rows)
  return json({ research, opportunities, from, to, warnings })
})
