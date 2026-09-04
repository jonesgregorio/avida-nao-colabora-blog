import { createClient } from 'npm:@supabase/supabase-js@2'

// Resolve o modelo de IA a usar, na ordem:
//   1. ai_settings.gemini_model / groq_model (override editável no Admin)
//   2. secret GEMINI_MODEL / GROQ_MODEL do Supabase
//   3. default do código
//
// Modelos Gemini aposentados nunca são usados, mesmo se configurados — quando o
// Google retira um modelo (ex.: gemini-2.5-flash → HTTP 404) o default assume
// sozinho, sem deploy.

const LEGACY_GEMINI = new Set([
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash',
])
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

export interface AiModels {
  gemini: string
  groq: string
  geminiSource: 'db' | 'env' | 'default'
  groqSource: 'db' | 'env' | 'default'
}

export async function resolveAiModels(): Promise<AiModels> {
  let gemini = (Deno.env.get('GEMINI_MODEL') || '').split(',')[0]?.trim() || ''
  let groq = (Deno.env.get('GROQ_MODEL') || '').trim() || ''
  let geminiSource: AiModels['geminiSource'] = gemini ? 'env' : 'default'
  let groqSource: AiModels['groqSource'] = groq ? 'env' : 'default'

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (url && key) {
      const admin = createClient(url, key)
      const { data } = await admin
        .from('ai_settings')
        .select('gemini_model, groq_model')
        .eq('id', 1)
        .maybeSingle()
      const g = (data?.gemini_model || '').trim()
      const q = (data?.groq_model || '').trim()
      if (g) { gemini = g; geminiSource = 'db' }
      if (q) { groq = q; groqSource = 'db' }
    }
  } catch {
    // sem banco disponível → segue com env/default
  }

  if (!gemini || LEGACY_GEMINI.has(gemini)) { gemini = DEFAULT_GEMINI_MODEL; geminiSource = 'default' }
  if (!groq) { groq = DEFAULT_GROQ_MODEL; groqSource = 'default' }

  return { gemini, groq, geminiSource, groqSource }
}
