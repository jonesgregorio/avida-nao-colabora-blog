-- Newsletter do rodapé ("Receba conteúdos que acolhem"): hoje o formulário só
-- mudava um estado local no navegador — nada era salvo, nenhum e-mail de
-- confirmação saía, e nada aparecia no Admin. Esta migration cria a base real
-- para o fluxo: inscrição, confirmação por e-mail, cancelamento em 1 clique e
-- visibilidade das inscrições/cancelamentos no Admin.
--
-- Escrita só por Edge Function (service_role, ignora RLS): newsletter-subscribe
-- grava a inscrição, unsubscribe grava o cancelamento. Nenhum visitante anônimo
-- ou usuário comum tem acesso direto de escrita à tabela pelo Data API.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                TEXT NOT NULL UNIQUE,
  status               TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  source               TEXT NOT NULL DEFAULT 'footer',
  subscribed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at      TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status ON public.newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at ON public.newsletter_subscribers(created_at DESC);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Só o Admin lê pelo Data API (client-side, com AAL2 — is_admin() já exige).
-- Toda escrita é feita pelas Edge Functions com service_role.
REVOKE ALL ON TABLE public.newsletter_subscribers FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.newsletter_subscribers TO authenticated;

DROP POLICY IF EXISTS "admin_select_newsletter_subscribers" ON public.newsletter_subscribers;
CREATE POLICY "admin_select_newsletter_subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (public.is_admin());

-- Rate limit da inscrição pública — mesmo padrão de contact_ticket_rate_limits
-- (20260822235231_contact_ticket_antispam.sql): protege o endpoint anônimo
-- newsletter-subscribe contra abuso, sem exigir login.
CREATE TABLE IF NOT EXISTS public.newsletter_rate_limits (
  rate_key           TEXT PRIMARY KEY,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts           INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.newsletter_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_newsletter_rate_limit(
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
  INSERT INTO public.newsletter_rate_limits AS limits (rate_key, window_started_at, attempts, updated_at)
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

REVOKE ALL ON FUNCTION public.consume_newsletter_rate_limit(TEXT, INTEGER, INTERVAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_newsletter_rate_limit(TEXT, INTEGER, INTERVAL) TO service_role;

-- Template do e-mail de confirmação de inscrição, no mesmo formato usado por
-- send-transactional-email (subject/body_text com {{variavel}}; body_html vazio
-- = a Edge Function monta o HTML de marca a partir do texto). Idempotente.
INSERT INTO public.email_templates (template_key, subject, preheader, body_text, category, is_active)
VALUES (
  'newsletter_confirmation',
  'Inscrição confirmada — A Vida Não Colabora',
  'Você vai receber nossos conteúdos sobre autocuidado direto no seu e-mail.',
  $b$Sua inscrição foi confirmada!

A partir de agora você recebe, de vez em quando, conteúdos sobre autocuidado, autoconhecimento e bem-estar emocional direto no seu e-mail.

Se mudar de ideia, você pode cancelar quando quiser através deste link:
{{link_cancelar}}$b$,
  'newsletter', true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_text = excluded.body_text,
  category = excluded.category,
  is_active = true,
  updated_at = now();
