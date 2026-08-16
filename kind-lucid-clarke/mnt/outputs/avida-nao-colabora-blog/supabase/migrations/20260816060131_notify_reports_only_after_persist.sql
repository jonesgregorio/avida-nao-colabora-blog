-- ============================================================================
-- Relatórios: avisar somente depois de persistir o conteúdo.
--
-- A migration 085 avisava quando o ciclo fechava, antes de existir uma linha em
-- `reports`. Esta regra passa a considerar apenas relatórios com status
-- `generated`, impedindo a promessa de um conteúdo que ainda não foi salvo.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_report_after_persist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text;
  v_title text;
  v_message text;
BEGIN
  IF NEW.status <> 'generated'
     OR NEW.report_type NOT IN ('weekly', 'monthly')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'generated') THEN
    RETURN NEW;
  END IF;

  v_type := CASE NEW.report_type
    WHEN 'weekly' THEN 'weekly_report'
    ELSE 'monthly_report'
  END;
  v_title := CASE NEW.report_type
    WHEN 'weekly' THEN 'Seu relatório semanal já está disponível.'
    ELSE 'Seu relatório mensal aprofundado está pronto.'
  END;
  v_message := CASE NEW.report_type
    WHEN 'weekly' THEN 'A síntese da sua última semana está pronta em Relatórios.'
    ELSE 'A leitura aprofundada do seu mês está pronta em Relatórios.'
  END;

  -- A chave é o próprio relatório salvo: uma atualização posterior não cria um
  -- segundo aviso e um relatório inexistente nunca pode ser notificado.
  INSERT INTO public.notifications (user_id, title, message, type, action_url, action_data)
  SELECT NEW.user_id,
         v_title,
         v_message,
         v_type,
         'my-report',
         jsonb_build_object(
           'report_id', NEW.id::text,
           'report_type', NEW.report_type,
           'period_end', NEW.period_end::text
         )
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = NEW.user_id
      AND n.type = v_type
      AND n.action_data->>'report_id' = NEW.id::text
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_report_after_persist() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reports_notify_after_persist ON public.reports;
CREATE TRIGGER reports_notify_after_persist
AFTER INSERT OR UPDATE OF status ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_report_after_persist();

-- Mantém os crons legados úteis apenas como backfill: eles só notificam linhas
-- já materializadas em `reports`, nunca apenas porque o calendário virou.
CREATE OR REPLACE FUNCTION public.notify_weekly_reports()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := (current_date - EXTRACT(dow FROM current_date)::int) - 7;
  v_end date := (current_date - EXTRACT(dow FROM current_date)::int) - 1;
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, action_url, action_data)
  SELECT r.user_id,
         'Seu relatório semanal já está disponível.',
         'A síntese da sua última semana está pronta em Relatórios.',
         'weekly_report',
         'my-report',
         jsonb_build_object('report_id', r.id::text, 'report_type', r.report_type, 'period_end', r.period_end::text)
  FROM public.reports r
  WHERE r.report_type = 'weekly'
    AND r.status = 'generated'
    AND r.period_start = v_start
    AND r.period_end = v_end
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.user_id
        AND n.type = 'weekly_report'
        AND n.action_data->>'report_id' = r.id::text
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
  v_start date := date_trunc('month', current_date - interval '1 month')::date;
  v_end date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_count integer := 0;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, action_url, action_data)
  SELECT r.user_id,
         'Seu relatório mensal aprofundado está pronto.',
         'A leitura aprofundada do seu mês está pronta em Relatórios.',
         'monthly_report',
         'my-report',
         jsonb_build_object('report_id', r.id::text, 'report_type', r.report_type, 'period_end', r.period_end::text)
  FROM public.reports r
  WHERE r.report_type = 'monthly'
    AND r.status = 'generated'
    AND r.period_start = v_start
    AND r.period_end = v_end
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.user_id
        AND n.type = 'monthly_report'
        AND n.action_data->>'report_id' = r.id::text
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_weekly_reports() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_monthly_reports() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_weekly_reports() TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_monthly_reports() TO service_role;

COMMENT ON FUNCTION public.notify_report_after_persist() IS
  'Cria o aviso de relatório somente após a linha gerada estar salva em public.reports.';
