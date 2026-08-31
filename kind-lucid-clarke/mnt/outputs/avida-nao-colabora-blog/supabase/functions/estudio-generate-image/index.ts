import { requireAdminAal2 } from '../_shared/adminAuth.ts'

// ============================================================================
// estudio-generate-image — gera uma imagem para o Estúdio de Conteúdo.
// ----------------------------------------------------------------------------
// Recebe { prompt, aspect? } e devolve { dataUrl } (base64).
// Descobre os modelos de imagem disponíveis para a chave via ListModels e
// tenta cada um (Imagen via :predict, Gemini Image via :generateContent) até
// um funcionar. Assim não depende de um nome de modelo fixo.
//
// A chave GEMINI_API_KEY fica SÓ no servidor. Apenas admin AAL2 chama.
// Falha → { error, detail, disponiveis } (o cliente segue sem imagem).
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

// Candidatos conhecidos, usados se o ListModels não achar nada útil.
const FALLBACK_IMAGEN = ['imagen-3.0-generate-002', 'imagen-3.0-generate-001', 'imagen-4.0-generate-001']
const FALLBACK_GEMINI = ['gemini-2.5-flash-image-preview', 'gemini-2.0-flash-preview-image-generation']

interface ModelInfo { name?: string; supportedGenerationMethods?: string[] }
interface Attempt { dataUrl?: string; detail?: string }

async function discover(key: string, signal: AbortSignal): Promise<{ imagen: string[]; gemini: string[]; all: string[] }> {
  try {
    const res = await fetch(`${BASE}?key=${key}&pageSize=200`, { signal })
    if (!res.ok) return { imagen: [], gemini: [], all: [] }
    const data = await res.json()
    const models: ModelInfo[] = Array.isArray(data?.models) ? data.models : []
    const id = (m: ModelInfo) => (m.name ?? '').replace(/^models\//, '')
    const imagen = models.filter(m => /imagen/i.test(m.name ?? '') && (m.supportedGenerationMethods ?? []).includes('predict')).map(id)
    const gemini = models
      .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent') && /image|imagen|nano/i.test(m.name ?? ''))
      .map(id)
    return { imagen, gemini, all: models.map(id) }
  } catch {
    return { imagen: [], gemini: [], all: [] }
  }
}

async function tryImagen(model: string, key: string, prompt: string, aspect: string, signal: AbortSignal): Promise<Attempt> {
  const res = await fetch(`${BASE}/${model}:predict?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: aspect } }),
  })
  if (!res.ok) return { detail: `${model} ${res.status}: ${(await res.text()).slice(0, 200)}` }
  const data = await res.json()
  const pred = Array.isArray(data?.predictions) ? data.predictions[0] : null
  const b64: string | undefined = pred?.bytesBase64Encoded
  if (!b64) return { detail: `${model}: resposta sem imagem` }
  return { dataUrl: `data:${pred?.mimeType || 'image/png'};base64,${b64}` }
}

async function tryGemini(model: string, key: string, prompt: string, aspect: string, signal: AbortSignal): Promise<Attempt> {
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      contents: [{
        parts: [{
          text:
            'Gere UMA FOTOGRAFIA realista (não desenho, não ilustração, não cartoon, não 3D). ' +
            `Proporção ${aspect}.\n\n${prompt}`,
        }],
      }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    }),
  })
  if (!res.ok) return { detail: `${model} ${res.status}: ${(await res.text()).slice(0, 200)}` }
  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  const inline = Array.isArray(parts)
    ? (parts.find((p: Record<string, unknown>) => p?.inlineData) as { inlineData?: { data?: string; mimeType?: string } })?.inlineData
    : undefined
  if (!inline?.data) return { detail: `${model}: resposta sem imagem` }
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

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const tried: string[] = []
  try {
    const found = await discover(key, controller.signal)
    const configured = (Deno.env.get('GEMINI_IMAGE_MODEL') || '').trim()

    // ordem: modelo do secret → descobertos → candidatos conhecidos
    const imagenModels = [...new Set([...(configured ? [configured] : []), ...found.imagen, ...FALLBACK_IMAGEN])]
    const geminiModels = [...new Set([...found.gemini, ...FALLBACK_GEMINI])]

    for (const model of imagenModels) {
      const r = await tryImagen(model, key, prompt, aspect, controller.signal)
      if (r.dataUrl) return json({ dataUrl: r.dataUrl, model })
      if (r.detail) tried.push(r.detail)
    }
    for (const model of geminiModels) {
      const r = await tryGemini(model, key, prompt, aspect, controller.signal)
      if (r.dataUrl) return json({ dataUrl: r.dataUrl, model })
      if (r.detail) tried.push(r.detail)
    }

    const detail = tried.join(' | ').slice(0, 700)
    const quota = /\b429\b|RESOURCE_EXHAUSTED/i.test(detail)
    const permission = /\b403\b|PERMISSION_DENIED/i.test(detail)
    return json({
      error: quota ? 'quota' : permission ? 'permission' : 'sem_modelo_de_imagem',
      detail,
      disponiveis: found.all.filter(n => /image|imagen|vision|flash/i.test(n)).slice(0, 20),
    })
  } catch (e) {
    const msg = (e as Error).message || String(e)
    return json({ error: msg.includes('abort') ? 'timeout' : 'exception', detail: msg.slice(0, 300) })
  } finally {
    clearTimeout(timer)
  }
})
