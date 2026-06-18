-- ============================================================
-- Migration 005: Tabela de eventos de analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event        TEXT NOT NULL,
  entity_id    TEXT,
  entity_title TEXT,
  metadata     JSONB,
  session_id   TEXT,
  referrer     TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries de analytics
CREATE INDEX IF NOT EXISTS idx_ae_event      ON analytics_events(event);
CREATE INDEX IF NOT EXISTS idx_ae_user       ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ae_created    ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ae_entity     ON analytics_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_ae_session    ON analytics_events(session_id);

-- RLS: anon pode inserir (tracking), admin pode ler tudo
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode inserir evento"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin lê todos os eventos"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
