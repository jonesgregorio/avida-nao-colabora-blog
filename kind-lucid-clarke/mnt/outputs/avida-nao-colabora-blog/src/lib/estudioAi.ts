import { supabase } from './supabase'
import { buildCaptionRequest, buildImagePromptRequest, buildPhraseRequest, type EstudioBrief } from './estudioPrompts'
import { buildWeekPlanRequest, parseWeekPlan, type BlogContext, type PlanItem } from './estudioPlan'
import { buildPerfReadingRequest, type PerfRow } from './estudioPerformance'
import { buildReelScriptRequest, parseReelScript, type ReelScript } from './estudioReel'
import { buildInspirationAnalysisRequest } from './estudioInspiration'
import { buildCommentRequest } from './estudioCommunity'

// Chamadas de IA do Estúdio. Reusa o proxy admin `generate-content` (mesmo
// endpoint da Fábrica de IA e do criador de e-mails) — nenhuma Edge Function
// nova, nenhuma chave no front. O endpoint já é admin-only e faz fallback
// entre provedores.

export interface ImagePromptResult {
  prompt: string
  negativos: string
  precisaGerar: boolean
  racional: string
  tituloSugerido: string
}

export interface CaptionResult {
  legendas: { rotulo: string; texto: string }[]
  hashtags: string
  primeiroComentario: string
}

class EstudioAiError extends Error {}

function extractJson(data: unknown): Record<string, unknown> {
  const raw =
    typeof data === 'string'
      ? data
      : ((data as { text?: string; content?: string; error?: string })?.text ??
         (data as { content?: string })?.content ??
         '')
  const err = (data as { error?: string })?.error
  if (!raw && err) throw new EstudioAiError(err)
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new EstudioAiError('A IA não retornou um JSON válido. Tente de novo.')
  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    throw new EstudioAiError('Não consegui ler a resposta da IA. Tente de novo.')
  }
}

async function callGenerateContent(prompt: string, contentType: string): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { prompt, contentType, responseFormat: 'json' },
  })
  if (error) throw new EstudioAiError(error.message)
  return data
}

export async function generateImagePrompt(brief: EstudioBrief): Promise<ImagePromptResult> {
  const data = await callGenerateContent(buildImagePromptRequest(brief), 'estudio-image-prompt')
  const j = extractJson(data)
  return {
    prompt: String(j.prompt ?? '').trim(),
    negativos: String(j.negativos ?? '').trim(),
    precisaGerar: j.precisa_gerar !== false,
    racional: String(j.racional ?? '').trim(),
    tituloSugerido: String(j.titulo_sugerido ?? '').trim(),
  }
}

export interface PhraseResult {
  frase: string
  alternativas: string[]
}

export async function generatePhrase(brief: EstudioBrief): Promise<PhraseResult> {
  const data = await callGenerateContent(buildPhraseRequest(brief), 'estudio-phrase')
  const j = extractJson(data)
  const frase = String(j.frase ?? '').trim()
  if (!frase) throw new EstudioAiError('A IA não retornou uma frase. Tente de novo.')
  const alternativas = Array.isArray(j.alternativas)
    ? (j.alternativas as unknown[]).map(a => String(a ?? '').trim()).filter(Boolean)
    : []
  return { frase, alternativas }
}

export async function generateCaptions(brief: EstudioBrief): Promise<CaptionResult> {
  const data = await callGenerateContent(buildCaptionRequest(brief), 'estudio-caption')
  const j = extractJson(data)
  const legendas = Array.isArray(j.legendas)
    ? (j.legendas as unknown[])
        .map(l => ({
          rotulo: String((l as { rotulo?: string })?.rotulo ?? '').trim(),
          texto: String((l as { texto?: string })?.texto ?? '').trim(),
        }))
        .filter(l => l.texto)
    : []
  if (!legendas.length) throw new EstudioAiError('A IA não retornou legendas. Tente de novo.')
  return {
    legendas,
    hashtags: String(j.hashtags ?? '').trim(),
    primeiroComentario: String(j.primeiro_comentario_cta ?? '').trim(),
  }
}

export async function generateWeekPlan(ctx: BlogContext): Promise<PlanItem[]> {
  const data = await callGenerateContent(buildWeekPlanRequest(ctx), 'estudio-week-plan')
  const items = parseWeekPlan(extractJson(data))
  if (!items.length) throw new EstudioAiError('A IA não retornou um plano utilizável. Tente de novo.')
  return items
}

export async function generateReelScript(brief: EstudioBrief): Promise<ReelScript> {
  const data = await callGenerateContent(buildReelScriptRequest(brief), 'estudio-reel-script')
  const script = parseReelScript(extractJson(data))
  if (!script.blocos.length) throw new EstudioAiError('A IA não retornou um roteiro utilizável. Tente de novo.')
  return script
}

async function callGenerateContentText(prompt: string, contentType: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-content', {
    body: { prompt, contentType, responseFormat: 'text' },
  })
  if (error) throw new EstudioAiError(error.message)
  const txt =
    typeof data === 'string'
      ? data
      : ((data as { text?: string; content?: string; error?: string })?.text ??
         (data as { content?: string })?.content ?? '')
  const errMsg = (data as { error?: string })?.error
  if (!txt.trim()) throw new EstudioAiError(errMsg || 'A IA não retornou um texto. Tente de novo.')
  return txt.trim()
}

export function generatePerformanceReading(rows: PerfRow[]): Promise<string> {
  return callGenerateContentText(buildPerfReadingRequest(rows), 'estudio-performance')
}

export function generateInspirationAnalysis(handle: string, tema: string, legendas: string): Promise<string> {
  return callGenerateContentText(buildInspirationAnalysisRequest(handle, tema, legendas), 'estudio-inspiration')
}

export function generateCommunityComment(alvo: string, descricaoPost: string): Promise<string> {
  return callGenerateContentText(buildCommentRequest(alvo, descricaoPost), 'estudio-community')
}

const IMAGE_ASPECT: Record<string, string> = {
  'feed-11': '1:1', destaque: '9:16', story: '9:16', 'reel-capa': '9:16',
  'feed-45': '3:4', carrossel: '3:4', quiz: '3:4',
}

export interface GeneratedImage {
  dataUrl: string
  model: string
}

/** Gera uma imagem via Edge Function isolada (Gemini/Imagen). Custo por imagem. */
export async function generateImage(prompt: string, opts: { formato?: string } = {}): Promise<GeneratedImage> {
  const aspect = opts.formato ? IMAGE_ASPECT[opts.formato] ?? '1:1' : '1:1'
  const { data, error } = await supabase.functions.invoke('estudio-generate-image', {
    body: { prompt, aspect },
  })
  if (error) throw new EstudioAiError(error.message)
  const d = data as { dataUrl?: string; model?: string; error?: string; message?: string; detail?: string; disponiveis?: string[] }
  if (d?.dataUrl) return { dataUrl: d.dataUrl, model: d.model ?? '' }
  if (d?.error === 'no_key') throw new EstudioAiError('Geração de imagem não está configurada no servidor.')
  if (d?.error === 'quota') throw new EstudioAiError('Cota de imagem do Gemini atingida. Tente mais tarde.')
  if (d?.error === 'timeout') throw new EstudioAiError('A geração demorou demais e foi cancelada. Tente de novo.')
  const disp = d?.disponiveis?.length ? ` Modelos de imagem no seu projeto: ${d.disponiveis.join(', ')}.` : ''
  if (d?.error === 'permission') throw new EstudioAiError(`O projeto Gemini não tem acesso aos modelos de imagem.${disp} ${d.detail ?? ''}`.trim())
  if (d?.error === 'sem_modelo_de_imagem') throw new EstudioAiError(`Nenhum modelo de imagem funcionou.${disp} Defina GEMINI_IMAGE_MODEL no Supabase com um deles.`.trim())
  throw new EstudioAiError(`Não foi possível gerar a imagem. ${d?.detail ?? d?.message ?? d?.error ?? ''}`.trim())
}

export function estudioAiMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível gerar agora. Tente novamente.'
}
