// Mensagem de erro de uma Edge Function para mostrar ao usuário.
//
// Quando uma função responde com status de erro (400/500…), o supabase-js devolve um erro cujo
// `message` é sempre o texto genérico em inglês "Edge Function returned a non-2xx status code";
// o motivo real (já em português e pronto para o usuário) vem no corpo da resposta, dentro de
// `error.context`. Sem ler esse corpo, a pessoa vê só o texto genérico e ninguém descobre o que
// aconteceu (ex.: "Sem assinatura ativa para upgrade", "Você já tem uma assinatura ativa").

const GENERIC_TECHNICAL = /non-2xx|Failed to send a request|FunctionsHttpError|FunctionsFetchError|FunctionsRelayError|Failed to fetch|NetworkError/i

export const FUNCTION_ERROR_FALLBACK = 'Não foi possível concluir agora. Tente de novo em instantes ou fale com o suporte.'

const MAX_LENGTH = 300

function clean(text: unknown): string | null {
  if (typeof text !== 'string') return null
  const value = text.replace(/\s+/g, ' ').trim()
  if (!value || GENERIC_TECHNICAL.test(value)) return null
  return value.slice(0, MAX_LENGTH)
}

function fromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as { error?: unknown; message?: unknown }
  return clean(record.error) ?? clean(record.message)
}

/**
 * Devolve o melhor texto disponível, nesta ordem: corpo de erro da resposta da função,
 * `data.error` (quando a função respondeu 200 com erro), mensagem do erro se não for genérica,
 * e por fim `fallback` (ou o texto padrão em português).
 */
export async function serverErrorMessage(error: unknown, data: unknown, fallback: string = FUNCTION_ERROR_FALLBACK): Promise<string> {
  const context = (error as { context?: unknown } | null | undefined)?.context
  if (context && typeof (context as { json?: unknown }).json === 'function') {
    try {
      const body = await (context as { json: () => Promise<unknown> }).json()
      const message = fromBody(body)
      if (message) return message
    } catch {
      // corpo vazio ou que não é JSON: segue para as outras fontes
    }
  }
  const fromData = fromBody(data)
  if (fromData) return fromData
  const fromError = clean((error as { message?: unknown } | null | undefined)?.message)
  return fromError ?? fallback
}
