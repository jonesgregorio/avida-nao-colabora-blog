type Provider = 'gemini' | 'groq' | 'openai'

type ProviderRequest = {
  provider: Provider
  model: string
  kind: 'weekly_report' | 'monthly_deep_report' | 'self_care_plan' | 'unknown'
}

const PROVIDER_HOSTS = new Set([
  'generativelanguage.googleapis.com',
  'api.groq.com',
  'api.openai.com',
])

const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])

function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(Deno.env.get(name) || fallback)
  return Number.isFinite(raw) ? Math.min(max, Math.max(min, Math.round(raw))) : fallback
}

const timeoutMs = () => envInt('EMOTIONAL_AI_TIMEOUT_MS', 8_000, 4_000, 15_000)
const attempts = () => envInt('EMOTIONAL_AI_ATTEMPTS', 2, 1, 2)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function compact(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

function providerFromUrl(url: URL): Provider | null {
  if (url.hostname === 'generativelanguage.googleapis.com') return 'gemini'
  if (url.hostname === 'api.groq.com') return 'groq'
  if (url.hostname === 'api.openai.com') return 'openai'
  return null
}

function bodyText(init?: RequestInit): string {
  return typeof init?.body === 'string' ? init.body : ''
}

function modelFrom(provider: Provider, url: URL, init?: RequestInit): string {
  if (provider === 'gemini') {
    const match = url.pathname.match(/\/models\/([^:/]+):generateContent/)
    return match?.[1] || 'desconhecido'
  }
  try {
    const parsed = JSON.parse(bodyText(init))
    return compact(parsed?.model || 'desconhecido')
  } catch { return 'desconhecido' }
}

function promptFrom(provider: Provider, init?: RequestInit): string {
  try {
    const parsed = JSON.parse(bodyText(init))
    if (provider === 'gemini') return String(parsed?.contents?.[0]?.parts?.[0]?.text || '')
    return String(parsed?.messages?.[0]?.content || '')
  } catch { return '' }
}

function kindFromPrompt(prompt: string): ProviderRequest['kind'] {
  if (/self_care_plan|three_care_priorities/.test(prompt)) return 'self_care_plan'
  if (/monthly_deep_report/.test(prompt)) return 'monthly_deep_report'
  if (/weekly_report/.test(prompt)) return 'weekly_report'
  return 'unknown'
}

async function technicalError(res: Response): Promise<string> {
  try {
    const raw = await res.clone().text()
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw)
      return compact(parsed?.error?.message || parsed?.message || parsed?.error || '')
    } catch { return compact(raw) }
  } catch { return '' }
}

async function generatedText(provider: Provider, res: Response): Promise<string> {
  const data = await res.clone().json().catch(() => null)
  if (provider === 'gemini') return String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '')
  return String(data?.choices?.[0]?.message?.content || '')
}

function parseInnerJson(text: string): Record<string, unknown> | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const value = JSON.parse(match?.[0] || '')
    return value && typeof value === 'object' ? value as Record<string, unknown> : null
  } catch { return null }
}

function validShape(kind: ProviderRequest['kind'], value: Record<string, unknown>): boolean {
  if (kind === 'self_care_plan') {
    return typeof value.main_focus === 'string'
      && value.main_focus.trim().length >= 8
      && Array.isArray(value.three_care_priorities)
      && value.three_care_priorities.length >= 3
  }
  if (kind === 'weekly_report' || kind === 'monthly_deep_report') {
    return typeof value.summary === 'string' && value.summary.trim().length >= 12
  }
  return true
}

function retryDelay(res: Response | null, attempt: number): number {
  const retryAfter = res?.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(2_500, Math.max(250, seconds * 1_000))
  }
  return Math.min(1_500, 400 * attempt)
}

function warn(req: ProviderRequest, reason: string, attempt: number) {
  // Nunca registra prompt, resposta emocional ou chaves. Só diagnóstico técnico.
  console.warn(`[emotional-ai] provider=${req.provider} model=${req.model} kind=${req.kind} attempt=${attempt} reason=${compact(reason)}`)
}

export function installEmotionalProviderReliability() {
  const originalFetch = globalThis.fetch.bind(globalThis)

  globalThis.fetch = async (input: Request | URL | string, init?: RequestInit): Promise<Response> => {
    const target = input instanceof Request ? new URL(input.url) : new URL(String(input))
    if (!PROVIDER_HOSTS.has(target.hostname)) return originalFetch(input, init)

    const provider = providerFromUrl(target)
    if (!provider) return originalFetch(input, init)

    const req: ProviderRequest = {
      provider,
      model: modelFrom(provider, target, init),
      kind: kindFromPrompt(promptFrom(provider, init)),
    }

    let lastReason = 'falha desconhecida'
    for (let attempt = 1; attempt <= attempts(); attempt++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs())
      let response: Response | null = null
      try {
        response = await originalFetch(input, { ...init, signal: controller.signal })
        if (!response.ok) {
          const detail = await technicalError(response)
          lastReason = `HTTP ${response.status}${detail ? ` — ${detail}` : ''}`
          warn(req, lastReason, attempt)
          if (!TRANSIENT_STATUS.has(response.status) || attempt >= attempts()) return response
        } else {
          const text = await generatedText(provider, response)
          const parsed = parseInnerJson(text)
          if (!text.trim()) {
            lastReason = 'resposta vazia'
            warn(req, lastReason, attempt)
          } else if (!parsed) {
            lastReason = 'JSON inválido'
            warn(req, lastReason, attempt)
          } else if (!validShape(req.kind, parsed)) {
            lastReason = 'formato incompleto para o tipo de conteúdo'
            warn(req, lastReason, attempt)
          } else {
            return response
          }

          // Resposta HTTP 200, mas conteúdo inválido: uma tentativa extra pode
          // resolver respostas truncadas antes de passar ao próximo provedor.
          if (attempt >= attempts()) throw new Error(`${req.provider}:${req.model}:${lastReason}`)
        }
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === 'AbortError'
        lastReason = aborted ? `timeout após ${timeoutMs()}ms` : compact(error instanceof Error ? error.message : error)
        warn(req, lastReason, attempt)
        if (attempt >= attempts()) throw new Error(`${req.provider}:${req.model}:${lastReason}`)
      } finally {
        clearTimeout(timer)
      }
      await sleep(retryDelay(response, attempt))
    }

    throw new Error(`${req.provider}:${req.model}:${lastReason}`)
  }
}
