// Evolução longitudinal dos questionários (Etapa 16).
//
// Regra dura: NUNCA "melhorou/piorou clinicamente", NUNCA diagnóstico. Só
// linguagem de autopercepção derivada de fatos (pontuação e resultado
// declarados pelo próprio usuário em preenchimentos diferentes), como o resto
// do produto já faz em relatórios e mapa emocional.

export interface QuestionnaireCompletion {
  completedAt: string // ISO
  totalScore: number
  resultTitle: string | null
}

export interface QuestionnaireEvolutionSeries {
  questionnaireId: string
  title: string
  category: string
  completions: QuestionnaireCompletion[]
}

/** "Março", "Maio de 2027" — só mostra o ano quando ele muda entre os pontos da série. */
export function formatCompletionLabels(completions: QuestionnaireCompletion[]): string[] {
  const years = new Set(completions.map(c => new Date(c.completedAt).getFullYear()))
  const showYear = years.size > 1
  return completions.map(c => {
    const d = new Date(c.completedAt)
    const month = d.toLocaleDateString('pt-BR', { month: 'long' })
    return showYear ? `${month} de ${d.getFullYear()}` : month.charAt(0).toUpperCase() + month.slice(1)
  })
}

// Abaixo de 10% de variação relativa (ou 1 ponto absoluto, o que for maior),
// a diferença é tratada como ruído normal de preenchimento — não uma mudança real.
function isStable(prev: number, curr: number): boolean {
  const threshold = Math.max(1, Math.abs(prev) * 0.1)
  return Math.abs(curr - prev) <= threshold
}

/** Frase de autopercepção entre DOIS preenchimentos consecutivos do mesmo questionário. */
export function describeQuestionnaireTrend(prev: QuestionnaireCompletion, curr: QuestionnaireCompletion): string {
  if (prev.resultTitle && curr.resultTitle && prev.resultTitle !== curr.resultTitle) {
    return `Sua percepção mudou entre os preenchimentos: de "${prev.resultTitle}" para "${curr.resultTitle}".`
  }
  if (isStable(prev.totalScore, curr.totalScore)) {
    return 'Suas respostas ficaram estáveis em relação ao preenchimento anterior.'
  }
  return curr.totalScore < prev.totalScore
    ? 'Você marcou menos frequência para essa dificuldade neste preenchimento, comparado ao anterior.'
    : 'Você marcou mais frequência para essa dificuldade neste preenchimento, comparado ao anterior.'
}

/** Uma frase-resumo cobrindo toda a série (do primeiro ao último preenchimento). */
export function describeQuestionnaireSeries(series: QuestionnaireEvolutionSeries): string | null {
  const { completions } = series
  if (completions.length < 2) return null
  return describeQuestionnaireTrend(completions[completions.length - 2], completions[completions.length - 1])
}
