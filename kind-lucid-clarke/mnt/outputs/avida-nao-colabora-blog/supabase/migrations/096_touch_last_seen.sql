-- ============================================================================
-- 096 — Registrar último acesso (last_seen_at) para o motor de e-mails
-- ============================================================================
-- A coluna profiles.last_seen_at existe desde a 016, mas NINGUÉM escrevia nela.
-- O motor de lembretes (095) precisa dela para não enviar e-mail a quem acessou
-- o site recentemente, mesmo sem registrar check-in/diário.
--
-- RPC leve, SECURITY DEFINER: o app chama no boot (1x por sessão). Só toca a
-- PRÓPRIA linha (auth.uid()), e só quando passou > 1h desde o último toque —
-- evita escrita a cada navegação. Não retorna nada sensível.
-- ============================================================================

CREATE OR REPLACE FUNCTION touch_last_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN; -- sem sessão: nada a fazer
  END IF;
  UPDATE profiles
     SET last_seen_at = now()
   WHERE user_id = auth.uid()
     AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '1 hour');
END;
$$;

GRANT EXECUTE ON FUNCTION touch_last_seen() TO authenticated;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles(last_seen_at);
