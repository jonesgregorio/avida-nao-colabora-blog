-- O formulário público deixa de inserir diretamente em support_tickets.
-- A Edge Function submit-contact-ticket aplica rate limit e, quando configurado,
-- valida o Turnstile antes de gravar usando service_role.
CREATE TABLE IF NOT EXISTS public.contact_ticket_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_ticket_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contact_ticket_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_contact_ticket_rate_limit(
  p_rate_key TEXT,
  p_max_attempts INTEGER DEFAULT 5,
  p_window INTERVAL DEFAULT interval '15 minutes'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resulting_attempts INTEGER;
BEGIN
  INSERT INTO public.contact_ticket_rate_limits AS limits (rate_key, window_started_at, attempts, updated_at)
  VALUES (p_rate_key, now(), 1, now())
  ON CONFLICT (rate_key) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= now() - p_window THEN now()
      ELSE limits.window_started_at
    END,
    attempts = CASE
      WHEN limits.window_started_at <= now() - p_window THEN 1
      ELSE limits.attempts + 1
    END,
    updated_at = now()
  RETURNING attempts INTO resulting_attempts;

  RETURN resulting_attempts <= p_max_attempts;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_contact_ticket_rate_limit(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_contact_ticket_rate_limit(TEXT, INTEGER, INTERVAL) TO service_role;

-- Nenhum visitante ou usuário autenticado cria tickets diretamente pelo Data API.
-- A função server-side preserva o contato anônimo e concentra as validações.
DROP POLICY IF EXISTS "public_insert_contact_ticket" ON public.support_tickets;
DROP POLICY IF EXISTS "users_insert_own_tickets" ON public.support_tickets;
