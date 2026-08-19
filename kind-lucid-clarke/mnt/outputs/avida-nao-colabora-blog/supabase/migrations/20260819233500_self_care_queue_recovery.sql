-- Go-live: recuperar a fila mensal de Plano de Autocuidado sem conflitar com
-- placeholders criados pelo Admin.
--
-- A Edge Function run-emotional-automations já grava error_message/generated_by,
-- porém ambientes atuais não tinham essas colunas em monthly_care_plans.
-- Além disso, o Admin cria placeholders pending_generation para exibir a fila;
-- qualquer linha existente fazia a automação considerar o mês já processado.

ALTER TABLE public.monthly_care_plans
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS generated_by text;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
    INTO v_job_id
    FROM cron.job
   WHERE jobname = 'run-emotional-automations'
   ORDER BY jobid DESC
   LIMIT 1;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Plano de autocuidado: cron run-emotional-automations não encontrado';
  END IF;

  PERFORM cron.alter_job(
    v_job_id,
    command := $cron$
      WITH cleared_empty_placeholders AS (
        DELETE FROM public.monthly_care_plans
         WHERE status = 'pending_generation'
           AND available_at <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
           AND generated_at IS NULL
           AND reviewed_at IS NULL
           AND sent_at IS NULL
           AND ai_summary IS NULL
           AND COALESCE(jsonb_object_length(ai_summary_json), 0) = 0
           AND COALESCE(jsonb_object_length(care_plan), 0) = 0
        RETURNING id
      )
      SELECT net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-emotional-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;

DO $$
DECLARE
  v_command text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='monthly_care_plans' AND column_name='error_message'
  ) THEN
    RAISE EXCEPTION 'Plano de autocuidado: error_message não foi criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema='public' AND table_name='monthly_care_plans' AND column_name='generated_by'
  ) THEN
    RAISE EXCEPTION 'Plano de autocuidado: generated_by não foi criada';
  END IF;

  SELECT command INTO v_command
    FROM cron.job
   WHERE jobname='run-emotional-automations'
   ORDER BY jobid DESC
   LIMIT 1;

  IF position('cleared_empty_placeholders' in coalesce(v_command,'')) = 0
     OR position('pending_generation' in coalesce(v_command,'')) = 0
     OR position('net.http_post' in coalesce(v_command,'')) = 0 THEN
    RAISE EXCEPTION 'Plano de autocuidado: cron não ficou com recuperação de placeholders';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
