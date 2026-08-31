import type { Publicacao } from './estudioPublications'

// Desempenho do Estúdio (Fase 2d) — puro. Resume as métricas digitadas à mão
// e monta o pedido de leitura para a IA. Só números agregados de posts da
// marca; nada de usuário.

export interface PerfRow {
  id: string
  titulo: string
  formatoPrincipal: string
  alcance: number | null
  salvos: number | null
  compartilhamentos: number | null
  cliquesBlog: number | null
  cadastros: number | null
}

export interface PerfSummary {
  medidos: number
  totalAlcance: number
  totalSalvos: number
  totalCadastros: number
  taxaSalvamento: number | null // salvos / alcance
  porFormato: { formato: string; posts: number; alcance: number; cadastros: number }[]
}

export function toPerfRows(pubs: Publicacao[]): PerfRow[] {
  return pubs
    .filter(p => p.status === 'publicado' || p.status === 'pronto')
    .map(p => ({
      id: p.id,
      titulo: p.titulo || p.ideia || 'Sem título',
      formatoPrincipal: p.formatos[0] ?? '—',
      alcance: p.alcance,
      salvos: p.salvos,
      compartilhamentos: p.compartilhamentos,
      cliquesBlog: p.cliquesBlog,
      cadastros: p.cadastros,
    }))
}

export function summarize(rows: PerfRow[]): PerfSummary {
  const medidosRows = rows.filter(r => r.alcance != null)
  const sum = (f: (r: PerfRow) => number | null) => medidosRows.reduce((n, r) => n + (f(r) ?? 0), 0)
  const totalAlcance = sum(r => r.alcance)
  const totalSalvos = sum(r => r.salvos)
  const totalCadastros = sum(r => r.cadastros)

  const fmt = new Map<string, { formato: string; posts: number; alcance: number; cadastros: number }>()
  for (const r of medidosRows) {
    const e = fmt.get(r.formatoPrincipal) ?? { formato: r.formatoPrincipal, posts: 0, alcance: 0, cadastros: 0 }
    e.posts += 1
    e.alcance += r.alcance ?? 0
    e.cadastros += r.cadastros ?? 0
    fmt.set(r.formatoPrincipal, e)
  }

  return {
    medidos: medidosRows.length,
    totalAlcance,
    totalSalvos,
    totalCadastros,
    taxaSalvamento: totalAlcance > 0 ? totalSalvos / totalAlcance : null,
    porFormato: [...fmt.values()].sort((a, b) => b.cadastros - a.cadastros),
  }
}

export function buildPerfReadingRequest(rows: PerfRow[]): string {
  const linhas = rows
    .filter(r => r.alcance != null)
    .map(r => `- ${r.formatoPrincipal} · "${r.titulo}": alcance ${r.alcance ?? 0}, salvos ${r.salvos ?? 0}, compart. ${r.compartilhamentos ?? 0}, cliques ${r.cliquesBlog ?? 0}, cadastros ${r.cadastros ?? 0}`)
  return [
    'Você é analista de social media de uma marca de saúde emocional.',
    'Com base nos números abaixo (posts de Instagram, métricas digitadas à mão), diga em 3 a 5 frases:',
    '1) qual formato traz mais alcance e qual traz mais cadastro; 2) uma recomendação prática de cadência para a próxima semana.',
    'Português brasileiro, direto, sem jargão. Não invente números que não estão na lista.',
    '',
    linhas.join('\n') || '(sem posts medidos ainda)',
    '',
    'Retorne só o texto da análise, sem markdown.',
  ].join('\n')
}
