-- ============================================================================
-- Auditoria e idempotência das gerações emocionais.
--
-- Reaproveita ai_generation_logs e as tabelas já existentes. Não cria um fluxo
-- paralelo de relatórios, planos ou orientação.
-- ============================================================================

-- Alguns ambientes mais antigos ainda não receberam a migration 100. Garante a
-- mesma tabela-base antes de ampliá-la, mantendo a operação idempotente.
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type   text NOT NULL,
  prompt_preview text,
  result_preview text,
  provider       text NOT NULL DEFAULT 'gemini',
  status         text NOT NULL DEFAULT 'success',
  error_msg      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins_manage_ai_logs" ON public.ai_generation_logs;
CREATE POLICY "admins_manage_ai_logs" ON public.ai_generation_logs
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Metadados por conteúdo salvo: tornam a geração auditável sem gravar texto
-- íntimo do diário em logs.
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS ai_prompt_type text,
  ADD COLUMN IF NOT EXISTS ai_prompt_version text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS generated_by text,
  ADD COLUMN IF NOT EXISTS regenerated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regenerated_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_content jsonb;

ALTER TABLE public.monthly_care_plans
  ADD COLUMN IF NOT EXISTS ai_prompt_type text,
  ADD COLUMN IF NOT EXISTS ai_prompt_version text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS regenerated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regenerated_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_care_plan jsonb;

ALTER TABLE public.monthly_guidance_requests
  ADD COLUMN IF NOT EXISTS ai_draft_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_prompt_type text,
  ADD COLUMN IF NOT EXISTS ai_prompt_version text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS regenerated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regenerated_at timestamptz;

-- A tabela de log já existe e é exclusiva do admin. Estes campos permitem ao
-- painel distinguir geração, fallback, erro, período e eventual regeneração.
ALTER TABLE public.ai_generation_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_type text,
  ADD COLUMN IF NOT EXISTS prompt_version text,
  ADD COLUMN IF NOT EXISTS model_used text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_period_start date,
  ADD COLUMN IF NOT EXISTS source_period_end date,
  ADD COLUMN IF NOT EXISTS generation_status text,
  ADD COLUMN IF NOT EXISTS regenerated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;

-- Idempotência por conteúdo e período. Os índices não alteram conteúdo pronto;
-- apenas impedem que duas execuções concorrentes criem uma segunda linha.
CREATE UNIQUE INDEX IF NOT EXISTS monthly_care_plans_unique_period
  ON public.monthly_care_plans (user_id, period_start, period_end);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_guidance_requests_unique_month
  ON public.monthly_guidance_requests (user_id, month_key);

CREATE INDEX IF NOT EXISTS ai_generation_logs_user_period
  ON public.ai_generation_logs (user_id, source_period_start DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_generation_logs_status
  ON public.ai_generation_logs (generation_status, created_at DESC);

COMMENT ON COLUMN public.reports.previous_content IS
  'Conteúdo anterior preservado somente quando uma regeneração administrativa confirmada ocorrer.';
COMMENT ON COLUMN public.monthly_care_plans.previous_care_plan IS
  'Plano anterior preservado somente quando uma regeneração administrativa confirmada ocorrer.';
COMMENT ON COLUMN public.monthly_guidance_requests.ai_draft_json IS
  'Rascunho estruturado para revisão humana; não substitui a resposta final.';
COMMENT ON TABLE public.ai_generation_logs IS
  'Auditoria administrativa de gerações de IA, sem texto livre do diário.';

NOTIFY pgrst, 'reload schema';
