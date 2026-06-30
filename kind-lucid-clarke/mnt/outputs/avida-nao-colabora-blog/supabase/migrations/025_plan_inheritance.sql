-- Migration 025: Herança de benefícios entre planos

ALTER TABLE plan_configs ADD COLUMN IF NOT EXISTS inherit_previous_plan       BOOLEAN DEFAULT false;
ALTER TABLE plan_configs ADD COLUMN IF NOT EXISTS inherits_from_plan_key      TEXT;
ALTER TABLE plan_configs ADD COLUMN IF NOT EXISTS show_inherited_as_single_item BOOLEAN DEFAULT true;

-- Configura herança padrão oficial
UPDATE plan_configs SET inherit_previous_plan = false, inherits_from_plan_key = null   WHERE plan_key = 'free';
UPDATE plan_configs SET inherit_previous_plan = true,  inherits_from_plan_key = 'free'         WHERE plan_key = 'essential';
UPDATE plan_configs SET inherit_previous_plan = true,  inherits_from_plan_key = 'essential'    WHERE plan_key = 'therapeutic';
UPDATE plan_configs SET inherit_previous_plan = true,  inherits_from_plan_key = 'therapeutic'  WHERE plan_key = 'therapeutic-plus';

-- Insere planos se ainda não existirem
INSERT INTO plan_configs (plan_key, label, price, description, recommended, active, diary_limit, inherit_previous_plan, inherits_from_plan_key, show_inherited_as_single_item)
VALUES
  ('free',             'Gratuito',         'R$ 0',     'Para começar a se conhecer melhor, sem custo.',            false, true, 5,    false, null,          true),
  ('essential',        'Essencial',        'R$ 19,90', 'Para acompanhar sua evolução emocional com continuidade.', false, true, null, true,  'free',        true),
  ('therapeutic',      'Terapêutico',      'R$ 39,90', 'Para uma experiência personalizada de autocuidado.',       true,  true, null, true,  'essential',   true),
  ('therapeutic-plus', 'Terapêutico Plus', 'R$ 79,90', 'Para quem deseja acompanhamento individual mensal.',       false, true, null, true,  'therapeutic', true)
ON CONFLICT (plan_key) DO UPDATE SET
  inherit_previous_plan        = EXCLUDED.inherit_previous_plan,
  inherits_from_plan_key       = EXCLUDED.inherits_from_plan_key,
  show_inherited_as_single_item = EXCLUDED.show_inherited_as_single_item,
  updated_at = now();
