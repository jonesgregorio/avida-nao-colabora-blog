-- Automação emocional: uma única fila server-side para relatórios e planos.
-- É deliberadamente separada de run-automations, que continua editorial.

-- A execução é protegida dentro da Edge Function e este cron só usa o token
-- privado já existente. A operação é idempotente por índices únicos existentes.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  PERFORM cron.unschedule('run-emotional-automations');
EXCEPTION WHEN OTHERS THEN
  -- A primeira instalação não tem job anterior, ou pg_cron pode não estar ativo.
  NULL;
END;
$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'run-emotional-automations',
    '20 3 * * *',
    $cron$
      select net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-emotional-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento emocional não criado (%).', SQLERRM;
END;
$$;

-- Garante que a tabela de logs continue privada para usuários comuns. O admin
-- mantém a política já existente e a função usa service_role no servidor.
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_generation_logs IS
  'Auditoria de gerações de IA, incluindo automação emocional, falhas e fallback.';

-- Defesa em profundidade: o navegador não pode liberar recursos pagos apenas
-- forjando um payload. As verificações também valem para ações administrativas.
CREATE OR REPLACE FUNCTION public.assert_emotional_resource_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  SELECT plan INTO v_plan FROM public.profiles WHERE user_id = NEW.user_id;
  v_plan := CASE v_plan
    WHEN 'therapeutic' THEN 'plus'
    WHEN 'therapeutic-plus' THEN 'plus'
    WHEN 'therapeutic_plus' THEN 'plus'
    ELSE COALESCE(v_plan, 'free')
  END;

  IF TG_TABLE_NAME = 'reports' THEN
    IF NEW.report_type = 'weekly' AND v_plan NOT IN ('essential', 'plus') THEN
      RAISE EXCEPTION 'weekly report requires essential or plus plan';
    ELSIF NEW.report_type = 'monthly' AND v_plan <> 'plus' THEN
      RAISE EXCEPTION 'monthly report requires plus plan';
    END IF;
  ELSIF TG_TABLE_NAME IN ('monthly_care_plans', 'monthly_guidance_requests') AND v_plan <> 'plus' THEN
    RAISE EXCEPTION '% requires plus plan', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_emotional_resource_plan() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assert_report_plan ON public.reports;
CREATE TRIGGER trg_assert_report_plan
  BEFORE INSERT OR UPDATE OF user_id, report_type ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.assert_emotional_resource_plan();

DROP TRIGGER IF EXISTS trg_assert_care_plan_plan ON public.monthly_care_plans;
CREATE TRIGGER trg_assert_care_plan_plan
  BEFORE INSERT OR UPDATE OF user_id ON public.monthly_care_plans
  FOR EACH ROW EXECUTE FUNCTION public.assert_emotional_resource_plan();

DROP TRIGGER IF EXISTS trg_assert_guidance_plan ON public.monthly_guidance_requests;
CREATE TRIGGER trg_assert_guidance_plan
  BEFORE INSERT OR UPDATE OF user_id ON public.monthly_guidance_requests
  FOR EACH ROW EXECUTE FUNCTION public.assert_emotional_resource_plan();
