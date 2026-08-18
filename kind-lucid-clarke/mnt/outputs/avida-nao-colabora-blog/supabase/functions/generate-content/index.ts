import { createClient } from 'npm:@supabase/supabase-js@2'

// Proxy seguro de IA (server-side). As chaves vivem somente no Supabase.
// Uma geração faz no máximo UMA chamada de rede por provedor:
// Gemini -> Groq -> OpenAI (quando a chave existir).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const TIMEOUT_MS = 60_000
const MAX_OUTPUT_TOKENS = 8000
// O tier atual do Groq neste projeto expõe 8K TPM. Reservamos margem para
// overhead/tokenização e reduzimos dinamicamente a saída conforme o prompt.
const GROQ_TPM_SAFE_BUDGET = 7600
const GROQ_MAX_OUTPUT_TOKENS = 7000

type Provider = 'gemini' | 'groq' | 'openai'
type ResponseFormat = 'text' | 'json'
type ProviderFailureKind = 'auth' | 'permission' | 'model' | 'quota' | 'transient' | 'invalid_response' | 'configuration' | 'unknown'

const PROVIDERS: Provider[] = ['gemini', 'groq', 'openai']
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'

const DEPRECATED_GROQ_MODELS = new Set([
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
])

// Modelos/aliases antigos que já foram aposentados ou são inadequados como
// default estável para este projeto. Secrets antigos não podem reativá-los.
const LEGACY_GEMINI_MODELS = new Set([
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
])

const GEMINI_MODEL = (() => {
  const configured = (Deno.env.get('GEMINI_MODEL') || '').split(',')[0]?.trim()
  if (!configured || LEGACY_GEMINI_MODELS.has(configured)) return DEFAULT_GEMINI_MODEL
  return configured
})()

const GROQ_MODEL = (() => {
  const configured = (Deno.env.get('GROQ_MODEL') || '').trim()
  if (!configured || DEPRECATED_GROQ_MODELS.has(configured)) return DEFAULT_GROQ_MODEL
  return configured
})()

const OPENAI_MODEL = (Deno.env.get('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL).trim()

function providerOrder(): Provider[] {
  const values = (Deno.env.get('AI_PROVIDER_ORDER') || 'gemini,groq,openai')
    .split(',')
    .map(v => v.trim().toLowerCase())
  const ordered: Provider[] = []
  for (const value of values) {
    if (PROVIDERS.includes(value as Provider) && !ordered.includes(value as Provider)) {
      ordered.push(value as Provider)
    }
  }
  return ordered.length ? ordered : [...PROVIDERS]
}

function providerHasKey(provider: Provider): boolean {
  if (provider === 'gemini') return !!Deno.env.get('GEMINI_API_KEY')
  if (provider === 'groq') return !!Deno.env.get('GROQ_API_KEY')
  return !!Deno.env.get('OPENAI_API_KEY')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

class ProviderFailure extends Error {
  provider: Provider
  status: number | null
  kind: ProviderFailureKind
  code: string | null
  retryAfter: string | null
  model: string

  constructor(args: {
    provider: Provider
    model: string
    message: string
    status?: number | null
    kind?: ProviderFailureKind
    code?: string | null
    retryAfter?: string | null
  }) {
    super(args.message)
    this.name = 'ProviderFailure'
    this.provider = args.provider
    this.model = args.model
    this.status = args.status ?? null
    this.kind = args.kind ?? 'unknown'
    this.code = args.code ?? null
    this.retryAfter = args.retryAfter ?? null
  }
}

function classifyStatus(status: number): ProviderFailureKind {
  if (status === 401) return 'auth'
  if (status === 403) return 'permission'
  if (status === 404) return 'model'
  if (status === 429) return 'quota'
  if (status === 408 || status === 503 || status >= 500) return 'transient'
  return 'unknown'
}

async function failureFromResponse(provider: Provider, model: string, response: Response): Promise<ProviderFailure> {
  let providerCode: string | null = null
  let providerMessage = ''
  try {
    const raw = await response.text()
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        providerCode = String(parsed?.error?.status || parsed?.error?.code || parsed?.code || '').trim() || null
        providerMessage = String(parsed?.error?.message || parsed?.message || '').trim()
      } catch {
        providerMessage = raw.replace(/\s+/g, ' ').trim()
      }
    }
  } catch {
    // body de erro é apenas diagnóstico; status HTTP continua sendo a fonte principal
  }

  const safeProviderMessage = providerMessage.slice(0, 240)
  const suffix = safeProviderMessage ? ` — ${safeProviderMessage}` : ''
  const providerSaysRateLimited = providerCode === 'rate_limit_exceeded'
    || /tokens per minute|rate.?limit|quota/i.test(providerMessage)
  return new ProviderFailure({
    provider,
    model,
    status: response.status,
    kind: providerSaysRateLimited ? 'quota' : classifyStatus(response.status),
    code: providerCode,
    retryAfter: response.headers.get('retry-after'),
    message: `${provider} HTTP ${response.status} (${model})${suffix}`,
  })
}

function groqCompletionBudget(prompt: string): number {
  // Estimativa conservadora para pt-BR: ~3 caracteres/token. O objetivo aqui
  // não é contar tokens com precisão, mas impedir que max_completion_tokens +
  // prompt ultrapassem o TPM de 8K antes mesmo da geração começar.
  const estimatedInputTokens = Math.ceil(prompt.length / 3)
  const available = GROQ_TPM_SAFE_BUDGET - estimatedInputTokens
  if (available < 256) {
    throw new ProviderFailure({
      provider: 'groq',
      model: GROQ_MODEL,
      kind: 'quota',
      message: 'Groq: prompt grande demais para o orçamento TPM disponível nesta chamada',
    })
  }
  return Math.min(GROQ_MAX_OUTPUT_TOKENS, available)
}

const QUESTIONNAIRE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    short_description: { type: 'string' },
    intro_text: { type: 'string' },
    completion_text: { type: 'string' },
    estimated_time: { type: 'integer' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          type: { type: 'string', enum: ['single_choice'] },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                score: { type: 'integer' },
              },
              required: ['text', 'score'],
            },
          },
        },
        required: ['text', 'type', 'options'],
      },
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          min: { type: 'integer' },
          max: { type: 'integer' },
          label: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string' },
        },
        required: ['min', 'max', 'label', 'description', 'color'],
      },
    },
  },
  required: [
    'title',
    'short_description',
    'intro_text',
    'completion_text',
    'estimated_time',
    'questions',
    'results',
  ],
} as const

function cleanJsonText(text: string): string {
  return text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
}

function parseJson(text: string): unknown {
  return JSON.parse(cleanJsonText(text))
}

function isQuestionnairePrompt(prompt: string): boolean {
  return /question[aá]rio/i.test(prompt) && /"questions"|perguntas/i.test(prompt)
}

function inferResponseFormat(prompt: string, requested?: ResponseFormat): ResponseFormat {
  if (requested === 'json') return 'json'
  if (requested === 'text') return 'text'
  return /\bjson\b/i.test(prompt) ? 'json' : 'text'
}

function validateStructuredOutput(text: string, questionnaire: boolean): void {
  let parsed: unknown
  try {
    parsed = parseJson(text)
  } catch {
    throw new Error('JSON inválido retornado pelo provedor')
  }

  if (!questionnaire) return
  const obj = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
  const questions = Array.isArray(obj?.questions) ? obj!.questions : []
  const results = Array.isArray(obj?.results) ? obj!.results : []
  const questionShapeOk = questions.length === 5 && questions.every(q => {
    if (!q || typeof q !== 'object' || Array.isArray(q)) return false
    const row = q as Record<string, unknown>
    const options = Array.isArray(row.options) ? row.options : []
    return typeof row.text === 'string'
      && row.type === 'single_choice'
      && options.length === 3
      && options.every(o => {
        if (!o || typeof o !== 'object' || Array.isArray(o)) return false
        const option = o as Record<string, unknown>
        const score = Number(option.score)
        return typeof option.text === 'string' && Number.isInteger(score) && score >= 1 && score <= 3
      })
  })

  if (
    !obj
    || typeof obj.title !== 'string'
    || typeof obj.short_description !== 'string'
    || typeof obj.intro_text !== 'string'
    || typeof obj.completion_text !== 'string'
    || !Number.isFinite(Number(obj.estimated_time))
    || !questionShapeOk
    || results.length < 1
  ) {
    throw new Error('JSON do questionário não corresponde ao schema esperado')
  }
}

async function callGemini(prompt: string, format: ResponseFormat, questionnaire: boolean): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) {
    throw new ProviderFailure({
      provider: 'gemini',
      model: GEMINI_MODEL,
      kind: 'configuration',
      message: 'Gemini: GEMINI_API_KEY não configurada no servidor',
    })
  }

  const generationConfig: Record<string, unknown> = { maxOutputTokens: MAX_OUTPUT_TOKENS }
  if (format === 'json') {
    generationConfig.responseMimeType = 'application/json'
    if (questionnaire) generationConfig.responseSchema = QUESTIONNAIRE_SCHEMA
  }

  let response: Response
  try {
    response = await withTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      },
    )
  } catch (err) {
    throw new ProviderFailure({
      provider: 'gemini',
      model: GEMINI_MODEL,
      kind: 'transient',
      message: `Gemini: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  if (!response.ok) throw await failureFromResponse('gemini', GEMINI_MODEL, response)
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text || !String(text).trim()) {
    throw new ProviderFailure({
      provider: 'gemini',
      model: GEMINI_MODEL,
      kind: 'invalid_response',
      message: 'Gemini: resposta vazia',
    })
  }
  const finalText = String(text).trim()
  try {
    if (format === 'json') validateStructuredOutput(finalText, questionnaire)
  } catch (err) {
    throw new ProviderFailure({
      provider: 'gemini',
      model: GEMINI_MODEL,
      kind: 'invalid_response',
      message: `Gemini: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
  return { text: finalText, model: GEMINI_MODEL }
}

async function callGroq(prompt: string, format: ResponseFormat, questionnaire: boolean): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) {
    throw new ProviderFailure({
      provider: 'groq',
      model: GROQ_MODEL,
      kind: 'configuration',
      message: 'Groq: GROQ_API_KEY não configurada no servidor',
    })
  }

  const requestBody: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: groqCompletionBudget(prompt),
    reasoning_effort: 'low',
    reasoning_format: 'hidden',
  }
  if (format === 'json') {
    requestBody.response_format = { type: 'json_object' }
  }

  let response: Response
  try {
    response = await withTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    throw new ProviderFailure({
      provider: 'groq',
      model: GROQ_MODEL,
      kind: 'transient',
      message: `Groq: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  if (!response.ok) throw await failureFromResponse('groq', GROQ_MODEL, response)
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || !String(text).trim()) {
    throw new ProviderFailure({
      provider: 'groq',
      model: GROQ_MODEL,
      kind: 'invalid_response',
      message: 'Groq: resposta vazia',
    })
  }
  const finalText = String(text).trim()
  try {
    if (format === 'json') validateStructuredOutput(finalText, questionnaire)
  } catch (err) {
    throw new ProviderFailure({
      provider: 'groq',
      model: GROQ_MODEL,
      kind: 'invalid_response',
      message: `Groq: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
  return { text: finalText, model: GROQ_MODEL }
}

async function callOpenAI(prompt: string, format: ResponseFormat, questionnaire: boolean): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('OPENAI_API_KEY')
  if (!key) {
    throw new ProviderFailure({
      provider: 'openai',
      model: OPENAI_MODEL,
      kind: 'configuration',
      message: 'OpenAI: OPENAI_API_KEY não configurada no servidor',
    })
  }

  const requestBody: Record<string, unknown> = {
    model: OPENAI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_OUTPUT_TOKENS,
  }
  if (format === 'json') requestBody.response_format = { type: 'json_object' }

  let response: Response
  try {
    response = await withTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(requestBody),
    })
  } catch (err) {
    throw new ProviderFailure({
      provider: 'openai',
      model: OPENAI_MODEL,
      kind: 'transient',
      message: `OpenAI: ${err instanceof Error ? err.message : String(err)}`,
    })
  }

  if (!response.ok) throw await failureFromResponse('openai', OPENAI_MODEL, response)
  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text || !String(text).trim()) {
    throw new ProviderFailure({
      provider: 'openai',
      model: OPENAI_MODEL,
      kind: 'invalid_response',
      message: 'OpenAI: resposta vazia',
    })
  }
  const finalText = String(text).trim()
  try {
    if (format === 'json') validateStructuredOutput(finalText, questionnaire)
  } catch (err) {
    throw new ProviderFailure({
      provider: 'openai',
      model: OPENAI_MODEL,
      kind: 'invalid_response',
      message: `OpenAI: ${err instanceof Error ? err.message : String(err)}`,
    })
  }
  return { text: finalText, model: OPENAI_MODEL }
}

const FN: Record<Provider, (prompt: string, format: ResponseFormat, questionnaire: boolean) => Promise<{ text: string; model: string }>> = {
  gemini: callGemini,
  groq: callGroq,
  openai: callOpenAI,
}

// Vídeos de referência: a IA devolve ::video-query{...}; o servidor resolve para
// um vídeo real ou para um link de busca, sem inventar URL.
const MAX_VIDEOS = 1
const searchLink = (q: string): string =>
  `[▶ Ver vídeos sobre “${q}” no YouTube](https://www.youtube.com/results?search_query=${encodeURIComponent(q)})`

async function searchYouTube(query: string): Promise<{ id: string; title: string } | null> {
  const key = Deno.env.get('YOUTUBE_API_KEY')
  if (!key) return null
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&order=relevance&maxResults=5&relevanceLanguage=pt&regionCode=BR&q=${encodeURIComponent(query)}&key=${key}`
    const res = await withTimeout(url, { method: 'GET' })
    if (!res.ok) return null
    const data = await res.json()
    const items = (Array.isArray(data?.items) ? data.items : [])
      .filter((it: { id?: { videoId?: string } }) => it?.id?.videoId)
    if (!items.length) return null
    const item = items[0]
    const id = item.id.videoId
    const title = String(item?.snippet?.title ?? query).replace(/\[|\]/g, '').trim()
    return { id, title: title || query }
  } catch {
    return null
  }
}

async function resolveVideoMarkers(text: string): Promise<string> {
  const re = /^[ \t]*::video-query\{([^}]+)\}[ \t]*$/gm
  const queries = [...text.matchAll(re)].map(m => m[1].trim()).filter(Boolean)
  if (!queries.length) return text

  const map = new Map<string, string>()
  let embedded = 0
  for (const q of [...new Set(queries)]) {
    if (embedded < MAX_VIDEOS) {
      const video = await searchYouTube(q)
      if (video) {
        map.set(q, `::video[${video.title}](https://www.youtube-nocookie.com/embed/${video.id})`)
        embedded++
        continue
      }
    }
    map.set(q, searchLink(q))
  }
  return text.replace(re, (_match, q) => map.get(String(q).trim()) ?? searchLink(String(q).trim()))
}

function serializeFailure(err: unknown): string {
  if (err instanceof ProviderFailure) {
    const code = err.code ? ` code=${err.code}` : ''
    const retry = err.retryAfter ? ` retry_after=${err.retryAfter}` : ''
    return `${err.provider}: ${err.message} kind=${err.kind}${code}${retry}`.slice(0, 420)
  }
  return (err instanceof Error ? err.message : String(err)).slice(0, 420)
}

function friendlyFailure(errors: ProviderFailure[]): { message: string; code: string; limitReached: boolean } {
  const hasQuota = errors.some(e => e.kind === 'quota')
  const hasTransient = errors.some(e => e.kind === 'transient')
  const onlyConfiguration = errors.length > 0 && errors.every(e =>
    ['auth', 'permission', 'model', 'configuration'].includes(e.kind)
  )

  if (hasQuota) {
    return {
      message: 'A geração por IA atingiu um limite temporário de uso. Tente novamente mais tarde.',
      code: 'AI_RATE_LIMITED',
      limitReached: true,
    }
  }
  if (hasTransient) {
    return {
      message: 'A geração por IA está temporariamente indisponível. Tente novamente em alguns instantes.',
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      limitReached: false,
    }
  }
  if (onlyConfiguration) {
    return {
      message: 'A geração por IA está indisponível no momento. A configuração dos provedores precisa ser verificada.',
      code: 'AI_PROVIDER_CONFIGURATION',
      limitReached: false,
    }
  }
  return {
    message: 'Não foi possível gerar o conteúdo agora. Tente novamente em instantes.',
    code: 'AI_GENERATION_FAILED',
    limitReached: false,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Não autenticado' }, 401)

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json({ error: 'Sessão inválida' }, 401)

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (profile?.role !== 'admin') return json({ error: 'Acesso restrito a administradores' }, 403)

  let body: {
    prompt?: string
    provider?: Provider
    test?: boolean
    contentType?: string
    tema?: string
    tipo?: string
    frequencia?: string
    responseFormat?: ResponseFormat
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400)
  }

  let prompt = body.prompt
  if (!prompt && body.tema) {
    prompt = `Você é um redator de saúde emocional. Crie um conteúdo do tipo "${body.tipo ?? 'dica'}" sobre "${body.tema}" (frequência: ${body.frequencia ?? 'diário'}). Português brasileiro, tom acolhedor, 150-250 palavras, sem markdown, termine encorajando. Retorne apenas o texto.`
  }
  if (!prompt?.trim()) return json({ error: 'prompt vazio' }, 400)
  prompt = prompt.trim()

  const order = providerOrder()
  const requested = body.provider && PROVIDERS.includes(body.provider)
    ? body.provider
    : (order[0] ?? 'gemini')

  const chain: Provider[] = body.test
    ? [requested]
    : [requested, ...order.filter(p => p !== requested)]
        .filter((p, index, all) => all.indexOf(p) === index)
        .filter(providerHasKey)

  if (!body.test && !chain.length) {
    const fallback = order.filter(providerHasKey)
    chain.push(...fallback)
  }

  const format = inferResponseFormat(prompt, body.responseFormat)
  const questionnaire = format === 'json' && isQuestionnairePrompt(prompt)
  const failures: ProviderFailure[] = []
  const tried: string[] = []

  for (const provider of chain) {
    try {
      const generated = await FN[provider](prompt, format, questionnaire)
      let text = generated.text
      try {
        if (format === 'text') text = await resolveVideoMarkers(text)
      } catch {
        // vídeo é enriquecimento opcional; nunca deve derrubar a geração principal
      }

      admin.from('ai_generation_logs').insert({
        admin_id: user.id,
        content_type: body.contentType ?? 'generic',
        prompt_preview: prompt.slice(0, 280),
        result_preview: text.slice(0, 280),
        provider,
        status: 'success',
      }).then(() => {}, () => {})

      return json({
        text,
        content: text,
        provider,
        model: generated.model,
      })
    } catch (err) {
      const failure = err instanceof ProviderFailure
        ? err
        : new ProviderFailure({
            provider,
            model: provider === 'gemini' ? GEMINI_MODEL : provider === 'groq' ? GROQ_MODEL : OPENAI_MODEL,
            kind: 'unknown',
            message: err instanceof Error ? err.message : String(err),
          })
      failures.push(failure)
      tried.push(serializeFailure(failure))
      // Uma tentativa por provedor: sem loops internos de retry.
    }
  }

  const errorMsg = `Todas as IAs falharam. ${tried.join(' | ')}`.slice(0, 1200)
  admin.from('ai_generation_logs').insert({
    admin_id: user.id,
    content_type: body.contentType ?? 'generic',
    prompt_preview: prompt.slice(0, 280),
    provider: requested,
    status: 'error',
    error_msg: errorMsg.slice(0, 500),
  }).then(() => {}, () => {})

  const friendly = friendlyFailure(failures)

  if (friendly.limitReached) {
    try {
      const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
      const { data: recent } = await admin.from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'alert')
        .ilike('title', '%limite de IA%')
        .gte('created_at', oneHourAgo)
        .limit(1)
        .maybeSingle()
      if (!recent) {
        await admin.from('notifications').insert({
          user_id: user.id,
          type: 'alert',
          is_read: false,
          title: 'Limite de IA atingido',
          message: 'A geração por IA atingiu um limite temporário de uso. O sistema tentará outro provedor quando disponível.',
        })
      }
    } catch {
      // notificação é secundária
    }
  }

  return json({
    error: friendly.message,
    error_code: friendly.code,
    limit_reached: friendly.limitReached,
    ...(body.test ? { detail: errorMsg } : {}),
  })
})
