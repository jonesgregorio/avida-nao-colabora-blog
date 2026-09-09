// Helpers de busca administrativa contra o PostgREST.
//
// O parser de filtros do PostgREST usa vírgula, parênteses e ponto como
// sintaxe (`col.op.value`, `or(a,b)`). Um termo digitado com esses caracteres
// quebra a query ou muda a lógica. Estes helpers neutralizam isso.

/**
 * Termo seguro para `.ilike(col, pattern)` e para dentro de `.or(...)`.
 * - remove caracteres de sintaxe do PostgREST: , ( ) . *  e aspas/`\`
 * - escapa os curingas de LIKE (% e _) para busca literal
 * - colapsa espaços e limita o tamanho
 */
export function sanitizePgSearchTerm(raw: string): string {
  return String(raw ?? '')
    .replace(/[(),.*"'\\:]/g, ' ')
    .replace(/([%_])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/** `%termo%` já sanitizado, pronto para `.ilike`. Vazio => null (sem filtro). */
export function ilikePattern(raw: string): string | null {
  const t = sanitizePgSearchTerm(raw)
  return t ? `%${t}%` : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID_RE.test(String(s ?? '').trim())
