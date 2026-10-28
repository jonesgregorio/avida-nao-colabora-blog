-- AVNC retention: cohorts and inactive candidate service RPC, no emotional content
CREATE OR REPLACE FUNCTION public.admin_retention_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 WITH base AS (
   SELECT p.user_id, p.created_at,
     COUNT(DISTINCT (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date) FILTER (WHERE e.event = 'page_view') AS tracked_days,
     COUNT(DISTINCT (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date) FILTER (WHERE e.event = 'page_view' AND e.created_at >= p.created_at + interval '1 day') AS later_days
   FROM public.profiles p LEFT JOIN public.analytics_events e ON e.user_id=p.user_id
   WHERE coalesce(p.role,'user') <> 'admin'
   GROUP BY p.user_id,p.created_at
 ), entries AS (
 SELECT d.user_id, count(*)::int AS records FROM public.diary_entries d GROUP BY d.user_id
 )
 SELECT jsonb_build_object(
   'registered',count(*),
   'activated',count(*) FILTER (WHERE coalesce(en.records,0)>0),
   'tracked_multi_day',count(*) FILTER (WHERE b.tracked_days>1),
   'tracked_one_day',count(*) FILTER (WHERE b.tracked_days=1),
   'tracking_missing',count(*) FILTER (WHERE b.tracked_days=0),
   'eligible_d7',count(*) FILTER (WHERE b.created_at <= now()-interval '7 days'),
   'retained_d7',count(*) FILTER (WHERE b.created_at <= now()-interval '7 days' AND EXISTS(SELECT 1 FROM public.analytics_events e WHERE e.user_id=b.user_id AND e.event='page_view' AND (e.created_at AT TIME ZONE 'America/Sao_Paulo')::date = (b.created_at AT TIME ZONE 'America/Sao_Paulo')::date + 7))
 ) INTO v FROM base b LEFT JOIN entries en ON en.user_id=b.user_id;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.admin_retention_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_retention_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_reactivation_email_candidates()
RETURNS TABLE(user_id uuid,email text,full_name text,plan text,last_seen_at timestamptz,checkins_total integer,diaries_total integer,days_inactive integer,email_enabled boolean,receive_selfcare_reminders boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'Somente serviço'; END IF;
 RETURN QUERY
 WITH usage AS (
   SELECT p.user_id,
     greatest(p.created_at,coalesce(p.last_seen_at,p.created_at),
       coalesce((SELECT max(e.created_at) FROM public.analytics_events e WHERE e.user_id=p.user_id AND e.event='page_view'),p.created_at),
       coalesce((SELECT max(d.created_at) FROM public.diary_entries d WHERE d.user_id=p.user_id),p.created_at)) AS last_activity,
     (SELECT count(*)::int FROM public.diary_entries d WHERE d.user_id=p.user_id AND d.entry_type='checkin') AS checkins,
     (SELECT count(*)::int FROM public.diary_entries d WHERE d.user_id=p.user_id AND d.entry_type='diary') AS diaries
   FROM public.profiles p
 )
 SELECT p.user_id,p.email,p.full_name,p.plan,u.last_activity,u.checkins,u.diaries,
   floor(extract(epoch from (now()-u.last_activity))/86400)::int,
   coalesce(pref.email_enabled,false),
   coalesce(pref.receive_selfcare_reminders,false)
 FROM public.profiles p JOIN usage u ON u.user_id=p.user_id
 LEFT JOIN public.user_notification_preferences pref ON pref.user_id=p.user_id
 WHERE p.email IS NOT NULL AND p.email_notifications IS TRUE
 AND p.account_status='active' AND coalesce(p.role,'user') <> 'admin'
 -- Reactivation strictly opt-in; legacy default true is insufficient
 AND pref.user_id IS NOT NULL AND pref.email_enabled IS TRUE AND pref.receive_selfcare_reminders IS TRUE
 AND u.last_activity < now()-interval '7 days'
 AND NOT EXISTS (
   SELECT 1 FROM public.email_logs l
   WHERE l.user_id=p.user_id AND l.template_key LIKE 'value_reactivation_%'
   AND l.status IN ('pending','sent','delivered') AND l.created_at>now()-interval '45 days'
 )
 ORDER BY u.last_activity DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.get_reactivation_email_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_reactivation_email_candidates() TO service_role;

INSERT INTO public.email_templates(template_key,subject,preheader,body_text,body_html,category,is_active)
VALUES ('value_reactivation_return','Seu espaço continua aqui','Um convite leve para voltar quando quiser',
$body$Olá, {{nome}}.

Seu espaço no A Vida Não Colabora continua disponível. Você não precisa recuperar os dias que passaram nem justificar sua ausência.

Se fizer sentido, um Check-in rápido pode ser um jeito simples de começar novamente.

Voltar ao meu espaço:
{{cta_link}}

Para ajustar os lembretes ou deixar de recebê-los:
{{link_preferencias}}

Com cuidado,
Equipe A Vida Não Colabora$body$,'','selfcare_reminder',true)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject,preheader=EXCLUDED.preheader,body_text=EXCLUDED.body_text,category=EXCLUDED.category,is_active=EXCLUDED.is_active,updated_at=now();