CREATE OR REPLACE FUNCTION public.admin_reactivation_operations()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 SELECT jsonb_build_object(
  'total',count(*),
  'sent',count(*) FILTER (WHERE status IN ('sent','delivered')),
  'delivered',count(*) FILTER (WHERE status='delivered' OR delivered_at IS NOT NULL),
  'failed',count(*) FILTER (WHERE status='failed'),
  'pending',count(*) FILTER (WHERE status='pending'),
  'last_sent_at',max(sent_at),
  'recent',coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
   SELECT created_at, status, template_key, sent_at, delivered_at,
          CASE WHEN status='failed' THEN left(coalesce(error_message,error,''),200) ELSE NULL END AS error
   FROM public.email_logs
   WHERE template_key LIKE 'value_reactivation_%'
   ORDER BY created_at DESC LIMIT 25
  ) x),'[]'::jsonb)
 ) INTO result FROM public.email_logs WHERE template_key LIKE 'value_reactivation_%';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_reactivation_operations() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivation_operations() TO authenticated;
