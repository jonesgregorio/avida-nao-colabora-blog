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
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS presentation_revision BIGINT NOT NULL DEFAULT 0;

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

-- Protege a cópia editorial dos recursos técnicos contra sincronizadores antigos
-- que ainda enviam os nomes oficiais no upsert. O editor novo incrementa
-- presentation_revision quando a mudança textual é intencional.
CREATE OR REPLACE FUNCTION public.preserve_plan_feature_presentation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_system = true
     AND NEW.presentation_revision = OLD.presentation_revision THEN
    NEW.feature_name := OLD.feature_name;
    NEW.feature_description := OLD.feature_description;
    NEW.category := OLD.category;
    NEW.display_order := OLD.display_order;
    NEW.is_active := OLD.is_active;
    NEW.show_on_pricing := OLD.show_on_pricing;
    NEW.show_on_my_plan := OLD.show_on_my_plan;
    NEW.show_on_comparison := OLD.show_on_comparison;
    NEW.show_on_upgrade := OLD.show_on_upgrade;
    NEW.archived_at := OLD.archived_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_preserve_plan_feature_presentation ON public.plan_features;
CREATE TRIGGER trg_preserve_plan_feature_presentation
BEFORE UPDATE ON public.plan_features
FOR EACH ROW
EXECUTE FUNCTION public.preserve_plan_feature_presentation();

CREATE INDEX IF NOT EXISTS idx_plan_features_catalog_active_order
  ON public.plan_features (is_active, display_order, feature_name);

COMMENT ON COLUMN public.plan_features.feature_kind IS
  'technical = chave ligada a recurso real; commercial = benefício textual criado no Admin sem conceder entitlement técnico.';
COMMENT ON COLUMN public.plan_features.is_system IS
  'Recursos do sistema não podem ter feature_key alterada nem ser excluídos; apenas seu texto/apresentação pode ser editado.';
COMMENT ON COLUMN public.plan_features.is_active IS
  'False arquiva o item e o remove das superfícies comerciais sem apagar histórico.';
COMMENT ON COLUMN public.plan_features.presentation_revision IS
  'Marcador alterado somente pelo editor de catálogo para distinguir edição intencional de sincronizações legadas.';
COMMENT ON COLUMN public.plan_feature_access.custom_label IS
  'Texto opcional específico deste benefício para o plano. Não altera a feature_key nem entitlement técnico.';
COMMENT ON COLUMN public.plan_feature_access.custom_description IS
  'Descrição opcional específica deste benefício para o plano; usada apenas em superfícies comerciais.';
