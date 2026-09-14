-- Corrige o destino do cron do SEO Control Center para o projeto Supabase oficial do AVNC.
-- A migration original já pode ter sido aplicada; não a editamos para preservar a imutabilidade do histórico.

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
        body := '{"action":"sync","source":"scheduled"}'::jsonb
      );
    $cron$
  );
exception when others then
  raise notice 'Agendamento diário do SEO Control Center não recriado (%).', sqlerrm;
end;
$$;
