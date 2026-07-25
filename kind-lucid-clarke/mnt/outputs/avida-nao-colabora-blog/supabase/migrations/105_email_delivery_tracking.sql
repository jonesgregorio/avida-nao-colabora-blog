-- ============================================================================
-- 105 — Rastreio de ENTREGA de e-mail (webhook do Resend)
-- ============================================================================
-- "sent" (status) = o Resend ACEITOU a chamada. Não é "entregue". O webhook do
-- Resend (Edge Function resend-webhook) passa a gravar aqui o que aconteceu de
-- verdade: entregue, aberto, clicado, rejeitado (bounce) ou reclamação (spam).
-- Assim o painel Admin → E-mails mostra o status REAL, não só "aceito".
-- ============================================================================

ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS opened_at    TIMESTAMPTZ;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS clicked_at   TIMESTAMPTZ;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS bounced_at   TIMESTAMPTZ;

-- Busca rápida por provider_message_id (o webhook casa por ele).
CREATE INDEX IF NOT EXISTS idx_email_logs_provider_msg ON email_logs (provider_message_id);

-- Estatísticas (§18) — agora incluem entregues/abertos/rejeitados.
CREATE OR REPLACE FUNCTION public.get_email_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  SELECT jsonb_build_object(
    'totals', (SELECT jsonb_build_object(
        'sent',      count(*) FILTER (WHERE status = 'sent'),
        'delivered', count(*) FILTER (WHERE delivered_at IS NOT NULL),
        'opened',    count(*) FILTER (WHERE opened_at IS NOT NULL),
        'bounced',   count(*) FILTER (WHERE status = 'bounced'),
        'failed',    count(*) FILTER (WHERE status = 'failed'),
        'pending',   count(*) FILTER (WHERE status = 'pending'),
        'total',     count(*)
      ) FROM email_logs),
    'by_trigger', (SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'template_key', COALESCE(template_key, '—'),
          'sent',   count(*) FILTER (WHERE status = 'sent'),
          'failed', count(*) FILTER (WHERE status IN ('failed', 'bounced')),
          'total',  count(*)
        ) AS r
        FROM email_logs GROUP BY template_key
      ) s),
    'by_plan', (SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'plan',  COALESCE(p.plan, '—'),
          'sent',  count(*) FILTER (WHERE e.status = 'sent'),
          'total', count(*)
        ) AS r
        FROM email_logs e LEFT JOIN profiles p ON p.user_id = e.user_id
        GROUP BY p.plan
      ) s),
    'opt_outs', (SELECT jsonb_build_object(
        'master_off',    count(*) FILTER (WHERE email_enabled = false),
        'selfcare_off',  count(*) FILTER (WHERE receive_selfcare_reminders = false),
        'report_off',    count(*) FILTER (WHERE receive_report_reminders = false),
        'care_plan_off', count(*) FILTER (WHERE receive_care_plan_reminders = false),
        'product_off',   count(*) FILTER (WHERE receive_product_updates = false)
      ) FROM user_notification_preferences)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_email_stats() TO authenticated;
