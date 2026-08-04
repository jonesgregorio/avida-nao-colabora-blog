-- ─────────────────────────────────────────────────────────────────────────────
-- 111 — Criador de templates de e-mail com IA
-- Cria: custom_email_templates, email_automations
-- Estende: email_logs (automation_id, trigger_reason, to_email alias)
-- RLS: admin = tudo; usuário = só suas próprias email_preferences
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. custom_email_templates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.custom_email_templates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  objective            TEXT NOT NULL DEFAULT '',
  target_audience      TEXT NOT NULL DEFAULT 'all',
  tone                 TEXT NOT NULL DEFAULT 'acolhedor',
  email_type           TEXT NOT NULL DEFAULT 'reengajamento',
  related_plan         TEXT NOT NULL DEFAULT 'nenhum',
  ai_instruction       TEXT NOT NULL DEFAULT '',
  cta_label            TEXT NOT NULL DEFAULT '',
  cta_url              TEXT NOT NULL DEFAULT '',
  subject              TEXT NOT NULL DEFAULT '',
  preheader            TEXT NOT NULL DEFAULT '',
  body_html            TEXT NOT NULL DEFAULT '',
  footer_text          TEXT NOT NULL DEFAULT '',
  internal_notes       TEXT NOT NULL DEFAULT '',
  status               TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  is_ai_generated      BOOLEAN NOT NULL DEFAULT FALSE,
  ai_prompt            TEXT NOT NULL DEFAULT '',
  created_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_custom_email_templates" ON public.custom_email_templates;
CREATE POLICY "admin_all_custom_email_templates"
  ON public.custom_email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 2. email_automations ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_automations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id          UUID NOT NULL REFERENCES public.custom_email_templates(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  trigger_type         TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual','scheduled','recurring','event','segment')),
  trigger_event        TEXT,
  schedule_type        TEXT,
  scheduled_at         TIMESTAMPTZ,
  recurrence_rule      TEXT,
  target_segment       JSONB NOT NULL DEFAULT '{}',
  conditions           JSONB NOT NULL DEFAULT '{}',
  exclusion_rules      JSONB NOT NULL DEFAULT '{}',
  cooldown_days        INTEGER NOT NULL DEFAULT 7,
  max_sends_per_month  INTEGER NOT NULL DEFAULT 4,
  status               TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','active','paused','archived')),
  last_run_at          TIMESTAMPTZ,
  next_run_at          TIMESTAMPTZ,
  created_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_email_automations" ON public.email_automations;
CREATE POLICY "admin_all_email_automations"
  ON public.email_automations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 3. Estender email_logs com automation_id e trigger_reason ─────────────────
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS automation_id   UUID REFERENCES public.email_automations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_reason  TEXT;

-- ── 4. email_preferences (preferências do usuário para receber e-mails) ────────
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  receive_transactional       BOOLEAN NOT NULL DEFAULT TRUE,
  receive_reminders           BOOLEAN NOT NULL DEFAULT TRUE,
  receive_reengagement        BOOLEAN NOT NULL DEFAULT TRUE,
  receive_product_updates     BOOLEAN NOT NULL DEFAULT TRUE,
  receive_content             BOOLEAN NOT NULL DEFAULT TRUE,
  unsubscribed_at             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_email_preferences" ON public.email_preferences;
CREATE POLICY "user_own_email_preferences"
  ON public.email_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_email_preferences" ON public.email_preferences;
CREATE POLICY "admin_all_email_preferences"
  ON public.email_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 5. Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_custom_email_templates_status
  ON public.custom_email_templates (status);

CREATE INDEX IF NOT EXISTS idx_email_automations_template
  ON public.email_automations (template_id);

CREATE INDEX IF NOT EXISTS idx_email_automations_status
  ON public.email_automations (status);

CREATE INDEX IF NOT EXISTS idx_email_logs_automation
  ON public.email_logs (automation_id)
  WHERE automation_id IS NOT NULL;

-- ── 6. Função updated_at automático ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_custom_email_templates_updated_at ON public.custom_email_templates;
CREATE TRIGGER trg_custom_email_templates_updated_at
  BEFORE UPDATE ON public.custom_email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_email_automations_updated_at ON public.email_automations;
CREATE TRIGGER trg_email_automations_updated_at
  BEFORE UPDATE ON public.email_automations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
