-- 19R.A — fontes canônicas de recomendações contextuais.
-- A origem legada `home-hoje` permanece aceita durante a transição para que a
-- versão de produção anterior ao deploy não volte a falhar entre migration e rollout.
ALTER TABLE public.content_recommendations
  DROP CONSTRAINT IF EXISTS content_recommendations_source_check;

ALTER TABLE public.content_recommendations
  ADD CONSTRAINT content_recommendations_source_check
  CHECK (source IN (
    'guided_page', 'checkin', 'diary', 'questionnaire', 'map',
    'weekly_report', 'monthly_report', 'care_plan',
    'home', 'care', 'home-hoje'
  ));

COMMENT ON COLUMN public.content_recommendations.source IS
  'Origem da recomendação. home e care são fontes canônicas; home-hoje é legado temporariamente aceito para compatibilidade de rollout.';
