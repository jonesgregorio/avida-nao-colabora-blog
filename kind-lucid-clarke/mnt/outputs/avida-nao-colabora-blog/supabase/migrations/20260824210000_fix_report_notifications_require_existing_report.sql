-- notify_weekly_reports()/notify_monthly_reports() (migration 085) notificavam
-- o usuário assumindo que run-emotional-automations já tinha gerado o
-- relatório do período, sem checar de verdade -- dependiam só da ordem dos
-- crons coincidir (geração roda diariamente antes da notificação semanal/
-- mensal). Se a geração falhar pra um usuário específico (erro de rede, erro
-- ao salvar), a notificação ainda sairia, apontando para um relatório que não
-- existe. Corrige exigindo EXISTS na tabela reports antes de notificar.

CREATE OR REPLACE FUNCTION public.notify_weekly_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := (current_date - EXTRACT(dow FROM current_date)::int) - 7; -- domingo da semana anterior
  v_end   DATE := (current_date - EXTRACT(dow FROM current_date)::int) - 1; -- sábado da semana anterior
  v_count int := 0;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, action_url, action_data)
  SELECT p.user_id,
         'Seu relatório semanal já está disponível',
         'A síntese da sua última semana está pronta em Relatórios.',
         'weekly_report', 'my-report',
         jsonb_build_object('report_type', 'weekly', 'period_end', v_end::text)
  FROM profiles p
  WHERE p.plan IN ('essential', 'plus', 'therapeutic', 'therapeutic-plus')
    AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    AND EXISTS (
      SELECT 1 FROM diary_entries d
      WHERE d.user_id = p.user_id
        AND d.created_at >= v_start::timestamptz
        AND d.created_at <  (v_end + 1)::timestamptz
    )
    -- O relatório precisa existir de verdade antes de avisar o usuário.
    AND EXISTS (
      SELECT 1 FROM reports r
      WHERE r.user_id = p.user_id
        AND r.report_type = 'weekly'
        AND r.period_start = v_start
        AND r.period_end = v_end
        AND r.status = 'generated'
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.user_id
        AND n.type = 'weekly_report'
        AND n.action_data->>'period_end' = v_end::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_monthly_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := date_trunc('month', current_date - interval '1 month')::date; -- 1º do mês anterior
  v_end   DATE := (date_trunc('month', current_date) - interval '1 day')::date; -- último dia do mês anterior
  v_count int := 0;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, action_url, action_data)
  SELECT p.user_id,
         'Seu relatório mensal aprofundado já está disponível',
         'A leitura aprofundada do seu mês está pronta em Relatórios.',
         'monthly_report', 'my-report',
         jsonb_build_object('report_type', 'monthly', 'period_end', v_end::text)
  FROM profiles p
  WHERE p.plan IN ('plus', 'therapeutic', 'therapeutic-plus')
    AND COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    AND EXISTS (
      SELECT 1 FROM diary_entries d
      WHERE d.user_id = p.user_id
        AND d.created_at >= v_start::timestamptz
        AND d.created_at <  (v_end + 1)::timestamptz
    )
    -- O relatório precisa existir de verdade antes de avisar o usuário.
    AND EXISTS (
      SELECT 1 FROM reports r
      WHERE r.user_id = p.user_id
        AND r.report_type = 'monthly'
        AND r.period_start = v_start
        AND r.period_end = v_end
        AND r.status = 'generated'
    )
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = p.user_id
        AND n.type = 'monthly_report'
        AND n.action_data IS NOT NULL
        AND n.action_data->>'period_end' = v_end::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_weekly_reports()  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_monthly_reports() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_weekly_reports()  TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_monthly_reports() TO service_role;
