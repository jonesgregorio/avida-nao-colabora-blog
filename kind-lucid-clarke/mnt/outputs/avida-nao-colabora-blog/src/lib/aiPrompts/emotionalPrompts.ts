import type { EmotionalSummary } from '../emotionalAnalytics'

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

export type EmotionalPromptKind =
  | 'weekly_report'
  | 'monthly_deep_report'
  | 'self_care_plan'
  | 'professional_guidance_draft'

export const EMOTIONAL_PROMPT_VERSIONS: Record<EmotionalPromptKind, string> = {
  weekly_report: 'weekly_report_v2',
  monthly_deep_report: 'monthly_deep_report_v2',
  self_care_plan: 'self_care_plan_v2',
  professional_guidance_draft: 'professional_guidance_v1',
}

export const EMOTIONAL_AI_SAFETY_RULES = [
  'Escreva em português brasileiro, com tom acolhedor, claro, humano e não julgador.',
  'Use apenas os dados agregados informados. Não invente fatos, datas, causas, números ou padrões.',
  'Não diagnostique, não prescreva, não prometa cura e não afirme condição clínica.',
  'Não se apresente como psicólogo, psiquiatra, médico, terapeuta ou profissional de saúde.',
  'Prefira expressões cautelosas: "seus registros sugerem", "vale observar", "pode ser interessante" e "talvez faça sentido".',
  'Evite expressões impositivas como "você precisa", "obrigatório", "controle suas emoções" ou "garantido".',
  'Não trate marcadores emocionais como gatilhos. `emotional_tags` são marcadores; gatilhos reais só podem vir de `real_triggers`/`trigger_tags`.',
  'Não transforme correlação em causa. Relações entre energia, ansiedade, sono e contexto são pistas, não conclusões.',
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
    `Versão do contrato: ${EMOTIONAL_PROMPT_VERSIONS[kind]}.`,
    'A pessoa não deve ser identificada; estes são dados agregados e sem textos íntimos.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    `- ${EMOTIONAL_AI_SAFETY_RULES}`,
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

export function buildProfessionalGuidancePrompt(
  summary: EmotionalSummary,
  request: { message: string; context?: string | null; expected_help?: string | null },
  adminNotes?: string,
): string {
  return `${base('professional_guidance_draft', summary)}
TAREFA: crie um RASCUNHO para revisão humana antes de uma orientação mensal. A pergunta central é: "Que leitura acolhedora e direcionamento posso receber a partir do meu momento?".
Não diga que a mensagem foi enviada. Não se apresente como profissional. Não responda sinais de crise como orientação comum.

PEDIDO DA PESSOA (pode conter texto livre; responda sem expor trechos íntimos desnecessários):
${JSON.stringify({ mensagem: request.message, contexto: request.context || null, ajuda_esperada: request.expected_help || null })}

ANOTAÇÕES DA EQUIPE (opcionais):
${adminNotes?.trim() || 'nenhuma'}

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
