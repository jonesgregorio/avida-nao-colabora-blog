// Rotina de comunidade do Estúdio (Fase 4b) — tipos, prompt e métricas.
// Puro. A ferramenta nunca interage automaticamente: só sugere e registra.

export type InteracaoStatus = 'sugerido' | 'feito' | 'respondeu'

export interface Interacao {
  id: string
  alvo: string
  postUrl: string | null
  descricaoPost: string | null
  comentarioSugerido: string | null
  comentarioUsado: string | null
  status: InteracaoStatus
  feitoEm: string | null
  createdAt: string
  updatedAt: string
}

export interface InteracaoInput {
  alvo: string
  postUrl?: string | null
  descricaoPost?: string | null
  comentarioSugerido?: string | null
  comentarioUsado?: string | null
  status?: InteracaoStatus
}

export function rowToInteracao(r: Record<string, unknown>): Interacao {
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  const st = r.status
  return {
    id: String(r.id),
    alvo: String(r.alvo ?? ''),
    postUrl: s(r.post_url),
    descricaoPost: s(r.descricao_post),
    comentarioSugerido: s(r.comentario_sugerido),
    comentarioUsado: s(r.comentario_usado),
    status: (['sugerido', 'feito', 'respondeu'].includes(st as string) ? st : 'sugerido') as InteracaoStatus,
    feitoEm: s(r.feito_em),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export function inputToRow(input: InteracaoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {
    alvo: input.alvo.trim(),
    post_url: input.postUrl ?? null,
    descricao_post: input.descricaoPost ?? null,
    comentario_sugerido: input.comentarioSugerido ?? null,
    comentario_usado: input.comentarioUsado ?? null,
  }
  if (input.status) {
    row.status = input.status
    row.feito_em = input.status === 'sugerido' ? null : new Date().toISOString()
  }
  return row
}

export function buildCommentRequest(alvo: string, descricaoPost: string): string {
  return [
    'Você ajuda uma marca de saúde emocional ("A Vida Não Colabora") a comentar em posts de outros perfis.',
    `Alvo: ${alvo}.`,
    descricaoPost ? `Sobre o que é o post: ${descricaoPost}.` : '',
    'Escreva UM comentário curto (1 a 2 frases), genuíno e específico, que agrega algo — nunca "😍🔥" ou elogio vazio.',
    'Tom acolhedor, adulto, sem clichê de autoajuda, sem vender nada, sem link. Português brasileiro.',
    'Retorne só o comentário, sem aspas, sem markdown.',
  ].filter(Boolean).join('\n')
}

const DAY = 86_400_000
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Dias seguidos (terminando hoje ou ontem) com ao menos uma interação "feita". */
export function streak(interacoes: Interacao[], now = new Date()): number {
  const dias = new Set(
    interacoes
      .filter(i => i.status !== 'sugerido' && i.feitoEm)
      .map(i => ymd(new Date(i.feitoEm as string))),
  )
  if (dias.size === 0) return 0
  let count = 0
  const cursor = new Date(now)
  // Tolera não ter feito hoje ainda: começa contando a partir de hoje; se hoje
  // não tem, tenta a partir de ontem.
  if (!dias.has(ymd(cursor))) cursor.setTime(cursor.getTime() - DAY)
  while (dias.has(ymd(cursor))) {
    count += 1
    cursor.setTime(cursor.getTime() - DAY)
  }
  return count
}

export interface CommunitySummary {
  semana: number // interações feitas nos últimos 7 dias
  responderam: number
  sequencia: number
}

export function summarize(interacoes: Interacao[], now = new Date()): CommunitySummary {
  const seteDias = now.getTime() - 7 * DAY
  return {
    semana: interacoes.filter(i => i.status !== 'sugerido' && i.feitoEm && new Date(i.feitoEm).getTime() >= seteDias).length,
    responderam: interacoes.filter(i => i.status === 'respondeu').length,
    sequencia: streak(interacoes, now),
  }
}
