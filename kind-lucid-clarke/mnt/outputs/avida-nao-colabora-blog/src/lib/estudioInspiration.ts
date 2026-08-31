// Perfis de inspiração do Estúdio (Fase 4a) — tipos + prompt de análise.
// Puro. O I/O da tabela fica em estudioInspirationStore.ts; a chamada de IA,
// em estudioAi.ts.

export interface PerfilInspiracao {
  id: string
  handle: string
  tema: string | null
  notas: string | null
  legendasColadas: string | null
  analise: string | null
  analisadoEm: string | null
  createdAt: string
  updatedAt: string
}

export interface PerfilInput {
  handle: string
  tema?: string | null
  notas?: string | null
  legendasColadas?: string | null
  analise?: string | null
  analisadoEm?: string | null
}

export function normalizeHandle(raw: string): string {
  const h = raw.trim().replace(/^@+/, '').replace(/\s+/g, '')
  return h ? `@${h}` : ''
}

export function rowToPerfil(r: Record<string, unknown>): PerfilInspiracao {
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    id: String(r.id),
    handle: String(r.handle ?? ''),
    tema: s(r.tema),
    notas: s(r.notas),
    legendasColadas: s(r.legendas_coladas),
    analise: s(r.analise),
    analisadoEm: s(r.analisado_em),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export function inputToRow(input: PerfilInput): Record<string, unknown> {
  return {
    handle: normalizeHandle(input.handle),
    tema: input.tema ?? null,
    notas: input.notas ?? null,
    legendas_coladas: input.legendasColadas ?? null,
    analise: input.analise ?? null,
    analisado_em: input.analisadoEm ?? null,
  }
}

export function buildInspirationAnalysisRequest(handle: string, tema: string, legendas: string): string {
  return [
    'Você analisa perfis de Instagram para uma marca de saúde emocional.',
    `Perfil de referência: ${handle}${tema ? ` (tema: ${tema})` : ''}.`,
    'Abaixo estão legendas recentes desse perfil, coladas à mão. A partir SÓ delas, descreva em 4 a 6 frases:',
    '1) o formato/estrutura que mais se repete; 2) o tom e o vocabulário; 3) o tipo de gancho da primeira linha;',
    '4) uma recomendação prática do que testar no nosso calendário.',
    'Português brasileiro, direto. Não invente dados que não estão nas legendas.',
    '',
    '--- legendas ---',
    legendas.slice(0, 6000),
    '--- fim ---',
    '',
    'Retorne só o texto da análise, sem markdown.',
  ].join('\n')
}
