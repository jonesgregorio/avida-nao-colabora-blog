-- Fase 15 hotfix: remover a heranca de EXECUTE via PUBLIC das RPCs de conta.
-- O Postgres concede EXECUTE em novas funcoes para PUBLIC por padrao; revogar apenas
-- de anon nao basta porque anon ainda herda o privilegio de PUBLIC.

REVOKE EXECUTE ON FUNCTION public.clear_must_change_password() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_personalized_content_as_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_personalized_content_as_read(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text, text) TO authenticated;
