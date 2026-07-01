// Labels centrais para tipos e áreas de conteúdo personalizado.
// Usados tanto no admin quanto no lado do usuário para evitar nomes técnicos.

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  reflection: 'Reflexão',
  insight: 'Insight',
  tip: 'Dica prática',
  exercise: 'Exercício emocional',
  emotional_exercise: 'Exercício emocional',
  summary: 'Resumo',
  weekly_summary: 'Resumo semanal',
  monthly_summary: 'Resumo mensal',
  advanced_report: 'Relatório avançado',
  report_feedback: 'Feedback de relatório',
  guidance: 'Orientação',
  guidance_response: 'Resposta da orientação mensal',
  monthly_guidance: 'Orientação mensal',
  professional_comment: 'Comentário profissional',
  report_comment: 'Comentário de relatório',
  monthly_report_comment: 'Comentário de relatório',
  self_care_plan: 'Plano de autocuidado',
  weekly_self_care: 'Plano semanal de autocuidado',
  monthly_review: 'Revisão mensal do plano',
  self_care_review: 'Revisão do autocuidado',
  session_themes: 'Sugestões para sessão',
  session_suggestions: 'Sugestões para sessão',
  post_session_message: 'Mensagem pós-sessão',
  session_followup: 'Pós-sessão',
  content_recommendations: 'Recomendações personalizadas',
  article_suggestion: 'Sugestão de artigo',
  mini_challenge: 'Mini-desafio',
  diary_question: 'Pergunta para diário',
  guided_meditation: 'Meditação guiada',
}

export const TARGET_AREA_LABELS: Record<string, string> = {
  my_evolution: 'Minha Evolução',
  diary: 'Diário',
  reports: 'Relatórios',
  self_care_plan: 'Plano de Autocuidado',
  guidance: 'Orientações',
  professional_comments: 'Comentários Profissionais',
  session_plus: 'Sessão Plus',
  sessions: 'Sessões',
  orientacoes: 'Orientações',
  meditations: 'Meditações',
  exercises: 'Exercícios',
  general: 'Geral',
}

export function getContentTypeLabel(contentType: string | null | undefined): string {
  if (!contentType) return ''
  return CONTENT_TYPE_LABELS[contentType] ?? contentType
}

export function getTargetAreaLabel(targetArea: string | null | undefined): string {
  if (!targetArea) return ''
  return TARGET_AREA_LABELS[targetArea] ?? targetArea
}

// Retorna qual aba do usuário corresponde a uma target_area
export const TARGET_AREA_TO_USER_TAB: Record<string, string> = {
  self_care_plan: 'autocuidado',
  guidance: 'orientacoes',
  professional_comments: 'comentarios',
  session_plus: 'sessao',
  sessions: 'sessao',
  reports: 'relatorios',
  my_evolution: 'para-voce',
  general: 'para-voce',
}
