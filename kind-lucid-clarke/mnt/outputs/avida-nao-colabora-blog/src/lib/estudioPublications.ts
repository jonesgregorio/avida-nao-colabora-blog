// Tipos e helpers puros do histórico de publicações do Estúdio.
// O I/O (tabela estudio_publicacoes) fica em estudioPublicationsStore.ts.

export type PublicacaoStatus = 'rascunho' | 'pronto' | 'publicado'

export interface Publicacao {
  id: string
  status: PublicacaoStatus
  titulo: string | null
  ideia: string | null
  objetivos: string[]
  estilo: string | null
  promptImagem: string | null
  legenda: string | null
  hashtags: string | null
  primeiroComentario: string | null
  formatos: string[]
  temaCategoria: string | null
  publishMode: 'manual' | 'agendar'
  scheduledFor: string | null
  postUrl: string | null
  publishedAt: string | null
  alcance: number | null
  salvos: number | null
  compartilhamentos: number | null
  cliquesBlog: number | null
  cadastros: number | null
  createdAt: string
  updatedAt: string
}

/** Campos que a área "Nova publicação" grava. */
export interface PublicacaoInput {
  status: PublicacaoStatus
  titulo: string
  ideia: string
  objetivos: string[]
  estilo: string
  promptImagem: string
  legenda: string
  hashtags: string
  primeiroComentario: string
  formatos: string[]
  temaCategoria?: string | null
  publishMode: 'manual' | 'agendar'
  scheduledFor?: string | null
  postUrl?: string | null
}

const STATUS_LABEL: Record<PublicacaoStatus, string> = {
  rascunho: 'Rascunho',
  pronto: 'Pronto para publicar',
  publicado: 'Publicado',
}

export function statusLabel(s: PublicacaoStatus): string {
  return STATUS_LABEL[s] ?? s
}

/** Linha da tabela → objeto do app. */
export function rowToPublicacao(r: Record<string, unknown>): Publicacao {
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  const n = (v: unknown) => (typeof v === 'number' ? v : null)
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    id: String(r.id),
    status: (['rascunho', 'pronto', 'publicado'].includes(r.status as string) ? r.status : 'rascunho') as PublicacaoStatus,
    titulo: s(r.titulo),
    ideia: s(r.ideia),
    objetivos: arr(r.objetivos),
    estilo: s(r.estilo),
    promptImagem: s(r.prompt_imagem),
    legenda: s(r.legenda),
    hashtags: s(r.hashtags),
    primeiroComentario: s(r.primeiro_comentario),
    formatos: arr(r.formatos),
    temaCategoria: s(r.tema_categoria),
    publishMode: r.publish_mode === 'manual' ? 'manual' : 'agendar',
    scheduledFor: s(r.scheduled_for),
    postUrl: s(r.post_url),
    publishedAt: s(r.published_at),
    alcance: n(r.alcance),
    salvos: n(r.salvos),
    compartilhamentos: n(r.compartilhamentos),
    cliquesBlog: n(r.cliques_blog),
    cadastros: n(r.cadastros),
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

/** Objeto do app → payload para insert/update na tabela. */
export function inputToRow(input: PublicacaoInput): Record<string, unknown> {
  return {
    status: input.status,
    titulo: input.titulo || null,
    ideia: input.ideia || null,
    objetivos: input.objetivos,
    estilo: input.estilo || null,
    prompt_imagem: input.promptImagem || null,
    legenda: input.legenda || null,
    hashtags: input.hashtags || null,
    primeiro_comentario: input.primeiroComentario || null,
    formatos: input.formatos,
    tema_categoria: input.temaCategoria ?? null,
    publish_mode: input.publishMode,
    scheduled_for: input.scheduledFor || null,
    post_url: input.postUrl || null,
    published_at: input.status === 'publicado' ? new Date().toISOString() : null,
  }
}

export interface PublicacaoMetrics {
  alcance: number | null
  salvos: number | null
  compartilhamentos: number | null
  cliquesBlog: number | null
  cadastros: number | null
}

export function metricsToRow(m: PublicacaoMetrics): Record<string, unknown> {
  return {
    alcance: m.alcance,
    salvos: m.salvos,
    compartilhamentos: m.compartilhamentos,
    cliques_blog: m.cliquesBlog,
    cadastros: m.cadastros,
  }
}
