-- ============================================================================
-- 104 — E-mail de valor "resumo de evolução" + RPC de estatísticas de e-mail (§18)
-- ============================================================================

-- 1) Template: "seu resumo de evolução do mês está disponível" (Essencial+ ativo).
--    Assunto NEUTRO, sem dado emocional; o conteúdo real fica DENTRO do app (§19).
INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('value_evolution_summary',
   'Seu resumo de evolução do mês está disponível',
   'Veja seus padrões e destaques do mês no seu Mapa Emocional.',
   $b$Olá, {{nome}}.

Seu resumo de evolução do mês está disponível no seu Mapa Emocional. Ele reúne seus padrões, momentos de mais leveza e pontos de atenção, com base nos seus registros.

Dá pra ver com calma, no seu ritmo.

Ver meu Mapa Emocional:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um apoio ao seu autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject, preheader = EXCLUDED.preheader, body_text = EXCLUDED.body_text,
  category = EXCLUDED.category, is_active = true, updated_at = now();

-- 2) RPC de estatísticas de e-mail (Admin → Comunicação → E-mails → Resumo, §18).
--    Agrega TODOS os email_logs (não só os últimos 200 da tela): totais, por gatilho,
--    por plano e opt-outs. Admin-only.
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
        'sent',    count(*) FILTER (WHERE status = 'sent'),
        'failed',  count(*) FILTER (WHERE status = 'failed'),
        'pending', count(*) FILTER (WHERE status = 'pending'),
        'total',   count(*)
      ) FROM email_logs),
    'by_trigger', (SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'total')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'template_key', COALESCE(template_key, '—'),
          'sent',   count(*) FILTER (WHERE status = 'sent'),
          'failed', count(*) FILTER (WHERE status = 'failed'),
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
