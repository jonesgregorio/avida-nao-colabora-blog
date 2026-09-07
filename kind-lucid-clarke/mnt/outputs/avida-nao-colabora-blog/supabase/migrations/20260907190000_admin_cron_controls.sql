-- Etapa 4 (Evolução do Admin) — Central de Automações: controle e histórico.
--
-- get_cron_automations_status() já lista todos os crons (status/agendamento/
-- última execução/erro). Aqui adicionamos:
--   - admin_set_cron_active: pausar/ativar um cron (cron.alter_job), auditável;
--   - admin_cron_run_history: as últimas N execuções + taxa de sucesso/falha.
-- Nenhuma execução manual de cron é exposta (o corpo do job carrega tokens e
-- reexecutar poderia duplicar envios); "rodar agora" continua por domínio
-- (regras editoriais, requeue de personalização da Etapa 3).
--
-- Não altera get_cron_automations_status() nem os agendamentos.

create or replace function public.admin_set_cron_active(
  p_jobname text,
  p_active  boolean
)
returns boolean
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_jobid bigint;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_jobname is null or btrim(p_jobname) = '' then
    raise exception 'jobname obrigatório';
  end if;

  select jobid into v_jobid from cron.job where jobname = p_jobname order by jobid desc limit 1;
  if v_jobid is null then
    raise exception 'cron % não encontrado', p_jobname;
  end if;

  perform cron.alter_job(v_jobid, active := p_active);
  return p_active;
end;
$$;

create or replace function public.admin_cron_run_history(
  p_jobname text,
  p_limit   integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_jobid bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 15), 1), 50);
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select jobid into v_jobid from cron.job where jobname = p_jobname order by jobid desc limit 1;
  if v_jobid is null then
    raise exception 'cron % não encontrado', p_jobname;
  end if;

  select jsonb_build_object(
    'jobname', p_jobname,
    'runs', coalesce((
      select jsonb_agg(r order by (r->>'started_at') desc) from (
        select jsonb_build_object(
          'status', drd.status,
          'started_at', drd.start_time,
          'duration_seconds', extract(epoch from (drd.end_time - drd.start_time))::numeric,
          'error', case when drd.status = 'failed' then drd.return_message else null end
        ) as r
        from cron.job_run_details drd
        where drd.jobid = v_jobid
        order by drd.start_time desc
        limit v_limit
      ) s
    ), '[]'::jsonb),
    'summary_30', (
      select jsonb_build_object(
        'total', count(*),
        'succeeded', count(*) filter (where status = 'succeeded'),
        'failed', count(*) filter (where status = 'failed'),
        'last_error', (
          select drd2.return_message from cron.job_run_details drd2
          where drd2.jobid = v_jobid and drd2.status = 'failed'
          order by drd2.start_time desc limit 1
        )
      )
      from (
        select status from cron.job_run_details
        where jobid = v_jobid order by start_time desc limit 30
      ) s30
    )
  )
  into result;

  return coalesce(result, '{}'::jsonb);
end;
$$;

revoke all on function public.admin_set_cron_active(text, boolean) from public, anon;
revoke all on function public.admin_cron_run_history(text, integer) from public, anon;
grant execute on function public.admin_set_cron_active(text, boolean) to authenticated;
grant execute on function public.admin_cron_run_history(text, integer) to authenticated;
