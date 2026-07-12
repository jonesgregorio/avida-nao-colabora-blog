-- ============================================================================
-- Migration 084: relatórios por ciclo (semanal Essencial / mensal Plus).
--
-- Tabela `reports` guarda relatórios FECHADOS (histórico + dedupe), gerados no
-- primeiro acesso após a data de disponibilização. O relatório "em construção"
-- é calculado ao vivo no cliente e NÃO é salvo.
--
-- Também adiciona profiles.plan_activated_at para o corte do 1º ciclo (§5/§6).
-- Aditivo e idempotente — não quebra dados antigos.
-- ============================================================================

-- 1) Data de ativação do plano (para cortar o 1º relatório na assinatura) ------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;

-- 2) Tabela de relatórios fechados --------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_type   TEXT NOT NULL,                       -- weekly | monthly
  plan_required TEXT NOT NULL DEFAULT 'essential',   -- essential | plus
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  generated_at  TIMESTAMPTZ DEFAULT now(),
  available_at  DATE,
  status        TEXT NOT NULL DEFAULT 'generated',   -- building | generated | archived | failed
  title         TEXT,
  summary       TEXT,
  content       JSONB DEFAULT '{}'::jsonb,
  pdf_url       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Colunas garantidas caso a tabela já exista de forma parcial.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS plan_required TEXT NOT NULL DEFAULT 'essential';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS available_at DATE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS content JSONB DEFAULT '{}'::jsonb;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Constraints (idempotentes).
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_type_check;
ALTER TABLE reports ADD CONSTRAINT reports_type_check CHECK (report_type IN ('weekly', 'monthly'));
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_plan_check;
ALTER TABLE reports ADD CONSTRAINT reports_plan_check CHECK (plan_required IN ('essential', 'plus'));
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('building', 'generated', 'archived', 'failed'));

-- Dedupe: um relatório por (usuário, tipo, período). §14
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_period ON reports (user_id, report_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS reports_user_recent ON reports (user_id, generated_at DESC);

-- 3) RLS: usuário só vê/gera os PRÓPRIOS; admin vê tudo. §16 -------------------
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports_own" ON reports;
CREATE POLICY "reports_own" ON reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reports_admin" ON reports;
CREATE POLICY "reports_admin" ON reports FOR ALL USING (is_admin());

-- 4) Reload do cache do PostgREST (DDL observado pelo pgrst_ddl_watch).
COMMENT ON TABLE reports IS 'Relatórios fechados por ciclo (weekly/monthly). Gerados no 1º acesso após available_at.';
