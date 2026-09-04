-- ============================================================================
-- Sincroniza plan_features.feature_name com os nomes atuais exibidos no site
-- (Pricing.tsx) e com OFFICIAL_FEATURES (officialPlans.ts).
--
-- Contexto: o catálogo do Admin (aba "Catálogo de funcionalidades") lê o nome
-- de cada recurso do banco quando existe uma linha em plan_features. Como o
-- código-fonte foi atualizado para usar exatamente os mesmos rótulos do
-- Pricing, mas o banco já tinha linhas semeadas com nomes antigos, o site
-- passou a exibir texto desatualizado (herdado do banco) em vez do texto
-- atual do código — o oposto do pretendido.
--
-- ADITIVO/IDEMPOTENTE: só atualiza a linha se feature_name ainda for
-- exatamente o valor antigo. Se um admin já personalizou esse nome pelo
-- painel, o valor não bate mais e a linha é preservada sem alteração.
-- ============================================================================

update public.plan_features set feature_name = 'Artigos e conteúdos', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'articles_free' and feature_name = 'Blog aberto';

update public.plan_features set feature_name = 'Diário emocional', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'wellbeing_diary_5_month' and feature_name = 'Diário emocional básico';

update public.plan_features set feature_name = 'Questionários de autoconhecimento', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'basic_self_assessment' and feature_name = 'Questionário inicial';

update public.plan_features set feature_name = 'Conteúdos Guiados', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'biweekly_auto_challenges' and feature_name = 'Algumas práticas guiadas';

update public.plan_features set feature_name = 'Diário emocional', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'diary_unlimited' and feature_name = 'Diário ilimitado';

update public.plan_features set feature_name = 'Mapa Emocional', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'diary_mood_symptoms_summary' and feature_name = 'Mapa emocional completo';

update public.plan_features set feature_name = 'Minha História', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'full_history' and feature_name = 'Histórico e gráficos';

update public.plan_features set feature_name = 'Conteúdos Guiados', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'emotional_exercise_library' and feature_name = 'Conteúdos guiados completos';

update public.plan_features set feature_name = 'Relatório Semanal', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'weekly_assessments' and feature_name = 'Relatório semanal automático';

update public.plan_features set feature_name = 'Plano de Autocuidado Mensal', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'personalized_self_care_plan' and feature_name = 'Plano de autocuidado mensal';

update public.plan_features set feature_name = 'Relatório Mensal Aprofundado', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'advanced_monthly_report' and feature_name = 'Relatório mensal aprofundado';

update public.plan_features set feature_name = 'Orientação Mensal', presentation_revision = extract(epoch from now())::bigint * 1000
  where feature_key = 'monthly_message_guidance' and feature_name = 'Orientação mensal por mensagem';
