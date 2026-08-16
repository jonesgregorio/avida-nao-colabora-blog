/**
 * Rótulos compartilhados para dados de plano exibidos no admin.
 * Os aliases legados só existem para leitura de históricos já gravados; novos
 * fluxos devem usar exclusivamente free, essential e plus.
 */
export const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  plus: 'Plus',
  therapeutic: 'Plus',
  'therapeutic-plus': 'Plus',
}
