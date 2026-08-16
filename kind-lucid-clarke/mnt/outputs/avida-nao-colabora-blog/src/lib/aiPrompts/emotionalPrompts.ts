import type { EmotionalSummary } from '../emotionalAnalytics'

/**
 * Contratos de IA para os recursos emocionais. Todos recebem somente o resumo
 * agregado, nunca texto livre do diário. Assim, a mesma entrada pode ser usada
 * com segurança por uma Edge Function e auditada sem expor anotações íntimas.
 */

export type EmotionalPromptKind =
  | 'weekly_report'
  | 'monthly_deep_report'
  | 'self_care_plan'
  | 'professional_guidance_draft'

export const EMOTIONAL_AI_SAFETY_RULES = [
  'Escreva em português brasileiro, com tom acolhedor, claro e não julgador.',
  'Use apenas os dados agregados informados. Não invente fatos, datas, causas ou padrões.',
  'Não diagnostique, prescreva, prometa cura ou afirme condição clínica.',
  'Prefira: "seus registros sugerem", "vale observar" e "pode ser útil".',
  'Não trate marcadores emocionais como gatilhos. "Gatilhos reais" só podem ser citados quando vierem explicitamente no campo correspondente.',
  'Se a qualidade dos dados for baixa, seja breve, reconheça a limitação e convide a pessoa a registrar mais, sem concluir além do possível.',
  'Retorne exclusivamente JSON válido, sem markdown, sem comentários e sem campos adicionais.',
].join('\n- ')

function compactSummary(summary: EmotionalSummary) {
  return {
    periodo: { inicio: summary.period_start, fim: summary.period_end },
    plano: summary.plan,
    registros: {
      total: summary.total_entries,
      checkins: summary.total_checkins,
      diarios_principais: summary.total_main_diaries,
      complementos: summary.total_addons,
      dias_ativos: summary.active_days,
    },
    emocoes_dominantes: summary.dominant_emotions.slice(0, 6),
    marcadores_emocionais: summary.emotional_markers.slice(0, 6),
    contextos: summary.contexts.slice(0, 6),
    necessidades: summary.needs.slice(0, 6),
    acoes_de_cuidado: summary.care_actions.slice(0, 6),
    gatilhos_reais: summary.real_triggers.slice(0, 6),
    medias: summary.averages,
    qualidade_dos_dados: summary.data_quality,
  }
}

function base(kind: EmotionalPromptKind, summary: EmotionalSummary): string {
  return [
    `Você prepara ${kind} para o aplicativo A Vida Não Colabora.`,
    'A pessoa não deve ser identificada; estes são dados agregados e sem textos íntimos.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    `- ${EMOTIONAL_AI_SAFETY_RULES}`,
    '',
    'DADOS AGREGADOS (JSON):',
    JSON.stringify(compactSummary(summary)),
    '',
  ].join('\n')
}

export function buildWeeklyReportPrompt(summary: EmotionalSummary): string {
  return `${base('weekly_report', summary)}
TAREFA: produza uma leitura leve da semana, sem plano de ação mensal e sem orientação profissional.
FORMATO EXATO:
{"summary":"2 a 4 frases","patterns":["até 3 observações sustentadas pelos dados"],"attention_points":["até 2 pontos"],"next_steps":["até 3 ações pequenas e opcionais"],"data_quality_message":"mensagem curta"}`
}

export function buildMonthlyDeepReportPrompt(summary: EmotionalSummary): string {
  return `${base('monthly_deep_report', summary)}
TAREFA: produza uma retrospectiva mensal aprofundada, apenas sobre o período passado. Não crie um plano de autocuidado futuro e não escreva como orientação profissional.
FORMATO EXATO:
{"summary":"3 a 5 frases","patterns":["até 4 padrões"],"relations":["até 3 relações cautelosas entre dados"],"improvement_moments":["até 3 sinais de recurso ou melhora"],"reflection_questions":["3 perguntas abertas"],"data_quality_message":"mensagem curta"}`
}

export function buildSelfCarePlanPrompt(summary: EmotionalSummary): string {
  return `${base('self_care_plan', summary)}
TAREFA: crie um plano prospectivo, realista e pequeno para o próximo mês. Não repita uma retrospectiva detalhada nem assuma que a pessoa seguirá as sugestões.
FORMATO EXATO:
{"monthly_priority":"prioridade prática","main_care":"1 a 3 frases","recommended_practice":"como praticar de modo simples","small_commitment":"compromisso pequeno e opcional","checkin_suggestion":"sugestão concreta","practical_tips":["3 a 5 ações curtas"],"reflection_questions":["3 perguntas"],"final_message":"mensagem humana curta","data_quality_message":"mensagem curta"}`
}

export function buildProfessionalGuidancePrompt(
  summary: EmotionalSummary,
  request: { message: string; context?: string | null; expected_help?: string | null },
  adminNotes?: string,
): string {
  return `${base('professional_guidance_draft', summary)}
TAREFA: crie um RASCUNHO para revisão humana antes de uma orientação mensal. Não diga que a mensagem foi enviada e não se apresente como profissional. Respeite o pedido da pessoa sem repetir desnecessariamente informações íntimas.
PEDIDO DA PESSOA (pode conter texto livre, use apenas para responder ao pedido):
${JSON.stringify({ mensagem: request.message, contexto: request.context || null, ajuda_esperada: request.expected_help || null })}
ANOTAÇÕES DA EQUIPE (opcionais):
${adminNotes?.trim() || 'nenhuma'}
FORMATO EXATO:
{"draft":"3 a 6 parágrafos curtos, acolhedores e revisáveis","key_points":["até 4 pontos usados"],"suggested_next_steps":["até 3 sugestões opcionais"],"review_notes":["itens para a revisão humana"],"data_quality_message":"mensagem curta"}`
}
