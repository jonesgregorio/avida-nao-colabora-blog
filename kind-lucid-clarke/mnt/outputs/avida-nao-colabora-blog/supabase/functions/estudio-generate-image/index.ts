import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// estudio-generate-image — gera uma imagem para o Estúdio de Conteúdo.
// ----------------------------------------------------------------------------
// Recebe { prompt, negativos?, aspect? } e devolve { dataUrl } (base64 PNG).
// Usa a API do Gemini (Imagen). A chave GEMINI_API_KEY fica SÓ no servidor.
// Apenas admin AAL2 chama. Sem chave / erro → { error } (o cliente segue com
// o template sem imagem).
//
// NÃO toca em generate-content (proxy de texto). É uma função isolada.
// ============================================================================

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

const DEFAULT_MODEL = 'imagen-3.0-generate-002'
const ASPECTS = new Set(['1:1', '9:16', '3:4', '4:3', '16:9'])
const TIMEOUT_MS = 45_000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  let body: { prompt?: string; negativos?: string; aspect?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const prompt = (body.prompt ?? '').trim()
  if (prompt.length < 8) return json({ error: 'prompt vazio' }, 400)
  const aspect = ASPECTS.has(body.aspect ?? '') ? body.aspect! : '1:1'
  const negativos = (body.negativos ?? '').trim()

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'no_key', message: 'GEMINI_API_KEY não configurada no servidor' })

  const model = (Deno.env.get('GEMINI_IMAGE_MODEL') || DEFAULT_MODEL).trim()
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${endpoint}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspect,
          personGeneration: 'allow_adult',
          ...(negativos ? { negativePrompt: negativos } : {}),
        },
      }),
    })

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 500)
      const kind = res.status === 429 ? 'quota' : res.status === 403 ? 'permission' : 'gemini_error'
      return json({ error: kind, status: res.status, detail })
    }

    const data = await res.json()
    const pred = Array.isArray(data?.predictions) ? data.predictions[0] : null
    const b64: string | undefined = pred?.bytesBase64Encoded
    const mime: string = pred?.mimeType || 'image/png'
    if (!b64) return json({ error: 'no_result', detail: JSON.stringify(data).slice(0, 400) })

    return json({ dataUrl: `data:${mime};base64,${b64}`, model, aspect })
  } catch (e) {
    const msg = (e as Error).message || String(e)
    return json({ error: msg.includes('abort') ? 'timeout' : 'exception', detail: msg.slice(0, 300) })
  } finally {
    clearTimeout(timer)
  }
})
