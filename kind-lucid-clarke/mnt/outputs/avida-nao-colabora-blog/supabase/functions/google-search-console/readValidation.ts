export function assertSeoReads(results: Array<{ error: { message?: string } | null }>) {
  if (results.some(result => result.error)) {
    throw new Error('Não foi possível carregar todos os dados de SEO. A análise está incompleta; tente novamente.')
  }
}
