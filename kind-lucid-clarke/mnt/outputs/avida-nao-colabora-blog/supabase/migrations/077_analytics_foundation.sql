-- ============================================================================
-- 077 — Fundação da área Analytics
-- ============================================================================
-- Reaproveita analytics_events (já existe, 005) para o rastreamento de eventos
-- (page_view, cta_click, scroll_50, error_404, web_vital, etc.). Aqui cria as
-- tabelas de APOIO que precisam de gestão própria: redirecionamentos de 404,
-- definições de eventos personalizados, relatórios de IA salvos e configurações.
-- Tudo com RLS restrito a admin. LGPD: nada de IP completo nem conteúdo sensível.
-- ============================================================================

-- Redirecionamentos (para resolver 404)
CREATE TABLE IF NOT EXISTS analytics_redirects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path  text NOT NULL,
  to_path    text NOT NULL,
  type       integer NOT NULL DEFAULT 301 CHECK (type IN (301, 302)),
  is_active  boolean NOT NULL DEFAULT true,
  hits       integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uidx_redirect_from ON analytics_redirects(from_path);

-- Definições de eventos personalizados (rastreamento por seletor/URL)
CREATE TABLE IF NOT EXISTS analytics_custom_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  selector    text,
  url_pattern text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Relatórios de IA salvos (resumos/recomendações sobre os dados)
CREATE TABLE IF NOT EXISTS analytics_ai_reports (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       text NOT NULL DEFAULT 'weekly',   -- weekly | monthly | custom
  period     text,
  title      text,
  content    text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_created ON analytics_ai_reports(created_at DESC);

-- Configurações da área (singleton, id=1)
CREATE TABLE IF NOT EXISTS analytics_settings (
  id         integer PRIMARY KEY DEFAULT 1,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analytics_settings_single CHECK (id = 1)
);
INSERT INTO analytics_settings (id, config) VALUES (1, jsonb_build_object(
  'track_pageviews', true, 'track_scroll', true, 'track_cta', true, 'track_errors', true,
  'track_web_vitals', true, 'anonymize', true, 'retention_days', 365
)) ON CONFLICT (id) DO NOTHING;

-- ── RLS: só admin ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['analytics_redirects','analytics_custom_events','analytics_ai_reports','analytics_settings'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin())', t || '_admin', t);
  END LOOP;
END $$;

-- Permite o site público INSERIR eventos anônimos em analytics_events (page_view,
-- cta_click, scroll, error_404, web_vital) sem expor leitura. Leitura segue admin.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY';
  DROP POLICY IF EXISTS "ae_public_insert" ON analytics_events;
  CREATE POLICY "ae_public_insert" ON analytics_events FOR INSERT TO anon, authenticated WITH CHECK (true);
  DROP POLICY IF EXISTS "ae_admin_read" ON analytics_events;
  CREATE POLICY "ae_admin_read" ON analytics_events FOR SELECT USING (is_admin());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'analytics_events RLS: %', SQLERRM;
END $$;
