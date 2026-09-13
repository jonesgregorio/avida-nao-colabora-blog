-- SEO Control Center: histórico, inspeção, sitemap e alertas operacionais.
-- Tabelas são server-only: navegador não recebe acesso direto; Edge Function usa service_role.

create table if not exists public.seo_sync_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('manual','scheduled')),
  status text not null check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_written integer not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.seo_search_performance_daily (
  day date not null,
  dimension text not null check (dimension in ('total','query','page')),
  dimension_key text not null,
  clicks double precision not null default 0,
  impressions double precision not null default 0,
  ctr double precision not null default 0,
  position double precision not null default 0,
  synced_at timestamptz not null default now(),
  primary key (day, dimension, dimension_key)
);

create table if not exists public.seo_url_inspections (
  url text primary key,
  verdict text,
  coverage_state text,
  robots_txt_state text,
  indexing_state text,
  page_fetch_state text,
  google_canonical text,
  user_canonical text,
  crawled_as text,
  last_crawl_time timestamptz,
  referring_urls jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  last_inspected_at timestamptz not null default now()
);

create table if not exists public.seo_sitemaps (
  path text primary key,
  type text,
  is_pending boolean,
  is_sitemaps_index boolean,
  last_submitted timestamptz,
  last_downloaded timestamptz,
  warnings bigint not null default 0,
  errors bigint not null default 0,
  contents jsonb not null default '[]'::jsonb,
  last_checked_at timestamptz not null default now()
);

create table if not exists public.seo_alerts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  severity text not null check (severity in ('info','warning','critical')),
  title text not null,
  details text,
  url text,
  dedupe_key text not null unique,
  status text not null default 'open' check (status in ('open','resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists seo_perf_dimension_day_idx
  on public.seo_search_performance_daily (dimension, day desc);
create index if not exists seo_perf_key_day_idx
  on public.seo_search_performance_daily (dimension_key, day desc);
create index if not exists seo_inspections_checked_idx
  on public.seo_url_inspections (last_inspected_at asc);
create index if not exists seo_alerts_open_idx
  on public.seo_alerts (status, severity, last_seen_at desc);
create index if not exists seo_sync_runs_started_idx
  on public.seo_sync_runs (started_at desc);

alter table public.seo_sync_runs enable row level security;
alter table public.seo_search_performance_daily enable row level security;
alter table public.seo_url_inspections enable row level security;
alter table public.seo_sitemaps enable row level security;
alter table public.seo_alerts enable row level security;

revoke all on table public.seo_sync_runs from public, anon, authenticated;
revoke all on table public.seo_search_performance_daily from public, anon, authenticated;
revoke all on table public.seo_url_inspections from public, anon, authenticated;
revoke all on table public.seo_sitemaps from public, anon, authenticated;
revoke all on table public.seo_alerts from public, anon, authenticated;

grant all on table public.seo_sync_runs to service_role;
grant all on table public.seo_search_performance_daily to service_role;
grant all on table public.seo_url_inspections to service_role;
grant all on table public.seo_sitemaps to service_role;
grant all on table public.seo_alerts to service_role;

comment on table public.seo_search_performance_daily is 'Histórico diário do Google Search Console por total, consulta e página; acesso somente server-side.';
comment on table public.seo_url_inspections is 'Último estado conhecido da URL Inspection API para URLs públicas do AVNC.';
comment on table public.seo_alerts is 'Alertas operacionais de SEO derivados de indexação, canonical e sitemap.';

-- Sincronização diária: usa o mesmo token interno já utilizado pelas demais automações.
do $$
begin
  perform cron.unschedule('seo-control-center-daily');
exception when others then null;
end;
$$;

do $$
begin
  perform cron.schedule(
    'seo-control-center-daily',
    '35 6 * * *',
    $cron$
      select net.http_post(
        url := 'https://pdjzzkqrrffvxvpymcqn.supabase.co/functions/v1/google-search-console',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{"action":"sync","source":"scheduled"}'::jsonb
      );
    $cron$
  );
exception when others then
  raise notice 'Agendamento diário do SEO Control Center não criado (%).', sqlerrm;
end;
$$;
