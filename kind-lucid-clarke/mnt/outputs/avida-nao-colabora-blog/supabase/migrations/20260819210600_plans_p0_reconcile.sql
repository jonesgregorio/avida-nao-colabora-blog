-- P0 Planos: reconcilia o schema live e a matriz de recursos com a fonte oficial.
-- Idempotente. Mantém planos legados apenas como histórico inativo.

-- A tela AdminPlans já grava estes campos. Em ambientes antigos a migration 025
-- não foi aplicada, então o Admin tentava salvar colunas inexistentes.
ALTER TABLE public.plan_configs
  ADD COLUMN IF NOT EXISTS inherit_previous_plan boolean NOT NULL DEFAULT false;
ALTER TABLE public.plan_configs
  ADD COLUMN IF NOT EXISTS inherits_from_plan_key text;
ALTER TABLE public.plan_configs
  ADD COLUMN IF NOT EXISTS show_inherited_as_single_item boolean NOT NULL DEFAULT true;

-- Três planos comerciais oficiais.
INSERT INTO public.plan_configs (
  plan_key, label, price, description, is_recommended, recommended, active,
  diary_limit, inherit_previous_plan, inherits_from_plan_key,
  show_inherited_as_single_item, updated_at
)
VALUES
  ('free',      'Gratuito',  'R$ 0',     'Comece a se entender.',          false, false, true, 5,    false, null,        true, now()),
  ('essential', 'Essencial', 'R$ 19,90', 'Acompanhe seus padrões.',        true,  true,  true, null, true,  'free',      true, now()),
  ('plus',      'Plus',      'R$ 39,90', 'Receba orientação para agir.',   false, false, true, null, true,  'essential', true, now())
ON CONFLICT (plan_key) DO UPDATE SET
  label = EXCLUDED.label,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  is_recommended = EXCLUDED.is_recommended,
  recommended = EXCLUDED.recommended,
  active = EXCLUDED.active,
  diary_limit = EXCLUDED.diary_limit,
  inherit_previous_plan = EXCLUDED.inherit_previous_plan,
  inherits_from_plan_key = EXCLUDED.inherits_from_plan_key,
  show_inherited_as_single_item = EXCLUDED.show_inherited_as_single_item,
  updated_at = now();

-- Legados continuam consultáveis para histórico, mas nunca são ofertas ativas.
UPDATE public.plan_configs
   SET active = false,
       is_recommended = false,
       recommended = false,
       inherit_previous_plan = false,
       inherits_from_plan_key = null,
       updated_at = now()
 WHERE plan_key IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');

-- Catálogo oficial de 13 recursos. Definições extras podem permanecer em
-- plan_features como histórico, porém NÃO podem conceder acesso aos planos atuais.
INSERT INTO public.plan_features (
  feature_key, feature_name, feature_description, category,
  display_order, is_implemented, updated_at
)
VALUES
  ('articles_free',                          'Blog aberto',                                  '', 'Conteúdo',                 1, true, now()),
  ('wellbeing_diary_5_month',                'Diário emocional básico',                      '', 'Diário',                   2, true, now()),
  ('basic_self_assessment',                  'Questionário inicial',                         '', 'Questionários',            3, true, now()),
  ('biweekly_auto_challenges',               'Algumas práticas guiadas',                     '', 'Conteúdo',                  4, true, now()),
  ('diary_unlimited',                        'Diário ilimitado',                             '', 'Diário',                   5, true, now()),
  ('diary_mood_symptoms_summary',            'Mapa emocional completo',                      '', 'Mapa emocional',           6, true, now()),
  ('full_history',                           'Histórico e gráficos',                         '', 'Histórico',                7, true, now()),
  ('emotional_exercise_library',             'Conteúdos guiados completos',                  '', 'Conteúdo',                  8, true, now()),
  ('weekly_assessments',                     'Relatório semanal automático',                 '', 'Relatórios',               9, true, now()),
  ('personalized_self_care_plan',            'Plano de autocuidado mensal',                  '', 'Autocuidado',              10, true, now()),
  ('advanced_monthly_report',                'Relatório mensal aprofundado',                 '', 'Relatórios',              11, true, now()),
  ('professional_comment_on_monthly_report', 'Comentário profissional sobre o relatório',   '', 'Orientação profissional', 12, true, now()),
  ('monthly_message_guidance',               'Orientação mensal por mensagem',               '', 'Orientação profissional', 13, true, now())
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  is_implemented = true,
  updated_at = now();

-- Remove dos três planos atuais todas as concessões antigas. Isso elimina aliases
-- que o Admin resolvia para uma chave nova (ex.: limited_history -> full_history)
-- e benefícios aposentados como individual_session/monthly_pdf_report.
DELETE FROM public.plan_feature_access
 WHERE plan_key IN ('free', 'essential', 'plus')
   AND feature_key NOT IN (
     'articles_free', 'wellbeing_diary_5_month', 'basic_self_assessment', 'biweekly_auto_challenges',
     'diary_unlimited', 'diary_mood_symptoms_summary', 'full_history',
     'emotional_exercise_library', 'weekly_assessments',
     'personalized_self_care_plan', 'advanced_monthly_report',
     'professional_comment_on_monthly_report', 'monthly_message_guidance'
   );

-- Matriz exata: Gratuito=4, Essencial=9 (herda Gratuito), Plus=13 (herda Essencial).
WITH official(feature_key, minimum_rank) AS (
  VALUES
    ('articles_free', 0),
    ('wellbeing_diary_5_month', 0),
    ('basic_self_assessment', 0),
    ('biweekly_auto_challenges', 0),
    ('diary_unlimited', 1),
    ('diary_mood_symptoms_summary', 1),
    ('full_history', 1),
    ('emotional_exercise_library', 1),
    ('weekly_assessments', 1),
    ('personalized_self_care_plan', 2),
    ('advanced_monthly_report', 2),
    ('professional_comment_on_monthly_report', 2),
    ('monthly_message_guidance', 2)
), plans(plan_key, plan_rank) AS (
  VALUES ('free', 0), ('essential', 1), ('plus', 2)
)
INSERT INTO public.plan_feature_access (plan_key, feature_key, enabled, updated_at)
SELECT p.plan_key, o.feature_key, p.plan_rank >= o.minimum_rank, now()
  FROM plans p
 CROSS JOIN official o
ON CONFLICT (plan_key, feature_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- Guardas: a migration deve falhar se o banco não terminar exatamente no modelo P0.
DO $$
DECLARE
  v_rows integer;
  v_extras integer;
BEGIN
  SELECT count(*) INTO v_rows
    FROM public.plan_feature_access
   WHERE plan_key IN ('free', 'essential', 'plus');
  IF v_rows <> 39 THEN
    RAISE EXCEPTION 'P0 planos: esperado 39 linhas de acesso, encontrado %', v_rows;
  END IF;

  SELECT count(*) INTO v_extras
    FROM public.plan_feature_access
   WHERE plan_key IN ('free', 'essential', 'plus')
     AND feature_key NOT IN (
       'articles_free', 'wellbeing_diary_5_month', 'basic_self_assessment', 'biweekly_auto_challenges',
       'diary_unlimited', 'diary_mood_symptoms_summary', 'full_history',
       'emotional_exercise_library', 'weekly_assessments',
       'personalized_self_care_plan', 'advanced_monthly_report',
       'professional_comment_on_monthly_report', 'monthly_message_guidance'
     );
  IF v_extras <> 0 THEN
    RAISE EXCEPTION 'P0 planos: ainda existem % permissões extras nos planos atuais', v_extras;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.plan_configs
     WHERE plan_key='essential' AND active=true
       AND price='R$ 19,90' AND recommended=true AND is_recommended=true
       AND inherit_previous_plan=true AND inherits_from_plan_key='free'
  ) THEN
    RAISE EXCEPTION 'P0 planos: configuração do Essencial não ficou canônica';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.plan_configs
     WHERE plan_key='plus' AND active=true
       AND price='R$ 39,90' AND recommended=false AND is_recommended=false
       AND inherit_previous_plan=true AND inherits_from_plan_key='essential'
  ) THEN
    RAISE EXCEPTION 'P0 planos: configuração do Plus não ficou canônica';
  END IF;
END $$;
