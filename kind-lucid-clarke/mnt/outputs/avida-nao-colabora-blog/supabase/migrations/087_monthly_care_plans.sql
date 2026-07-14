-- ============================================================================
-- 087 — Plano de Autocuidado Mensal (Plus): fila, workflow e fontes seguras
-- ============================================================================
-- Transforma os registros do último mês fechado em um Plano de Autocuidado com
-- apoio de IA + revisão humana obrigatória. Exclusivo do plano Plus.
--
-- Privacidade (§21): o admin NUNCA recebe o texto livre do diário. A RPC de
-- origem devolve apenas campos analíticos (humor/energia/ansiedade/tags), o
-- suficiente para montar métricas e alimentar a IA.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Tabela monthly_care_plans
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_care_plans (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_reference        DATE NOT NULL,               -- 1º dia do mês de referência
  period_start           DATE NOT NULL,
  period_end             DATE NOT NULL,
  available_at           DATE NOT NULL,
  plan_required          TEXT NOT NULL DEFAULT 'plus',
  status                 TEXT NOT NULL DEFAULT 'pending_generation',
  records_summary        JSONB DEFAULT '{}'::jsonb,   -- métricas agregadas (sem texto sensível)
  ai_summary             TEXT,                        -- resumo mensal (texto)
  ai_summary_json        JSONB DEFAULT '{}'::jsonb,   -- resumo estruturado (§7)
  care_plan              JSONB DEFAULT '{}'::jsonb,   -- plano estruturado (§8)
  recommended_content_ids UUID[] DEFAULT '{}',
  admin_notes            TEXT,
  generated_by_ai        BOOLEAN DEFAULT false,
  generated_at           TIMESTAMPTZ,
  reviewed_by            UUID,
  reviewed_at            TIMESTAMPTZ,
  sent_by                UUID,
  sent_at                TIMESTAMPTZ,
  failed_reason          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_care_plans_status_check') THEN
    ALTER TABLE monthly_care_plans ADD CONSTRAINT monthly_care_plans_status_check
      CHECK (status IN ('pending_generation','generating','draft','pending_review','approved','sent','failed','skipped'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_care_plans_plan_check') THEN
    ALTER TABLE monthly_care_plans ADD CONSTRAINT monthly_care_plans_plan_check
      CHECK (plan_required = 'plus');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_care_plans_user_month_uniq') THEN
    ALTER TABLE monthly_care_plans ADD CONSTRAINT monthly_care_plans_user_month_uniq
      UNIQUE (user_id, month_reference);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mcp_status         ON monthly_care_plans(status);
CREATE INDEX IF NOT EXISTS idx_mcp_month          ON monthly_care_plans(month_reference);
CREATE INDEX IF NOT EXISTS idx_mcp_user_month     ON monthly_care_plans(user_id, month_reference);

-- ─────────────────────────────────────────────────────────────
-- 2. RLS — usuário só vê os PRÓPRIOS planos JÁ ENVIADOS; admin gerencia tudo
-- ─────────────────────────────────────────────────────────────
ALTER TABLE monthly_care_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_own_sent" ON monthly_care_plans;
CREATE POLICY "mcp_own_sent" ON monthly_care_plans
  FOR SELECT USING (auth.uid() = user_id AND status = 'sent');

DROP POLICY IF EXISTS "mcp_admin_all" ON monthly_care_plans;
CREATE POLICY "mcp_admin_all" ON monthly_care_plans
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────
-- 3. RPC: origem analítica do mês (SEM texto livre) — admin only
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_monthly_care_source(p_user UUID, p_start DATE, p_end DATE)
RETURNS TABLE (
  mood TEXT, mood_score INT, energy INT, anxiety_level INT,
  sleep_quality INT, self_esteem INT, stress_level INT,
  emotional_tags TEXT[], entry_type TEXT, created_at TIMESTAMPTZ, entry_date DATE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT
      d.mood::text,
      d.mood_score::int,
      d.energy::int,
      d.anxiety_level::int,
      d.sleep_quality::int,
      d.self_esteem::int,
      d.stress_level::int,
      CASE
        WHEN d.emotional_tags IS NULL THEN '{}'::text[]
        ELSE d.emotional_tags
      END,
      d.entry_type::text,
      d.created_at,
      COALESCE(d.date, d.created_at::date)
    FROM diary_entries d
    WHERE d.user_id = p_user
      AND COALESCE(d.date, d.created_at::date) BETWEEN p_start AND p_end;
END $$;

GRANT EXECUTE ON FUNCTION public.admin_monthly_care_source(UUID, DATE, DATE) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. RPC: usuários Plus elegíveis (com e-mail e ativação) — admin only
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_eligible_plus_users()
RETURNS TABLE (
  user_id UUID, full_name TEXT, email TEXT, plan TEXT,
  plan_activated_at TIMESTAMPTZ, subscription_status TEXT, created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN QUERY
    SELECT
      p.user_id,
      p.full_name,
      u.email::text,
      p.plan::text,
      p.plan_activated_at,
      p.subscription_status::text,
      p.created_at
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.plan IN ('plus', 'therapeutic', 'therapeutic-plus')
      AND (p.subscription_status IN ('active', 'trialing') OR p.unlimited_access = true);
END $$;

GRANT EXECUTE ON FUNCTION public.admin_eligible_plus_users() TO authenticated;

COMMENT ON TABLE monthly_care_plans IS 'Plano de Autocuidado Mensal (Plus) com workflow de status e revisão humana (087)';
