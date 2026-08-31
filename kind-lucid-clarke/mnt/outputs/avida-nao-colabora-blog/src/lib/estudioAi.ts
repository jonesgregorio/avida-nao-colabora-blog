import { supabase } from './supabase'
import { buildCaptionRequest, buildImagePromptRequest, type EstudioBrief } from './estudioPrompts'

// Chamadas de IA do Estúdio. Reusa o proxy admin `generate-content` (mesmo
// endpoint da Fábrica de IA e do criador de e-mails) — nenhuma Edge Function
// nova, nenhuma chave no front. O endpoint já é admin-only e faz fallback
// entre provedores.

export interface ImagePromptResult {
  prompt: string
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
    racional: String(j.racional ?? '').trim(),
    tituloSugerido: String(j.titulo_sugerido ?? '').trim(),
  }
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

export function estudioAiMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível gerar agora. Tente novamente.'
}
