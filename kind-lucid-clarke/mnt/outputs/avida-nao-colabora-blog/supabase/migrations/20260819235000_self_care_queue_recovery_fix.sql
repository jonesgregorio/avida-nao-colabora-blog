-- Go-live hotfix: torna a recuperação de placeholders compatível com o Postgres
-- live e limita a limpeza ao último mês fechado, que é o único ciclo que a
-- automação emocional sabe gerar automaticamente.

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
           AND month_reference = date_trunc(
                 'month',
                 (now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 month'
               )::date
           AND available_at <= (now() AT TIME ZONE 'America/Sao_Paulo')::date
           AND generated_at IS NULL
           AND reviewed_at IS NULL
           AND sent_at IS NULL
           AND ai_summary IS NULL
           AND COALESCE(ai_summary_json, '{}'::jsonb) = '{}'::jsonb
           AND COALESCE(care_plan, '{}'::jsonb) = '{}'::jsonb
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
  SELECT command INTO v_command
    FROM cron.job
   WHERE jobname='run-emotional-automations'
   ORDER BY jobid DESC
   LIMIT 1;

  IF position('month_reference = date_trunc' in coalesce(v_command,'')) = 0 THEN
    RAISE EXCEPTION 'Plano de autocuidado: limpeza não está limitada ao último mês fechado';
  END IF;

  IF position('jsonb_object_length' in coalesce(v_command,'')) <> 0 THEN
    RAISE EXCEPTION 'Plano de autocuidado: cron ainda usa função JSONB incompatível';
  END IF;

  IF position('COALESCE(ai_summary_json' in coalesce(v_command,'')) = 0
     OR position('COALESCE(care_plan' in coalesce(v_command,'')) = 0
     OR position('net.http_post' in coalesce(v_command,'')) = 0 THEN
    RAISE EXCEPTION 'Plano de autocuidado: comando de recuperação ficou incompleto';
  END IF;
END $$;
