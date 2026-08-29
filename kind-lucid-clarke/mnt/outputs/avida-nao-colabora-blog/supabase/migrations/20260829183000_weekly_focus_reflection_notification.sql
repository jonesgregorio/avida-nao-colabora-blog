-- ============================================================================
-- Ideia 1 · Fase 14 — Notificações inteligentes
--
-- Fecha o ciclo do Foco da Semana com um único convite in-app, somente quando:
--   • um relatório semanal fechado fica disponível;
--   • o usuário havia escolhido um foco naquela semana; e
--   • o foco continua aberto (sem reflexão estruturada).
--
-- Reutiliza o tipo canônico `reminder` e diferencia este caso por action_data.
-- Não envia e-mail, não usa ausência/streak e não lê texto livre do Diário.
-- A notificação é um convite opcional; ela nunca fecha o foco automaticamente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_weekly_focus_reflection_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_focus public.user_weekly_focus%ROWTYPE;
  v_week_start date;
  v_dedupe_key text;
BEGIN
  IF NEW.report_type IS DISTINCT FROM 'weekly'
     OR NEW.status IS DISTINCT FROM 'generated'
     OR (TG_OP = 'UPDATE' AND OLD.status = 'generated') THEN
    RETURN NEW;
  END IF;

  -- O primeiro relatório premium pode começar no meio da semana por causa da
  -- ativação do plano. O Foco da Semana, porém, sempre usa domingo → sábado.
  -- Por isso derivamos o domingo pelo period_end (sábado), e não period_start.
  v_week_start := NEW.period_end::date - 6;

  SELECT focus.*
    INTO v_focus
    FROM public.user_weekly_focus AS focus
   WHERE focus.user_id = NEW.user_id
     AND focus.week_start = v_week_start
     AND focus.status = 'active'
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_dedupe_key := format(
    'weekly-focus-reflection:%s:%s',
    v_week_start::text,
    NEW.period_end::date::text
  );

  IF EXISTS (
    SELECT 1
      FROM public.notifications AS notification
     WHERE notification.user_id = NEW.user_id
       AND notification.type = 'reminder'
       AND COALESCE(notification.action_data, '{}'::jsonb) @> jsonb_build_object(
         'kind', 'weekly_focus_reflection',
         'key', v_dedupe_key
       )
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_url,
    destination_path,
    priority,
    action_data,
    is_read
  ) VALUES (
    NEW.user_id,
    'reminder',
    'Como foi carregar seu foco nesta semana?',
    format(
      'Se fizer sentido, conte se “%s” teve algum valor para você. É uma reflexão opcional, não uma avaliação.',
      v_focus.focus_title
    ),
    'home',
    'home',
    'low',
    jsonb_build_object(
      'kind', 'weekly_focus_reflection',
      'key', v_dedupe_key,
      'week_start', v_week_start,
      'week_end', NEW.period_end::date,
      'focus_id', v_focus.id
    ),
    false
  );

  -- Auditoria best-effort: uma eventual incompatibilidade histórica do log não
  -- pode impedir a criação da notificação principal.
  BEGIN
    INSERT INTO public.notification_delivery_logs (
      user_id,
      channel,
      status,
      destination_path
    ) VALUES (
      NEW.user_id,
      'in_app',
      'sent',
      'home'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_weekly_focus_reflection_notification ON public.reports;
CREATE TRIGGER trg_weekly_focus_reflection_notification
AFTER INSERT OR UPDATE OF status ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_weekly_focus_reflection_notification();

REVOKE ALL ON FUNCTION public.enqueue_weekly_focus_reflection_notification() FROM PUBLIC;

COMMENT ON FUNCTION public.enqueue_weekly_focus_reflection_notification() IS
  'Cria um único lembrete in-app para refletir sobre um Foco da Semana ainda aberto quando o relatório semanal correspondente fica disponível. Sem e-mail, ausência, gamificação ou texto livre.';
