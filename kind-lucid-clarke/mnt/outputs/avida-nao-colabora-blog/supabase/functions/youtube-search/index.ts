import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// youtube-search — busca uma LISTA de vídeos candidatos (Admin > editor de artigo)
// ----------------------------------------------------------------------------
// Recebe { query } e devolve até ~10 candidatos REAIS do YouTube (id, título,
// canal, descrição, thumbnail, duração, views) para o admin ESCOLHER. A chave
// (YOUTUBE_API_KEY) fica SÓ no servidor. Apenas admin AAL2 chama.
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function iso8601ToSeconds(d: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '')
  if (!m) return 0
  return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  let body: { query?: string; maxResults?: number }
  try { body = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const query = (body.query ?? '').trim()
  if (!query) return json({ error: 'query vazio' }, 400)
  const maxResults = Math.min(Math.max(body.maxResults ?? 10, 1), 15)

  const key = Deno.env.get('YOUTUBE_API_KEY')
  if (!key) return json({ error: 'no_key', message: 'YOUTUBE_API_KEY não configurada no servidor', candidates: [] })

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&order=relevance&maxResults=${maxResults}&relevanceLanguage=pt&regionCode=BR&q=${encodeURIComponent(query)}&key=${key}`
    const sRes = await fetch(searchUrl)
    if (!sRes.ok) return json({ error: 'youtube_error', status: sRes.status, candidates: [] })
    const sData = await sRes.json()
    const items = (Array.isArray(sData?.items) ? sData.items : []).filter((it: { id?: { videoId?: string } }) => it?.id?.videoId)
    if (items.length === 0) return json({ ok: true, query, candidates: [] })

    const ids = items.map((it: { id: { videoId: string } }) => it.id.videoId)
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids.join(',')}&key=${key}`
    const dRes = await fetch(detailsUrl)
    const dData = dRes.ok ? await dRes.json() : { items: [] }
    const byId = new Map<string, { duration: number; views: number }>()
    for (const v of (dData?.items ?? [])) {
      byId.set(v.id, {
        duration: iso8601ToSeconds(v?.contentDetails?.duration ?? ''),
        views: Number(v?.statistics?.viewCount ?? 0),
      })
    }

    const candidates = items.map((it: { id: { videoId: string }; snippet: Record<string, unknown> }) => {
      const id = it.id.videoId
      const sn = it.snippet as { title?: string; description?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> }
      const extra = byId.get(id) ?? { duration: 0, views: 0 }
      return {
        videoId: id,
        title: String(sn.title ?? '').trim(),
        channel: String(sn.channelTitle ?? '').trim(),
        description: String(sn.description ?? '').slice(0, 300),
        thumbnail: sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
        url: `https://www.youtube.com/watch?v=${id}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        durationSeconds: extra.duration,
        views: extra.views,
      }
    })

    return json({ ok: true, query, candidates })
  } catch (e) {
    return json({ error: 'exception', detail: (e as Error).message, candidates: [] })
  }
})
