-- ============================================================================
-- Etapa 4 — Proveniência do Plano de Autocuidado
-- ============================================================================
-- Completa a rastreabilidade sem alterar conteúdo histórico. Os campos já
-- existentes generated_by_ai, fallback_used, reviewed_by e reviewed_at são
-- preservados; esta migration adiciona somente a marcação de edição humana e
-- invariantes coerentes com o fluxo de revisão.
-- ============================================================================

ALTER TABLE public.monthly_care_plans
  ADD COLUMN IF NOT EXISTS edited_by_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_care_plans_generation_origin_check'
      AND conrelid = 'public.monthly_care_plans'::regclass
  ) THEN
    ALTER TABLE public.monthly_care_plans
      ADD CONSTRAINT monthly_care_plans_generation_origin_check
      CHECK (NOT (COALESCE(generated_by_ai, false) AND COALESCE(fallback_used, false)));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_care_plans_sent_requires_review_check'
      AND conrelid = 'public.monthly_care_plans'::regclass
  ) THEN
    ALTER TABLE public.monthly_care_plans
      ADD CONSTRAINT monthly_care_plans_sent_requires_review_check
      CHECK (status <> 'sent' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'monthly_care_plans_edit_timestamp_check'
      AND conrelid = 'public.monthly_care_plans'::regclass
  ) THEN
    ALTER TABLE public.monthly_care_plans
      ADD CONSTRAINT monthly_care_plans_edit_timestamp_check
      CHECK (NOT edited_by_human OR edited_at IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.monthly_care_plans.edited_by_human IS
  'True quando um administrador alterou o conteúdo do resumo ou plano após a origem inicial (IA, fallback ou edição manual).';
COMMENT ON COLUMN public.monthly_care_plans.edited_at IS
  'Instante da edição humana mais recente detectada no conteúdo do resumo/plano.';

NOTIFY pgrst, 'reload schema';
