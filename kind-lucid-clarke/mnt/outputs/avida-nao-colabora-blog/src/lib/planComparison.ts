// Fonte ÚNICA da comparação de planos.
// Usada em "Meu Plano" (MyPlanPage) e em "Ver planos" (Pricing) para que as duas
// telas mostrem EXATAMENTE a mesma descrição — evita divergência entre elas.
export type PlanCompareValue = boolean | string

export interface PlanCompareRow {
  label: string
  values: { free: PlanCompareValue; essential: PlanCompareValue; plus: PlanCompareValue }
}

export const PLAN_COMPARE_ROWS: PlanCompareRow[] = [
  { label: 'Diário emocional',               values: { free: 'Básico (5/mês)',   essential: 'Ilimitado',      plus: 'Ilimitado' } },
  { label: 'Questionários',                  values: { free: 'Inicial',          essential: 'Intermediários', plus: 'Avançados' } },
  { label: 'Mapa emocional e gráficos',      values: { free: false,              essential: true,             plus: true } },
  { label: 'Conteúdos guiados',              values: { free: 'Algumas práticas', essential: 'Completos',       plus: 'Completos' } },
  { label: 'Relatório semanal automático',   values: { free: false,              essential: true,             plus: true } },
  { label: 'Plano de autocuidado mensal',    values: { free: false,              essential: false,            plus: true } },
  { label: 'Relatório mensal aprofundado',   values: { free: false,              essential: false,            plus: true } },
  { label: 'Comentário profissional mensal', values: { free: false,              essential: false,            plus: true } },
  { label: 'Orientação mensal por mensagem', values: { free: false,              essential: false,            plus: true } },
]

// Benefícios resumidos por plano (cards) — derivados da tabela acima, para que os
// bullets fiquem coerentes com a comparação real.
export const PLAN_BENEFITS: Record<'free' | 'essential' | 'plus', string[]> = {
  free: [
    'Diário emocional básico (5/mês)',
    'Check-in rápido ilimitado',
    'Questionário inicial',
    'Algumas práticas guiadas',
  ],
  essential: [
    'Diário emocional ilimitado',
    'Questionários intermediários',
    'Mapa emocional e gráficos',
    'Conteúdos guiados completos',
    'Relatório semanal automático',
  ],
  plus: [
    'Tudo do Essencial',
    'Questionários avançados',
    'Plano de autocuidado mensal',
    'Relatório mensal aprofundado',
    'Comentário profissional mensal',
    'Orientação mensal por mensagem',
  ],
}
