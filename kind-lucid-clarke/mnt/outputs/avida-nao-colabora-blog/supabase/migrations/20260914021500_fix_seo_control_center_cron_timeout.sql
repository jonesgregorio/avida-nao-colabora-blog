-- O sync completo do Search Console inspeciona URLs em série e normalmente leva
-- mais de 5 segundos. pg_net usa timeout_milliseconds=5000 por padrão; quando
-- esse limite estoura, a requisição é encerrada antes de a Edge Function concluir.
-- Recriamos o job com 120 segundos, acima do tempo observado nas execuções reais.

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
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/google-search-console',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select value from private.cron_config where key = 'automation_token')
        ),
        body := '{"action":"sync","source":"scheduled"}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
exception when others then
  raise notice 'Agendamento diário do SEO Control Center não recriado (%).', sqlerrm;
end;
$$;

-- Uma chamada interrompida pelo antigo timeout pode ter deixado execução marcada
-- como running. Só encerramos registros antigos o bastante para não tocar uma
-- sincronização legítima em andamento.
update public.seo_sync_runs
set status = 'failed',
    finished_at = now(),
    error = coalesce(nullif(error, ''), 'Execução interrompida antes da correção do timeout do agendamento.')
where status = 'running'
  and started_at < now() - interval '10 minutes';
