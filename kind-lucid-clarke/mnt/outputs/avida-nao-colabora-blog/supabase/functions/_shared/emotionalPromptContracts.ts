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
  'Prefira linguagem cautelosa: seus registros sugerem, vale observar, pode ser interessante e talvez faça sentido.',
  'Evite linguagem impositiva como você precisa, obrigatório ou garantido.',
  'emotional_tags são marcadores emocionais; gatilhos reais só podem vir de trigger_tags/real_triggers.',
  'Não transforme correlação em causa.',
  'Se a qualidade dos dados for baixa, reconheça a limitação e não conclua além do possível.',
  'Quando o contrato pedir JSON, retorne exclusivamente JSON válido e sem markdown.',
] as const

export const EMOTIONAL_AI_SAFETY_TEXT = EMOTIONAL_AI_SAFETY_RULES.join('\n- ')

// Contratos narrativos usados pela Edge Function. Campos numéricos/estruturados
// continuam sendo calculados deterministicamente no código e não pela IA.
export const EMOTIONAL_NARRATIVE_SHAPES: Record<Exclude<EmotionalPromptKind, 'professional_guidance_draft'>, string> = {
  weekly_report: '{"summary":"2 a 4 frases","what_most_appeared":"texto curto sobre a emoção/marcador que mais apareceu","emotional_markers_reading":"texto curto","contexts_reading":"texto curto, só se houver contexts","needs_reading":"texto curto, só se houver needs","care_actions_reading":"texto curto, só se houver care_actions","patterns":["até 3"],"attention_points":["até 2"],"next_steps":["até 3"],"closing_message":"mensagem curta e acolhedora","data_quality_message":"texto"}',
  monthly_deep_report: '{"summary":"3 a 5 frases","main_emotional_markers_reading":"texto","contexts_and_needs_reading":"texto, só se houver contexts/needs","care_actions_observed_reading":"texto, só se houver care_actions","real_triggers_reading":"texto, somente se houver trigger_tags","advanced_indicators_reading":"texto, somente se houver stress/self_esteem/irritability/overload informados","attention_days_reading":"texto, só se houver dias de atenção","comparison_with_previous_month_reading":"texto, só se houver mês anterior comparável","patterns":["até 4"],"relations":["até 3"],"improvement_moments":["até 3"],"reflection_questions":["3 perguntas"],"closing_message":"mensagem final curta e acolhedora","data_quality_message":"texto"}',
  self_care_plan: '{"title":"texto","month_label":"texto","based_on_period":"texto","main_focus":"texto","why_this_focus":"texto","three_care_priorities":[{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]},{"priority":"texto","why_it_matters":"texto","small_actions":["2"]}],"weekly_rhythm":{"week_1":"texto","week_2":"texto","week_3":"texto","week_4":"texto"},"suggested_micro_actions":["3 a 5"],"recommended_guided_contents":["até 3 temas"],"gentle_reminders":["2"],"what_not_to_force":"texto","light_emotional_goal":"texto","checkin_suggestion":"texto","when_to_seek_more_support":"texto, leve, sem alarmismo","reflection_questions":["3"],"final_message":"texto","data_quality_message":"texto"}',
}
