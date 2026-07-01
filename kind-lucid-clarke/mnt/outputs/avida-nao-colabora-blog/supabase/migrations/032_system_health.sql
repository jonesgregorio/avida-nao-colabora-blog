-- ─── Migration 032: Monitoramento do Sistema ─────────────────────────────────

CREATE TABLE IF NOT EXISTS system_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key TEXT NOT NULL,
  check_name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_tested',
  response_time_ms INTEGER,
  error_message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  severity TEXT DEFAULT 'info',
  checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shc_status_check') THEN
    ALTER TABLE system_health_checks
    ADD CONSTRAINT shc_status_check
    CHECK (status IN ('ok','warning','error','not_tested','running'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shc_severity_check') THEN
    ALTER TABLE system_health_checks
    ADD CONSTRAINT shc_severity_check
    CHECK (severity IN ('info','low','medium','high','critical'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shc_check_key ON system_health_checks(check_key);
CREATE INDEX IF NOT EXISTS idx_shc_checked_at ON system_health_checks(checked_at DESC);

ALTER TABLE system_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_health_checks" ON system_health_checks;
CREATE POLICY "admin_health_checks" ON system_health_checks
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─── Relatórios ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT DEFAULT 'automatic',
  summary TEXT,
  total_checks INTEGER DEFAULT 0,
  ok_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  critical_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_health_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_health_reports" ON system_health_reports;
CREATE POLICY "admin_health_reports" ON system_health_reports
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─── Incidentes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  first_detected_at TIMESTAMPTZ DEFAULT now(),
  last_detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  occurrences INTEGER DEFAULT 1,
  details JSONB DEFAULT '{}'::jsonb
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'si_status_check') THEN
    ALTER TABLE system_incidents
    ADD CONSTRAINT si_status_check
    CHECK (status IN ('open','investigating','resolved','ignored'));
  END IF;
END $$;

ALTER TABLE system_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_incidents" ON system_incidents;
CREATE POLICY "admin_incidents" ON system_incidents
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
