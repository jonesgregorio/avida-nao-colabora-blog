import type { EmotionalSummary } from '../emotionalAnalytics'
import { EMOTIONAL_AI_SAFETY_TEXT, EMOTIONAL_NARRATIVE_SHAPES, EMOTIONAL_PROMPT_VERSIONS, type EmotionalPromptKind } from '../../../supabase/functions/_shared/emotionalPromptContracts'

/**
 * Fonte conceitual dos contratos de IA emocional do A Vida Não Colabora.
 *
 * IMPORTANTE PARA CLAUDE + CODEX:
 * - Este arquivo define o contrato oficial dos prompts emocionais.
 * - `supabase/functions/run-emotional-automations/index.ts` mantém um espelho
 *   versionado para execução server-side em Deno/Supabase.
 * - Ao alterar estrutura, tom ou versão aqui, mantenha o espelho da Edge
 *   Function alinhado para evitar duas IAs com comportamentos diferentes.
 *
 * Todos os prompts recebem somente resumo agregado, nunca texto livre integral do
 * diário. Isso protege a intimidade dos registros e reduz risco de diagnóstico.
 */

export { EMOTIONAL_NARRATIVE_SHAPES, EMOTIONAL_PROMPT_VERSIONS }
export const EMOTIONAL_AI_SAFETY_RULES = EMOTIONAL_AI_SAFETY_TEXT

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
    `Versão do contrato: ${EMOTIONAL_PROMPT_VERSIONS[kind]}.`,
    'A pessoa não deve ser identificada; estes são dados agregados e sem textos íntimos.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    `- ${EMOTIONAL_AI_SAFETY_TEXT}`,
    '',
    'DADOS AGREGADOS (JSON):',
    JSON.stringify(compactSummary(summary)),
    '',
    'SEPARAÇÃO CONCEITUAL OBRIGATÓRIA:',
    '- emotional_tags/marcadores_emocionais = marcadores emocionais, nunca gatilhos.',
    '- trigger_tags/gatilhos_reais = gatilhos reais, somente quando explicitamente disponíveis.',
    '- context_tags/contextos = onde ou em que situação apareceu.',
    '- need_tags/necessidades = o que a pessoa pareceu precisar.',
    '- care_action_tags/acoes_de_cuidado = ações de cuidado escolhidas ou sugeridas.',
    '',
  ].join('\n')
}

export function buildWeeklyReportPrompt(summary: EmotionalSummary): string {
  return `${base('weekly_report', summary)}
TAREFA: produza uma leitura leve da semana. A pergunta central é: "Como foi minha semana?".
Use tom breve, prático e acolhedor. Não crie relatório mensal, plano de autocuidado, orientação profissional nem diagnóstico.

FORMATO EXATO:
{
  "title": "Sua leitura semanal",
  "period_label": "texto",
  "short_summary": "2 a 4 frases",
  "what_most_appeared": "texto curto sobre o que mais apareceu",
  "emotional_markers_reading": "texto curto sobre marcadores emocionais",
  "contexts_reading": "texto curto sobre contextos, se houver",
  "needs_reading": "texto curto sobre necessidades, se houver",
  "care_actions_reading": "texto curto sobre ações de cuidado, se houver",
  "energy_anxiety_sleep_summary": "texto curto, sem inventar relação causal",
  "observed_patterns": ["até 3 padrões leves sustentados pelos dados"],
  "attention_points": ["até 2 pontos de atenção"],
  "gentle_next_steps": ["2 ou 3 próximos passos leves e opcionais"],
  "recommended_contents": ["até 3 temas de conteúdos guiados reais ou categorias"],
  "closing_message": "mensagem curta, humana e acolhedora",
  "data_quality_notice": "mensagem curta sobre qualidade dos dados"
}`
}

export function buildMonthlyDeepReportPrompt(summary: EmotionalSummary): string {
  return `${base('monthly_deep_report', summary)}
TAREFA: produza uma retrospectiva mensal aprofundada. A pergunta central é: "O que o mês mostrou sobre meus padrões emocionais?".
A leitura é premium, organizada e retrospectiva. Não crie plano completo, rotina futura, orientação profissional, checklist de tarefas nem diagnóstico.

FORMATO EXATO:
{
  "title": "Seu relatório mensal aprofundado",
  "month_label": "texto",
  "executive_summary": "3 a 5 frases",
  "timeline_reading": {
    "beginning": "leitura do início do mês",
    "middle": "leitura do meio do mês",
    "end": "leitura do fim do mês"
  },
  "emotional_patterns": ["até 4 padrões"],
  "main_emotional_markers_reading": "texto sobre marcadores emocionais",
  "contexts_and_needs_reading": "texto sobre contextos e necessidades, se houver",
  "care_actions_observed_reading": "texto sobre ações de cuidado observadas, se houver",
  "real_triggers_reading": "texto somente se houver gatilhos reais",
  "advanced_indicators_reading": "texto somente se houver dados avançados informados",
  "energy_anxiety_sleep_relationship": "texto cauteloso sobre relação entre energia, ansiedade e sono",
  "attention_days_reading": "texto sobre dias de atenção, se houver",
  "improvement_signals": ["até 3 sinais de recurso ou melhora"],
  "comparison_with_previous_month_reading": "texto sobre comparação com mês anterior, se houver",
  "reflection_questions": ["3 perguntas abertas"],
  "bridge_to_self_care_plan": "ponte curta para o plano de autocuidado, sem gerar plano",
  "bridge_to_professional_guidance": "ponte curta para orientação mensal, sem gerar orientação",
  "closing_message": "mensagem final curta e acolhedora",
  "data_quality_notice": "mensagem curta sobre qualidade dos dados"
}`
}

export function buildSelfCarePlanPrompt(summary: EmotionalSummary): string {
  return `${base('self_care_plan', summary)}
TAREFA: crie um roteiro prospectivo, realista e pequeno para o próximo mês. A pergunta central é: "O que posso fazer agora com base nos meus registros?".
Transforme leitura em pequenas ações. Não repita o relatório inteiro. Não imponha metas rígidas.

FORMATO EXATO:
{
  "title": "Seu roteiro de cuidado",
  "month_label": "texto",
  "based_on_period": "período analisado",
  "main_focus": "foco leve",
  "why_this_focus": "1 a 3 frases",
  "three_care_priorities": [
    { "priority": "prioridade", "why_it_matters": "por que importa", "small_actions": ["ação pequena 1", "ação pequena 2"] },
    { "priority": "prioridade", "why_it_matters": "por que importa", "small_actions": ["ação pequena 1", "ação pequena 2"] },
    { "priority": "prioridade", "why_it_matters": "por que importa", "small_actions": ["ação pequena 1", "ação pequena 2"] }
  ],
  "weekly_rhythm": {
    "week_1": "observar sem se cobrar",
    "week_2": "uma ação pequena",
    "week_3": "ajustar o que funcionou",
    "week_4": "revisar com gentileza"
  },
  "suggested_micro_actions": ["3 a 5 ações curtas"],
  "recommended_guided_contents": ["até 3 temas de conteúdos guiados"],
  "gentle_reminders": ["2 lembretes acolhedores"],
  "what_not_to_force": "algo que não precisa ser resolvido agora",
  "light_emotional_goal": "meta leve",
  "checkin_suggestion": "sugestão concreta",
  "when_to_seek_more_support": "texto cuidadoso, sem alarmismo",
  "closing_message": "mensagem humana curta",
  "data_quality_notice": "mensagem curta sobre qualidade dos dados"
}`
}

export interface ProfessionalGuidanceRelatedContext {
  monthly_report_summary?: unknown
  self_care_plan?: unknown
}

function compactGuidanceText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function compactGuidanceList(value: unknown, maxItems = 5): string[] {
  return Array.isArray(value)
    ? value
      .map(item => compactGuidanceText(item, 500))
      .filter((item): item is string => Boolean(item))
      .slice(0, maxItems)
    : []
}

function asGuidanceRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function compactSelfCarePlan(value: unknown) {
  const plan = asGuidanceRecord(value)
  if (!plan) return null

  const priorities = Array.isArray(plan.three_care_priorities)
    ? plan.three_care_priorities
      .map(item => asGuidanceRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .slice(0, 3)
      .map(item => ({
        priority: compactGuidanceText(item.priority, 400),
        why_it_matters: compactGuidanceText(item.why_it_matters, 700),
        small_actions: compactGuidanceList(item.small_actions, 3),
      }))
    : []

  return {
    main_focus: compactGuidanceText(plan.main_focus ?? plan.monthly_priority, 800),
    why_this_focus: compactGuidanceText(plan.why_this_focus ?? plan.main_care, 1200),
    priorities,
    suggested_micro_actions: compactGuidanceList(plan.suggested_micro_actions ?? plan.practical_tips, 5),
    what_not_to_force: compactGuidanceText(plan.what_not_to_force, 800),
    light_emotional_goal: compactGuidanceText(plan.light_emotional_goal, 800),
    checkin_suggestion: compactGuidanceText(plan.checkin_suggestion, 800),
  }
}

function compactProfessionalGuidanceContext(context?: ProfessionalGuidanceRelatedContext) {
  return {
    monthly_report_summary: compactGuidanceText(context?.monthly_report_summary, 2200),
    self_care_plan: compactSelfCarePlan(context?.self_care_plan),
  }
}

export function buildProfessionalGuidancePrompt(
  summary: EmotionalSummary,
  request: { message: string; context?: string | null; expected_help?: string | null },
  adminNotes?: string,
  relatedContext?: ProfessionalGuidanceRelatedContext,
): string {
  return `${base('professional_guidance_draft', summary)}
TAREFA: crie um RASCUNHO para revisão humana antes de uma orientação mensal. A pergunta central é: "Que leitura acolhedora e direcionamento posso receber a partir do meu momento?".
Não diga que a mensagem foi enviada. Não se apresente como profissional. Não responda sinais de crise como orientação comum.

PEDIDO DA PESSOA (pode conter texto livre; responda sem expor trechos íntimos desnecessários):
${JSON.stringify({ mensagem: request.message, contexto: request.context || null, ajuda_esperada: request.expected_help || null })}

ANOTAÇÕES DA EQUIPE (opcionais):
${adminNotes?.trim() || 'nenhuma'}

CONTEXTO JÁ PRODUZIDO NO PRODUTO (somente sínteses estruturadas/revisadas; nunca texto bruto do Diário):
${JSON.stringify(compactProfessionalGuidanceContext(relatedContext))}
Use este contexto apenas quando estiver presente. Não invente conteúdo ausente e não transforme relatório/plano em diagnóstico ou relação causal.

FORMATO EXATO:
{
  "title": "Sua orientação mensal",
  "user_request_summary": "o que a pessoa trouxe",
  "emotional_context_summary": "o que os registros ajudam a observar",
  "gentle_guidance": "leitura cuidadosa, sem diagnóstico",
  "practical_next_steps": ["até 3 próximos passos opcionais"],
  "connection_with_self_care_plan": "conexão breve com o plano de autocuidado, se existir",
  "suggested_reflection_question": "uma pergunta aberta",
  "final_message_draft": "mensagem final acolhedora",
  "review_badge": "Orientação revisada",
  "professional_review_notes": ["itens para revisão humana"],
  "safety_flags": ["sinais que exigem atenção, se houver"],
  "data_quality_notice": "mensagem curta"
}`
}
