-- P3: permite persistir pares consulta+página do Search Console para detectar sobreposição real.
alter table public.seo_search_performance_daily
  drop constraint if exists seo_search_performance_daily_dimension_check;

alter table public.seo_search_performance_daily
  add constraint seo_search_performance_daily_dimension_check
  check (dimension in ('total','query','page','query_page'));
