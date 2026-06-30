-- Migration 023: Marca recursos oficiais de exibição nos planos
-- Adiciona coluna is_display para separar features públicas das técnicas internas

ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS is_display BOOLEAN DEFAULT false;

-- Zera primeiro para reprocessar
UPDATE plan_features SET is_display = false;

-- Marca como display=true somente os recursos oficiais finais
UPDATE plan_features SET is_display = true WHERE feature_key IN (
  -- Gratuito
  'articles_free',
  'basic_self_assessment',
  'wellbeing_diary_5_month',
  'simple_mood_checkin',
  'biweekly_auto_challenges',
  'limited_history',
  'ads_enabled',
  -- Essencial (novos)
  'diary_unlimited',
  'full_history',
  'weekly_assessments',
  'simple_evolution_charts',
  'guided_text_meditations',
  'guided_diary_notes',
  'monthly_pdf_reports',
  'diary_mood_symptoms_summary',
  'evolution_highlights_no_clinical_analysis',
  'emotional_exercise_library',
  'no_ads',
  'priority_email_support',
  -- Terapêutico (novos)
  'deep_questionnaire',
  'personalized_self_care_plan',
  'advanced_diary',
  'extra_emotional_markers',
  'monthly_comparative_charts',
  'advanced_monthly_report',
  'personalized_content_recommendations',
  'weekly_self_care_plan',
  'early_access_content',
  'monthly_message_guidance',
  -- Terapêutico Plus (novos)
  'monthly_psychoanalyst_session_30min',
  'monthly_self_care_plan_review',
  'professional_comment_on_monthly_report',
  'maximum_priority_support'
);

-- Atualiza feature_names para os textos oficiais exatos
UPDATE plan_features SET feature_name = 'Artigos gratuitos'                          WHERE feature_key = 'articles_free';
UPDATE plan_features SET feature_name = 'Questionário básico de autoavaliação'       WHERE feature_key = 'basic_self_assessment';
UPDATE plan_features SET feature_name = 'Diário de bem-estar com até 5 entradas por mês' WHERE feature_key IN ('wellbeing_diary_5_month','diary_monthly_limit_5','wellbeing_diary_limited');
UPDATE plan_features SET feature_name = 'Registro simples de humor'                  WHERE feature_key = 'simple_mood_checkin';
UPDATE plan_features SET feature_name = 'Mini-desafios quinzenais automatizados'     WHERE feature_key = 'biweekly_auto_challenges';
UPDATE plan_features SET feature_name = 'Histórico limitado'                         WHERE feature_key = 'limited_history';
UPDATE plan_features SET feature_name = 'Conteúdos com anúncios'                    WHERE feature_key = 'ads_enabled';
UPDATE plan_features SET feature_name = 'Diário ilimitado'                          WHERE feature_key = 'diary_unlimited';
UPDATE plan_features SET feature_name = 'Histórico completo'                         WHERE feature_key = 'full_history';
UPDATE plan_features SET feature_name = 'Avaliações semanais'                        WHERE feature_key = 'weekly_assessments';
UPDATE plan_features SET feature_name = 'Gráficos simples de evolução'              WHERE feature_key = 'simple_evolution_charts';
UPDATE plan_features SET feature_name = 'Meditações guiadas em texto'               WHERE feature_key = 'guided_text_meditations';
UPDATE plan_features SET feature_name = 'Notas guiadas no diário'                   WHERE feature_key = 'guided_diary_notes';
UPDATE plan_features SET feature_name = 'Relatórios mensais em PDF'                 WHERE feature_key = 'monthly_pdf_reports';
UPDATE plan_features SET feature_name = 'Resumo do diário, humor e sintomas'        WHERE feature_key = 'diary_mood_symptoms_summary';
UPDATE plan_features SET feature_name = 'Destaques de evolução, sem análise clínica' WHERE feature_key = 'evolution_highlights_no_clinical_analysis';
UPDATE plan_features SET feature_name = 'Biblioteca de exercícios emocionais'       WHERE feature_key = 'emotional_exercise_library';
UPDATE plan_features SET feature_name = 'Sem anúncios'                              WHERE feature_key = 'no_ads';
UPDATE plan_features SET feature_name = 'Suporte por e-mail prioritário'            WHERE feature_key = 'priority_email_support';
UPDATE plan_features SET feature_name = 'Questionário aprofundado'                  WHERE feature_key = 'deep_questionnaire';
UPDATE plan_features SET feature_name = 'Plano de autocuidado personalizado'        WHERE feature_key = 'personalized_self_care_plan';
UPDATE plan_features SET feature_name = 'Diário avançado'                           WHERE feature_key = 'advanced_diary';
UPDATE plan_features SET feature_name = 'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia' WHERE feature_key IN ('extra_emotional_markers','extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy');
UPDATE plan_features SET feature_name = 'Gráficos comparativos mensais'             WHERE feature_key = 'monthly_comparative_charts';
UPDATE plan_features SET feature_name = 'Relatório mensal avançado'                 WHERE feature_key = 'advanced_monthly_report';
UPDATE plan_features SET feature_name = 'Recomendações personalizadas de conteúdo'  WHERE feature_key = 'personalized_content_recommendations';
UPDATE plan_features SET feature_name = 'Plano semanal de autocuidado'              WHERE feature_key = 'weekly_self_care_plan';
UPDATE plan_features SET feature_name = 'Acesso antecipado a novos conteúdos'       WHERE feature_key = 'early_access_content';
UPDATE plan_features SET feature_name = 'Orientação mensal por mensagem'            WHERE feature_key = 'monthly_message_guidance';
UPDATE plan_features SET feature_name = '1 sessão mensal de 30 minutos com Psicanalista' WHERE feature_key = 'monthly_psychoanalyst_session_30min';
UPDATE plan_features SET feature_name = 'Revisão mensal do plano de autocuidado'    WHERE feature_key = 'monthly_self_care_plan_review';
UPDATE plan_features SET feature_name = 'Comentário individual sobre o relatório do mês' WHERE feature_key = 'professional_comment_on_monthly_report';
UPDATE plan_features SET feature_name = 'Suporte prioritário máximo'                WHERE feature_key = 'maximum_priority_support';

-- Garante que feature_keys que podem ter nomes alternativos também sejam marcados
UPDATE plan_features SET is_display = true WHERE feature_key IN (
  'diary_monthly_limit_5',
  'wellbeing_diary_limited',
  'extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy'
);
