-- Migration 024: Garante coluna is_display e sincroniza recursos oficiais
-- Complementa a 023 — pode ser executada mesmo se a 023 já foi aplicada.

-- 1. Garante que a coluna existe (caso a 023 não tenha sido aplicada)
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS is_display BOOLEAN DEFAULT true;

-- 2. Recursos antigos (não oficiais) ficam ocultos
UPDATE plan_features SET is_display = false
WHERE feature_key NOT IN (
  'articles_free','basic_self_assessment','wellbeing_diary_5_month',
  'simple_mood_checkin','biweekly_auto_challenges','limited_history','ads_enabled',
  'diary_unlimited','full_history','weekly_assessments','simple_evolution_charts',
  'guided_text_meditations','guided_diary_notes','monthly_pdf_reports',
  'diary_mood_symptoms_summary','evolution_highlights_no_clinical_analysis',
  'emotional_exercise_library','no_ads','priority_email_support',
  'deep_questionnaire','personalized_self_care_plan','advanced_diary',
  'extra_emotional_markers','monthly_comparative_charts','advanced_monthly_report',
  'personalized_content_recommendations','weekly_self_care_plan','early_access_content',
  'monthly_message_guidance','monthly_psychoanalyst_session_30min',
  'monthly_self_care_plan_review','professional_comment_on_monthly_report',
  'maximum_priority_support'
);

-- 3. Recursos oficiais sempre visíveis
UPDATE plan_features SET is_display = true
WHERE feature_key IN (
  'articles_free','basic_self_assessment','wellbeing_diary_5_month',
  'simple_mood_checkin','biweekly_auto_challenges','limited_history','ads_enabled',
  'diary_unlimited','full_history','weekly_assessments','simple_evolution_charts',
  'guided_text_meditations','guided_diary_notes','monthly_pdf_reports',
  'diary_mood_symptoms_summary','evolution_highlights_no_clinical_analysis',
  'emotional_exercise_library','no_ads','priority_email_support',
  'deep_questionnaire','personalized_self_care_plan','advanced_diary',
  'extra_emotional_markers','monthly_comparative_charts','advanced_monthly_report',
  'personalized_content_recommendations','weekly_self_care_plan','early_access_content',
  'monthly_message_guidance','monthly_psychoanalyst_session_30min',
  'monthly_self_care_plan_review','professional_comment_on_monthly_report',
  'maximum_priority_support'
);

-- 4. Insere recursos oficiais que ainda não existam no banco
INSERT INTO plan_features (feature_key, feature_name, category, display_order, is_display, is_implemented)
VALUES
  ('articles_free',                          'Artigos gratuitos',                                                                                          'Conteúdo',            1,  true, true),
  ('basic_self_assessment',                  'Questionário básico de autoavaliação',                                                                        'Avaliações',          2,  true, true),
  ('wellbeing_diary_5_month',                'Diário de bem-estar com até 5 entradas por mês',                                                              'Diário',              3,  true, true),
  ('simple_mood_checkin',                    'Registro simples de humor',                                                                                   'Diário',              4,  true, true),
  ('biweekly_auto_challenges',               'Mini-desafios quinzenais automatizados',                                                                      'Avaliações',          5,  true, true),
  ('limited_history',                        'Histórico limitado',                                                                                          'Histórico',           6,  true, true),
  ('ads_enabled',                            'Conteúdos com anúncios',                                                                                      'Anúncios',            7,  true, true),
  ('diary_unlimited',                        'Diário ilimitado',                                                                                            'Diário',              8,  true, true),
  ('full_history',                           'Histórico completo',                                                                                          'Histórico',           9,  true, true),
  ('weekly_assessments',                     'Avaliações semanais',                                                                                         'Avaliações',          10, true, true),
  ('simple_evolution_charts',                'Gráficos simples de evolução',                                                                                'Relatórios',          11, true, true),
  ('guided_text_meditations',                'Meditações guiadas em texto',                                                                                 'Conteúdo',            12, true, true),
  ('guided_diary_notes',                     'Notas guiadas no diário',                                                                                     'Diário',              13, true, true),
  ('monthly_pdf_reports',                    'Relatórios mensais em PDF',                                                                                   'Relatórios',          14, true, true),
  ('diary_mood_symptoms_summary',            'Resumo do diário, humor e sintomas',                                                                          'Relatórios',          15, true, true),
  ('evolution_highlights_no_clinical_analysis','Destaques de evolução, sem análise clínica',                                                               'Relatórios',          16, true, true),
  ('emotional_exercise_library',             'Biblioteca de exercícios emocionais',                                                                         'Conteúdo',            17, true, true),
  ('no_ads',                                 'Sem anúncios',                                                                                                'Anúncios',            18, true, true),
  ('priority_email_support',                 'Suporte por e-mail prioritário',                                                                              'Suporte',             19, true, true),
  ('deep_questionnaire',                     'Questionário aprofundado',                                                                                    'Avaliações',          20, true, true),
  ('personalized_self_care_plan',            'Plano de autocuidado personalizado',                                                                          'Autocuidado',         21, true, true),
  ('advanced_diary',                         'Diário avançado',                                                                                             'Diário',              22, true, true),
  ('extra_emotional_markers',                'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia',              'Diário',              23, true, true),
  ('monthly_comparative_charts',             'Gráficos comparativos mensais',                                                                               'Relatórios',          24, true, true),
  ('advanced_monthly_report',                'Relatório mensal avançado',                                                                                   'Relatórios',          25, true, true),
  ('personalized_content_recommendations',   'Recomendações personalizadas de conteúdo',                                                                    'Conteúdo',            26, true, true),
  ('weekly_self_care_plan',                  'Plano semanal de autocuidado',                                                                                'Autocuidado',         27, true, true),
  ('early_access_content',                   'Acesso antecipado a novos conteúdos',                                                                         'Conteúdo',            28, true, true),
  ('monthly_message_guidance',               'Orientação mensal por mensagem',                                                                              'Suporte',             29, true, true),
  ('monthly_psychoanalyst_session_30min',    '1 sessão mensal de 30 minutos com Psicanalista',                                                              'Sessão/Profissional', 30, true, true),
  ('monthly_self_care_plan_review',          'Revisão mensal do plano de autocuidado',                                                                      'Sessão/Profissional', 31, true, true),
  ('professional_comment_on_monthly_report', 'Comentário individual sobre o relatório do mês',                                                              'Sessão/Profissional', 32, true, true),
  ('maximum_priority_support',               'Suporte prioritário máximo',                                                                                  'Suporte',             33, true, true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name  = EXCLUDED.feature_name,
  category      = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  is_display    = true,
  updated_at    = now();

-- 5. Insere acessos padrão por plano (sem sobrescrever ajustes manuais existentes)
INSERT INTO plan_feature_access (plan_key, feature_key, enabled)
SELECT plans.plan_key, feats.feature_key, feats.default_enabled
FROM (VALUES
  ('free'),('essential'),('therapeutic'),('therapeutic-plus')
) AS plans(plan_key)
CROSS JOIN (VALUES
  ('articles_free',                          true,  true,  true,  true),
  ('basic_self_assessment',                  true,  true,  true,  true),
  ('wellbeing_diary_5_month',                true,  true,  true,  true),
  ('simple_mood_checkin',                    true,  true,  true,  true),
  ('biweekly_auto_challenges',               true,  true,  true,  true),
  ('limited_history',                        true,  true,  true,  true),
  ('ads_enabled',                            true,  true,  true,  true),
  ('diary_unlimited',                        false, true,  true,  true),
  ('full_history',                           false, true,  true,  true),
  ('weekly_assessments',                     false, true,  true,  true),
  ('simple_evolution_charts',                false, true,  true,  true),
  ('guided_text_meditations',                false, true,  true,  true),
  ('guided_diary_notes',                     false, true,  true,  true),
  ('monthly_pdf_reports',                    false, true,  true,  true),
  ('diary_mood_symptoms_summary',            false, true,  true,  true),
  ('evolution_highlights_no_clinical_analysis', false, true, true, true),
  ('emotional_exercise_library',             false, true,  true,  true),
  ('no_ads',                                 false, true,  true,  true),
  ('priority_email_support',                 false, true,  true,  true),
  ('deep_questionnaire',                     false, false, true,  true),
  ('personalized_self_care_plan',            false, false, true,  true),
  ('advanced_diary',                         false, false, true,  true),
  ('extra_emotional_markers',                false, false, true,  true),
  ('monthly_comparative_charts',             false, false, true,  true),
  ('advanced_monthly_report',                false, false, true,  true),
  ('personalized_content_recommendations',   false, false, true,  true),
  ('weekly_self_care_plan',                  false, false, true,  true),
  ('early_access_content',                   false, false, true,  true),
  ('monthly_message_guidance',               false, false, true,  true),
  ('monthly_psychoanalyst_session_30min',    false, false, false, true),
  ('monthly_self_care_plan_review',          false, false, false, true),
  ('professional_comment_on_monthly_report', false, false, false, true),
  ('maximum_priority_support',               false, false, false, true)
) AS feats(feature_key, free_enabled, essential_enabled, therapeutic_enabled, plus_enabled),
LATERAL (
  SELECT CASE plans.plan_key
    WHEN 'free'              THEN feats.free_enabled
    WHEN 'essential'         THEN feats.essential_enabled
    WHEN 'therapeutic'       THEN feats.therapeutic_enabled
    WHEN 'therapeutic-plus'  THEN feats.plus_enabled
    ELSE false
  END AS default_enabled
) computed
ON CONFLICT (plan_key, feature_key) DO NOTHING;
