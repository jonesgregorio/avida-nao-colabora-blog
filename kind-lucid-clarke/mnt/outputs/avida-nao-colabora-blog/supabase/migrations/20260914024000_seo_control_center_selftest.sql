-- Autoteste diário e histórico do SEO Control Center.
create table if not exists public.seo_self_test_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('manual', 'scheduled')),
  status text not null check (status in ('passed', 'warning', 'failed')),
  passed integer not null default 0,
  total integer not null default 12,
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists seo_self_test_runs_created_at_idx
  on public.seo_self_test_runs (created_at desc);

alter table public.seo_self_test_runs enable row level security;
revoke all on table public.seo_self_test_runs from public, anon, authenticated;
grant all on table public.seo_self_test_runs to service_role;

-- Snapshot server-side usado pelo autoteste para conferir o cron e a sincronização.
create or replace function public.seo_self_test_runtime_snapshot()
returns jsonb
language sql
security definer
set search_path = public, cron
as $$
  select jsonb_build_object(
    'cron_active', coalesce((
      select active from cron.job where jobname = 'seo-control-center-daily' limit 1
    ), false),
    'cron_command', coalesce((
      select command from cron.job where jobname = 'seo-control-center-daily' limit 1
    ), ''),
    'latest_sync_status', coalesce((
      select status from public.seo_sync_runs order by started_at desc limit 1
    ), 'missing'),
    'latest_sync_started_at', (
      select started_at from public.seo_sync_runs order by started_at desc limit 1
    )
  );
$$;

revoke all on function public.seo_self_test_runtime_snapshot() from public, anon, authenticated;
grant execute on function public.seo_self_test_runtime_snapshot() to service_role;

-- O autoteste roda depois da sincronização diária para não concorrer com ela.
do $$
begin
  perform cron.unschedule('seo-control-center-self-test-daily');
exception when others then null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'seo-control-center-self-test-daily',
    '40 6 * * *',
    $cron$
      select net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/seo-control-selftest',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{"source":"scheduled"}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
exception when others then
  raise notice 'Autoteste diário de SEO não agendado (%).', sqlerrm;
end;
$$;
