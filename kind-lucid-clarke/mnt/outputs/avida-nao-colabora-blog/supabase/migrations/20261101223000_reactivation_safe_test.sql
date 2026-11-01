-- Dedicated one-recipient reactivation delivery test. Test template does not match production reactivation log prefix.
INSERT INTO public.email_templates (template_key,subject,preheader,body_text,body_html,category,is_active)
SELECT 'selfcare_reactivation_test','[TESTE] ' || subject,preheader,
  'Este é um teste autorizado de entrega da reativação do A Vida Não Colabora. Não é uma campanha automática.\n\n' || body_text,
  '',category,true
FROM public.email_templates WHERE template_key='value_reactivation_return'
ON CONFLICT (template_key) DO NOTHING;
CREATE OR REPLACE FUNCTION public.admin_reactivation_test_recipient()
RETURNS TABLE(user_id uuid,email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 RETURN QUERY SELECT u.id,u.email::text FROM auth.users u
 WHERE lower(u.email)='jonesgregory.jg@gmail.com' LIMIT 1;
END $$;
REVOKE ALL ON FUNCTION public.admin_reactivation_test_recipient() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivation_test_recipient() TO authenticated;
