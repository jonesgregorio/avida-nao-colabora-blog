import { createClient } from 'npm:@supabase/supabase-js@2'

// ============================================================================
// image-search — capa de artigo relacionada ao tema (Pexels)
// ----------------------------------------------------------------------------
// Recebe { query } e devolve uma FOTO real relacionada ao tema, via Pexels.
// A chave (PEXELS_API_KEY) fica SÓ no servidor. Apenas admin autenticado chama.
// Sem chave / sem resultado → devolve { error } (o cliente mantém a capa atual).
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(url, serviceKey)

  // ── Auth: admin autenticado (mesmo padrão do generate-content) ──────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autenticado' }, 401)
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401)
  const { data: profile } = await admin.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if ((profile as { role?: string } | null)?.role !== 'admin') return json({ error: 'Acesso restrito a administradores' }, 403)

  let body: { query?: string }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const query = (body.query ?? '').trim()
  if (!query) return json({ error: 'query vazio' }, 400)

  const key = Deno.env.get('PEXELS_API_KEY')
  if (!key) return json({ error: 'no_key', message: 'PEXELS_API_KEY não configurada no servidor' })

  try {
    const endpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape&size=large`
    const res = await fetch(endpoint, { headers: { Authorization: key } })
    if (!res.ok) return json({ error: 'pexels_error', status: res.status })
    const data = await res.json()
    const photos = Array.isArray(data?.photos) ? data.photos : []
    if (photos.length === 0) return json({ error: 'no_result' })
    // Escolhe uma foto entre as primeiras (dá variedade ao re-buscar) — as
    // primeiras são as mais relevantes, então limitamos ao topo.
    const top = photos.slice(0, Math.min(photos.length, 8))
    const p = top[Math.floor(Math.random() * top.length)]
    const imageUrl = p?.src?.landscape || p?.src?.large || p?.src?.original
    if (!imageUrl) return json({ error: 'no_result' })
    return json({
      url: imageUrl,
      alt: (p?.alt && String(p.alt).trim()) || query,
      credit: p?.photographer ? `Foto de ${p.photographer} no Pexels` : 'Foto: Pexels',
      photographer_url: p?.url ?? null,
      query,
    })
  } catch (e) {
    return json({ error: 'exception', detail: (e as Error).message })
  }
})
