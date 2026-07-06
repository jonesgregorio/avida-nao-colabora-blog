-- ============================================================
-- Migration 057: Migração de planos — 4 → 3 (free, essential, plus)
--   'therapeutic' e 'therapeutic-plus' passam a ser 'plus'.
--   Idempotente. Amplia os CHECK constraints ANTES de mexer nos dados
--   (senão SET plan='plus' viola o constraint antigo e aborta tudo).
-- ============================================================

-- 0. Ampliar CHECK constraints para aceitar 'plus' (mantém legado p/ não invalidar
--    linhas existentes durante o ALTER). Cada um protegido contra tabela ausente.
DO $$ BEGIN
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
  ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check
    CHECK (plan IN ('free','essential','plus','therapeutic','therapeutic-plus'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE guided_meditations DROP CONSTRAINT IF EXISTS guided_meditations_plan_level_check;
  ALTER TABLE guided_meditations ADD CONSTRAINT guided_meditations_plan_level_check
    CHECK (plan_level IN ('free','essential','plus','therapeutic','therapeutic-plus'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE mini_challenges DROP CONSTRAINT IF EXISTS mini_challenges_plan_level_check;
  ALTER TABLE mini_challenges ADD CONSTRAINT mini_challenges_plan_level_check
    CHECK (plan_level IN ('free','essential','plus','therapeutic','therapeutic-plus'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE guided_prompts DROP CONSTRAINT IF EXISTS guided_prompts_plan_level_check;
  ALTER TABLE guided_prompts ADD CONSTRAINT guided_prompts_plan_level_check
    CHECK (plan_level IN ('free','essential','plus','therapeutic','therapeutic-plus'));
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_plan_required_check;
  ALTER TABLE articles ADD CONSTRAINT articles_plan_required_check
    CHECK (plan_required IN ('free','essential','plus','therapeutic','therapeutic-plus'));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- user_subscriptions.plan_key: remove CHECK restritivo se existir (não recria).
DO $$ BEGIN
  ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_plan_key_check;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 1. profiles.plan
UPDATE profiles SET plan = 'plus'
 WHERE plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');

-- 2. user_subscriptions (plano atual + plano pendente de downgrade)
UPDATE user_subscriptions SET plan_key = 'plus'
 WHERE plan_key IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
DO $$ BEGIN
  UPDATE user_subscriptions SET pending_plan = 'plus'
   WHERE pending_plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
EXCEPTION WHEN undefined_column THEN NULL; END $$;

-- 3. Histórico de mudança de plano (nomes de coluna variam entre versões)
DO $$ BEGIN
  UPDATE plan_change_history SET from_plan = 'plus'
   WHERE from_plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
  UPDATE plan_change_history SET to_plan = 'plus'
   WHERE to_plan IN ('therapeutic', 'therapeutic-plus', 'therapeutic_plus');
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;

-- 4. plan_configs: garante a linha 'plus', desativa legadas, Essencial recomendado
INSERT INTO plan_configs (plan_key, label, price, description, is_recommended, active)
SELECT 'plus', 'Plus', 'R$ 39,90', 'Receba orientação para agir.', false, true
 WHERE NOT EXISTS (SELECT 1 FROM plan_configs WHERE plan_key = 'plus');
UPDATE plan_configs SET label = 'Plus', price = 'R$ 39,90', active = true WHERE plan_key = 'plus';
UPDATE plan_configs SET active = false WHERE plan_key IN ('therapeutic', 'therapeutic-plus');
UPDATE plan_configs SET is_recommended = (plan_key = 'essential');

-- 5. plan_feature_access: cria linhas 'plus' herdando o acesso do maior legado
--    (respeita a FK: só feature_keys existentes em plan_features)
DO $$ BEGIN
  INSERT INTO plan_feature_access (plan_key, feature_key, enabled)
  SELECT 'plus', pfa.feature_key, bool_or(pfa.enabled)
    FROM plan_feature_access pfa
   WHERE pfa.plan_key IN ('therapeutic', 'therapeutic-plus')
     AND EXISTS (SELECT 1 FROM plan_features pf WHERE pf.feature_key = pfa.feature_key)
   GROUP BY pfa.feature_key
  ON CONFLICT (plan_key, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- 6. diary_plan_configs: copia a config do legado para 'plus' (se ainda não existir)
DO $$ BEGIN
  INSERT INTO diary_plan_configs (plan_key, config, updated_at)
  SELECT 'plus', config, NOW()
    FROM diary_plan_configs
   WHERE plan_key IN ('therapeutic-plus', 'therapeutic')
   ORDER BY CASE plan_key WHEN 'therapeutic-plus' THEN 0 ELSE 1 END
   LIMIT 1
  ON CONFLICT (plan_key) DO NOTHING;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- 7. email_templates: troca termos antigos por "Plus"
DO $$ BEGIN
  UPDATE email_templates SET
    subject   = replace(replace(subject,   'Terapêutico Plus', 'Plus'), 'Terapêutico', 'Plus'),
    body_text = replace(replace(body_text, 'Terapêutico Plus', 'Plus'), 'Terapêutico', 'Plus')
   WHERE subject ILIKE '%Terapêutico%' OR body_text ILIKE '%Terapêutico%';
EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END $$;
