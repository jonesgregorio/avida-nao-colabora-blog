-- ============================================================
-- Migration 004: Automação de e-mails
-- ============================================================

-- Tabela de logs de envio de e-mail
CREATE TABLE IF NOT EXISTS email_logs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content_id    UUID REFERENCES automated_contents(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  subject       TEXT,
  status        TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed'
  error         TEXT,
  sent_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id   ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_content_id ON email_logs(content_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at   ON email_logs(sent_at DESC);

-- Adicionar coluna email_notifications em profiles (se não existir)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;

-- RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê todos os logs"
  ON email_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- pg_cron: disparar send-automated-emails todo dia às 08:00
-- (requer extensão pg_cron habilitada no Supabase)
-- ============================================================

-- Habilitar extensão (rodar como superuser no Supabase SQL Editor)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar a Edge Function via HTTP call diária às 08:00 BRT (11:00 UTC)
-- NOTA: Substitua <PROJECT_REF> e <ANON_KEY> pelos seus valores do Supabase
/*
SELECT cron.schedule(
  'send-automated-emails-daily',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-automated-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Para verificar tarefas agendadas:
-- SELECT * FROM cron.job;

-- Para cancelar:
-- SELECT cron.unschedule('send-automated-emails-daily');
