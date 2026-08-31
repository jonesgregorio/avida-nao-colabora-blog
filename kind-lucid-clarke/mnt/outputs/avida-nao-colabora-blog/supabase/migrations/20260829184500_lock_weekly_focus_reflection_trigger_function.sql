-- ============================================================================
-- Ideia 1 · Fase 14 — hardening da função de trigger de notificações
--
-- O advisor do Supabase detectou que a função SECURITY DEFINER usada somente
-- pelo trigger de reports ainda aparecia executável via RPC pelos papéis de API.
-- Ela não é uma RPC pública: revogamos EXECUTE explicitamente de todos os papéis
-- expostos. O trigger continua chamando a função internamente normalmente.
-- ============================================================================

REVOKE ALL ON FUNCTION public.enqueue_weekly_focus_reflection_notification()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enqueue_weekly_focus_reflection_notification() IS
  'Função interna de trigger para o lembrete opcional do Foco da Semana. Sem EXECUTE para PUBLIC, anon ou authenticated; não é RPC de usuário.';
