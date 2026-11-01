CREATE TABLE IF NOT EXISTS public.reactivation_control (id boolean PRIMARY KEY DEFAULT true CHECK(id), paused boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
INSERT INTO public.reactivation_control(id,paused) VALUES(true,true) ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.reactivation_control ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reactivation_control FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_reactivation_candidates()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 WITH activity AS (
  SELECT p.user_id,p.email,p.full_name,p.plan,
  greatest(p.created_at,coalesce(p.last_seen_at,p.created_at),
    coalesce((SELECT max(e.created_at) FROM public.analytics_events e WHERE e.user_id=p.user_id AND e.event='page_view'),p.created_at),
    coalesce((SELECT max(d.created_at) FROM public.diary_entries d WHERE d.user_id=p.user_id),p.created_at)) last_activity
  FROM public.profiles p
  JOIN public.user_notification_preferences pref ON pref.user_id=p.user_id
  WHERE p.email IS NOT NULL AND p.email_notifications IS TRUE AND p.account_status='active'
   AND coalesce(p.role,'user')<>'admin' AND pref.email_enabled IS TRUE AND pref.receive_selfcare_reminders IS TRUE
 ), eligible AS (
  SELECT a.*,(now()-a.last_activity) inactivity
  FROM activity a WHERE a.last_activity < now()-interval '7 days'
   AND NOT EXISTS (SELECT 1 FROM public.email_logs l WHERE l.user_id=a.user_id AND l.template_key LIKE 'value_reactivation_%'
    AND l.status IN ('pending','sent','delivered') AND l.created_at > now()-interval '45 days')
   AND NOT EXISTS (SELECT 1 FROM public.email_logs l WHERE l.user_id=a.user_id AND l.template_key LIKE 'value_reactivation_%'
    AND l.status IN ('pending','sent','delivered') AND l.created_at >= a.last_activity)
   AND (SELECT count(*) FROM public.email_logs l WHERE l.user_id=a.user_id AND l.template_key LIKE 'value_reactivation_%'
    AND l.status IN ('pending','sent','delivered') AND l.created_at >= now()-interval '365 days')<3
 )
 SELECT jsonb_build_object('total',count(*),'recent',coalesce((
  SELECT jsonb_agg(row_to_json(x)) FROM (
   SELECT user_id,email,full_name,plan,last_activity,
    floor(extract(epoch from inactivity)/86400)::int AS days_inactive
   FROM eligible ORDER BY last_activity DESC LIMIT 100
  ) x
 ),'[]'::jsonb)) INTO result FROM eligible;
 RETURN result;
END $function$
;
REVOKE ALL ON FUNCTION public.admin_reactivation_candidates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivation_candidates() TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_set_reactivation_paused(p_paused boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 UPDATE public.reactivation_control SET paused=p_paused,updated_at=now(),updated_by=auth.uid() WHERE id=true;
 RETURN public.reactivation_runtime_config();
END $function$
;
REVOKE ALL ON FUNCTION public.admin_set_reactivation_paused(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_reactivation_paused(boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.reactivation_runtime_config()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' AND auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 RETURN (SELECT jsonb_build_object('paused',paused,'updated_at',updated_at) FROM public.reactivation_control WHERE id=true);
END $function$
;
REVOKE ALL ON FUNCTION public.reactivation_runtime_config() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reactivation_runtime_config() TO authenticated,service_role;