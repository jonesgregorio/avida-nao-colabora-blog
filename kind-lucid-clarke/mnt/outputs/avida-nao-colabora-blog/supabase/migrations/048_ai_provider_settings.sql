-- ============================================================
-- Migration 048: Provider de IA ativo (failover multi-IA)
-- ------------------------------------------------------------
-- Guarda qual IA está ativa (pollinations / gemini / groq) para
-- que o app faça failover e o admin troque com 1 clique no
-- painel Saúde do Sistema. Linha única (id=1), leitura pública
-- (o frontend precisa saber qual provider usar), escrita só admin.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_settings (
  id              INT PRIMARY KEY DEFAULT 1,
  active_provider TEXT NOT NULL DEFAULT 'pollinations',
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT ai_settings_single_row CHECK (id = 1)
);

INSERT INTO ai_settings (id, active_provider)
VALUES (1, 'pollinations')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_settings_public_read" ON ai_settings;
CREATE POLICY "ai_settings_public_read" ON ai_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "ai_settings_admin_write" ON ai_settings;
CREATE POLICY "ai_settings_admin_write" ON ai_settings
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- RPC: admin troca o provider ativo (validado)
CREATE OR REPLACE FUNCTION admin_set_ai_provider(p_provider TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;
  IF p_provider NOT IN ('pollinations', 'gemini', 'groq') THEN
    RAISE EXCEPTION 'Provider inválido: %', p_provider;
  END IF;

  INSERT INTO ai_settings (id, active_provider, updated_at)
  VALUES (1, p_provider, now())
  ON CONFLICT (id) DO UPDATE
    SET active_provider = EXCLUDED.active_provider, updated_at = now();

  RETURN jsonb_build_object('success', true, 'active_provider', p_provider);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_ai_provider(text) TO authenticated;
