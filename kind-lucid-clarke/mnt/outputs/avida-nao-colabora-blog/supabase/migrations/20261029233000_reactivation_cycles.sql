-- A new reactivation requires a new period of activity after the last successful contact.
-- Keep the 45-day cooldown and cap successful contacts at three per rolling year.
CREATE OR REPLACE FUNCTION public.get_reactivation_email_candidates()
RETURNS TABLE(user_id uuid,email text,full_name text,plan text,last_seen_at timestamptz,checkins_total integer,diaries_total integer,days_inactive integer,email_enabled boolean,receive_selfcare_reminders boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
    AND auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Somente serviço';
 END IF;
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
   coalesce(pref.email_enabled,false),coalesce(pref.receive_selfcare_reminders,false)
 FROM public.profiles p JOIN usage u ON u.user_id=p.user_id
 JOIN public.user_notification_preferences pref ON pref.user_id=p.user_id
 WHERE p.email IS NOT NULL AND p.email_notifications IS TRUE
   AND p.account_status='active' AND coalesce(p.role,'user') <> 'admin'
   AND pref.email_enabled IS TRUE AND pref.receive_selfcare_reminders IS TRUE
   AND u.last_activity < now()-interval '7 days'
   AND NOT EXISTS (
     SELECT 1 FROM public.email_logs l
     WHERE l.user_id=p.user_id AND l.template_key LIKE 'value_reactivation_%'
       AND l.status IN ('pending','sent','delivered')
       AND l.created_at > now()-interval '45 days'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.email_logs l
     WHERE l.user_id=p.user_id AND l.template_key LIKE 'value_reactivation_%'
       AND l.status IN ('pending','sent','delivered')
       AND l.created_at >= u.last_activity
   )
   AND (
     SELECT count(*) FROM public.email_logs l
     WHERE l.user_id=p.user_id AND l.template_key LIKE 'value_reactivation_%'
       AND l.status IN ('pending','sent','delivered')
       AND l.created_at >= now()-interval '365 days'
   ) < 3
 ORDER BY u.last_activity DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.get_reactivation_email_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_reactivation_email_candidates() TO service_role;
