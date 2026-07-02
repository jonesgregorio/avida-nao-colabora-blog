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
  advanced_monthly_report: 'Relatório mensal avançado',
  report_feedback: 'Feedback de relatório',
  report_suggestion: 'Sugestão de relatório',
  guidance: 'Orientação',
  guidance_response: 'Resposta da orientação mensal',
  monthly_guidance: 'Orientação mensal',
  monthly_guidance_draft: 'Rascunho de orientação mensal',
  professional_comment: 'Comentário profissional',
  report_comment: 'Comentário de relatório',
  monthly_report_comment: 'Comentário de relatório',
  self_care_plan: 'Plano de autocuidado',
  weekly_self_care: 'Plano semanal de autocuidado',
  monthly_review: 'Revisão mensal do plano',
  self_care_review: 'Revisão do autocuidado',
  session_themes: 'Sugestões para sessão',
  session_suggestions: 'Sugestões para sessão',
  session_summary: 'Resumo de sessão',
  post_session_message: 'Mensagem pós-sessão',
  session_followup: 'Acompanhamento pós-sessão',
  content_recommendations: 'Recomendações personalizadas',
  article_suggestion: 'Sugestão de artigo',
  mini_challenge: 'Mini-desafio',
  diary_question: 'Pergunta para o diário',
  guided_meditation: 'Meditação guiada',
  guided_diary_notes: 'Notas guiadas para o diário',
  evolution_highlights: 'Destaques de evolução',
  questionnaire_suggestion: 'Questionário recomendado',
  trail_suggestion: 'Sugestão de trilha',
  next_steps: 'Próximos passos de autocuidado',
}

export const TARGET_AREA_LABELS: Record<string, string> = {
  'para-voce': 'Para Você',
  resumo: 'Minha Evolução → Resumo',
  my_evolution: 'Minha Evolução',
  diary: 'Diário',
  reports: 'Relatórios',
  self_care_plan: 'Plano de Autocuidado',
  guidance: 'Orientações',
  orientacoes: 'Orientações',
  professional_comments: 'Comentários Profissionais',
  session_plus: 'Sessão Plus',
  sessions: 'Sessões',
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
