import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// estudio-generate-image — gera uma imagem para o Estúdio de Conteúdo.
// ----------------------------------------------------------------------------
// Recebe { prompt, aspect? } e devolve { dataUrl } (base64 PNG/JPEG).
// Usa a API do Gemini. Tenta uma cadeia de modelos (Imagen via :predict e
// Gemini Image via :generateContent) até um funcionar — assim não depende de
// um único modelo estar liberado no tier do projeto.
//
// A chave GEMINI_API_KEY fica SÓ no servidor. Apenas admin AAL2 chama.
// Falha → { error, detail } (o cliente segue com o template sem imagem).
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

const ASPECTS = new Set(['1:1', '9:16', '3:4', '4:3', '16:9'])
const TIMEOUT_MS = 45_000
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Ordem de tentativa. O modelo do secret (se houver) vai na frente.
const FALLBACK_MODELS = [
  'imagen-3.0-generate-002',
  'imagen-4.0-generate-001',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
]

interface Attempt { dataUrl?: string; detail?: string }

async function tryImagen(model: string, key: string, prompt: string, aspect: string, signal: AbortSignal): Promise<Attempt> {
  const res = await fetch(`${BASE}/${model}:predict?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: { sampleCount: 1, aspectRatio: aspect },
    }),
  })
  if (!res.ok) return { detail: `${model} ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const data = await res.json()
  const pred = Array.isArray(data?.predictions) ? data.predictions[0] : null
  const b64: string | undefined = pred?.bytesBase64Encoded
  const mime: string = pred?.mimeType || 'image/png'
  if (!b64) return { detail: `${model}: sem imagem na resposta` }
  return { dataUrl: `data:${mime};base64,${b64}` }
}

async function tryGeminiImage(model: string, key: string, prompt: string, aspect: string, signal: AbortSignal): Promise<Attempt> {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nProporção da imagem: ${aspect}.` }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
    }),
  })
  if (!res.ok) return { detail: `${model} ${res.status}: ${(await res.text()).slice(0, 300)}` }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const img = Array.isArray(parts) ? parts.find((p: Record<string, unknown>) => p?.inlineData) : null
  const inline = (img as { inlineData?: { data?: string; mimeType?: string } })?.inlineData
  if (!inline?.data) return { detail: `${model}: sem imagem na resposta` }
  return { dataUrl: `data:${inline.mimeType || 'image/png'};base64,${inline.data}` }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const auth = await requireAdminAal2(req)
  if (!auth.ok) return json({ error: auth.error }, auth.status)

  let body: { prompt?: string; aspect?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  const prompt = (body.prompt ?? '').trim()
  if (prompt.length < 8) return json({ error: 'prompt vazio' }, 400)
  const aspect = ASPECTS.has(body.aspect ?? '') ? body.aspect! : '1:1'

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'no_key', message: 'GEMINI_API_KEY não configurada no servidor' })

  const configured = (Deno.env.get('GEMINI_IMAGE_MODEL') || '').trim()
  const models = [configured, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const tried: string[] = []
  try {
    for (const model of models) {
      try {
        const run = model.startsWith('imagen') ? tryImagen : tryGeminiImage
        const r = await run(model, key, prompt, aspect, controller.signal)
        if (r.dataUrl) return json({ dataUrl: r.dataUrl, model, aspect })
        if (r.detail) tried.push(r.detail)
      } catch (e) {
        tried.push(`${model}: ${(e as Error).message}`)
      }
    }
    const detail = tried.join(' | ').slice(0, 600)
    const quota = /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(detail)
    const permission = /\b403\b|PERMISSION_DENIED|not.*allow/i.test(detail)
    return json({ error: quota ? 'quota' : permission ? 'permission' : 'gemini_error', detail })
  } catch (e) {
    const msg = (e as Error).message || String(e)
    return json({ error: msg.includes('abort') ? 'timeout' : 'exception', detail: msg.slice(0, 300) })
  } finally {
    clearTimeout(timer)
  }
})
