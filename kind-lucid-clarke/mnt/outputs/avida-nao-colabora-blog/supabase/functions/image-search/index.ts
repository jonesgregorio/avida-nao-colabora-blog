import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// image-search — capa de artigo relacionada ao tema (Pexels)
// ----------------------------------------------------------------------------
// Recebe { query } e devolve uma FOTO real relacionada ao tema, via Pexels.
// A chave (PEXELS_API_KEY) fica SÓ no servidor. Apenas admin AAL2 chama.
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

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

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
