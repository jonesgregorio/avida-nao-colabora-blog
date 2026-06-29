-- Migration 011: tabela de configuração do diário por plano
--               + fix coluna admin_notes e status em support_tickets

-- ─────────────────────────────────────────────────────────────
-- 1. DIARY PLAN CONFIGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diary_plan_configs (
  plan_key    TEXT PRIMARY KEY,  -- 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'
  config      JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE diary_plan_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_diary_plan_configs" ON diary_plan_configs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 2. SUPPORT_TICKETS — fix mismatch com AdminSupport
--    - Componente usa: admin_reply, status 'resolved', plan
--    - Migration 007 tem: admin_notes, status CHECK 'open'|'in_progress'|'closed'
-- ─────────────────────────────────────────────────────────────

-- Adiciona admin_reply como alias de admin_notes
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_reply TEXT;

-- Sincroniza admin_reply ↔ admin_notes em dados existentes
UPDATE support_tickets SET admin_reply = admin_notes WHERE admin_reply IS NULL AND admin_notes IS NOT NULL;

-- Adiciona coluna plan (plano do usuário no momento do ticket)
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS plan TEXT;

-- Remove constraint de CHECK em status para permitir ambos os valores
-- (O componente usa 'resolved', DB estava restringindo a 'closed')
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in_progress', 'closed', 'resolved'));
