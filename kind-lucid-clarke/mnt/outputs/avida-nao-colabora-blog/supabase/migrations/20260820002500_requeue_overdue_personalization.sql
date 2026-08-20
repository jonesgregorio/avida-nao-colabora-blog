-- Go-live: tarefas de personalização vencidas precisam continuar elegíveis para
-- geração automática de RASCUNHO. O worker run-automations consome somente
-- status='pending'; portanto, antes da chamada HTTP, reencaminhamos tarefas
-- overdue ainda sem rascunho para pending. O due_at original permanece intacto
-- e nenhum conteúdo é enviado automaticamente.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
    INTO v_job_id
    FROM cron.job
   WHERE jobname='run-content-automations'
   ORDER BY jobid DESC
   LIMIT 1;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Personalização: cron run-content-automations não encontrado';
  END IF;

  PERFORM cron.alter_job(
    v_job_id,
    command := $cron$
      WITH requeued_overdue_personalization AS (
        UPDATE public.user_personalization_tasks
           SET status='pending',
               updated_at=now()
         WHERE status='overdue'
           AND delivery_id IS NULL
           AND generated_at IS NULL
        RETURNING id
      )
      SELECT net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-automations',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM private.cron_config WHERE key = 'automation_token' LIMIT 1)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END $$;

DO $$
DECLARE
  v_command text;
  v_schedule text;
  v_active boolean;
BEGIN
  SELECT command,schedule,active
    INTO v_command,v_schedule,v_active
    FROM cron.job
   WHERE jobname='run-content-automations'
   ORDER BY jobid DESC
   LIMIT 1;

  IF COALESCE(v_schedule,'') <> '0 * * * *' OR COALESCE(v_active,false) = false THEN
    RAISE EXCEPTION 'Personalização: cron perdeu schedule/estado ativo';
  END IF;

  IF position('requeued_overdue_personalization' in COALESCE(v_command,'')) = 0
     OR position('status=''overdue''' in COALESCE(v_command,'')) = 0
     OR position('delivery_id IS NULL' in COALESCE(v_command,'')) = 0
     OR position('generated_at IS NULL' in COALESCE(v_command,'')) = 0 THEN
    RAISE EXCEPTION 'Personalização: requeue de overdue ficou incompleto';
  END IF;

  IF position('net.http_post' in COALESCE(v_command,'')) = 0
     OR position('timeout_milliseconds := 120000' in COALESCE(v_command,'')) = 0 THEN
    RAISE EXCEPTION 'Personalização: chamada do worker/timeout não foi preservada';
  END IF;
END $$;
