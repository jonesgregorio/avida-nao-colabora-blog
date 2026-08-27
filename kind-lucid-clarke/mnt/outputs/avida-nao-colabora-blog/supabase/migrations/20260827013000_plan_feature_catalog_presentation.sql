-- Catálogo central de funcionalidades dos planos — camada editorial/apresentacional.
-- IMPORTANTE: feature_key e as regras técnicas de entitlement continuam no código.
-- Estes campos controlam apenas nomes, descrições, ordem e onde o benefício é exibido.

ALTER TABLE public.plan_features
  ADD COLUMN IF NOT EXISTS feature_kind TEXT NOT NULL DEFAULT 'technical',
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_pricing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_my_plan BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_comparison BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_upgrade BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.plan_feature_access
  ADD COLUMN IF NOT EXISTS custom_description TEXT;

DO $$ BEGIN
  ALTER TABLE public.plan_features
    ADD CONSTRAINT plan_features_feature_kind_check
    CHECK (feature_kind IN ('technical', 'commercial'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.plan_features
SET feature_kind = COALESCE(NULLIF(feature_kind, ''), 'technical'),
    is_system = COALESCE(is_system, true),
    is_active = COALESCE(is_active, true),
    show_on_pricing = COALESCE(show_on_pricing, true),
    show_on_my_plan = COALESCE(show_on_my_plan, true),
    show_on_comparison = COALESCE(show_on_comparison, true),
    show_on_upgrade = COALESCE(show_on_upgrade, true)
WHERE feature_kind IS NULL
   OR feature_kind = ''
   OR is_system IS NULL
   OR is_active IS NULL
   OR show_on_pricing IS NULL
   OR show_on_my_plan IS NULL
   OR show_on_comparison IS NULL
   OR show_on_upgrade IS NULL;

CREATE INDEX IF NOT EXISTS idx_plan_features_catalog_active_order
  ON public.plan_features (is_active, display_order, feature_name);

COMMENT ON COLUMN public.plan_features.feature_kind IS
  'technical = chave ligada a recurso real; commercial = benefício textual criado no Admin sem conceder entitlement técnico.';
COMMENT ON COLUMN public.plan_features.is_system IS
  'Recursos do sistema não podem ter feature_key alterada nem ser excluídos; apenas seu texto/apresentação pode ser editado.';
COMMENT ON COLUMN public.plan_features.is_active IS
  'False arquiva o item e o remove das superfícies comerciais sem apagar histórico.';
COMMENT ON COLUMN public.plan_feature_access.custom_label IS
  'Texto opcional específico deste benefício para o plano. Não altera a feature_key nem entitlement técnico.';
COMMENT ON COLUMN public.plan_feature_access.custom_description IS
  'Descrição opcional específica deste benefício para o plano; usada apenas em superfícies comerciais.';
