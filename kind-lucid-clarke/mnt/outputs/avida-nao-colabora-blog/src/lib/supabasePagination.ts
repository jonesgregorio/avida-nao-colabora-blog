export type PageResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

/**
 * Coleta uma lista completa do Data API em páginas explícitas.
 *
 * Evita dois problemas no Admin:
 * 1) cortes silenciosos por .limit(N);
 * 2) depender do limite máximo de linhas configurado no PostgREST.
 *
 * O chamador mantém a query/filtros; esta função controla apenas o intervalo.
 */
export async function collectAllPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
): Promise<{ data: T[]; error: { message?: string } | null }> {
  const rows: T[] = []
  let from = 0

  for (;;) {
    const result = await loadPage(from, from + pageSize - 1)
    if (result.error) return { data: rows, error: result.error }

    const page = result.data ?? []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }

    from += pageSize
  }
}
