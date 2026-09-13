-- Auditoria consolidada 2026-09-13: segurança, performance e higiene operacional.
-- Escopo deliberadamente não altera Diário nem Jardim.

-- 1) Search path explícito em trigger helpers sinalizados pelo advisor.
DO $$
BEGIN
  IF to_regprocedure('public.admin_logs_block_mutation()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.admin_logs_block_mutation() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.touch_updated_at()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.touch_updated_at() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.current_month_start()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.current_month_start() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.normalize_admin_role()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.normalize_admin_role() SET search_path = public, pg_temp';
  END IF;
  IF to_regprocedure('public.set_entry_month()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.set_entry_month() SET search_path = public, pg_temp';
  END IF;
END $$;

-- 2) Helpers SECURITY DEFINER internos não ficam chamáveis por clientes.
-- As RPCs públicas de Admin continuam autenticadas e protegidas por is_admin/admin_can.
REVOKE ALL ON FUNCTION public.admin_communication_targets(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_communication_targets(text, text, uuid, uuid) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.admin_engagement_base()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_engagement_base() FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.admin_segment_match(jsonb)') IS NOT NULL THEN
    -- Esta função também é usada por RPCs SECURITY DEFINER do Admin; clientes não precisam chamá-la diretamente.
    EXECUTE 'REVOKE ALL ON FUNCTION public.admin_segment_match(jsonb) FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- 3) Remove índices comprovadamente duplicados pelo advisor sem remover constraints únicas canônicas.
DROP INDEX IF EXISTS public.idx_articles_plan_required;
DROP INDEX IF EXISTS public.idx_mgr_user_month;
DROP INDEX IF EXISTS public.monthly_guidance_requests_unique_month;
DROP INDEX IF EXISTS public.idx_saved_user;

-- 4) Índices para FKs/filas administrativas mais usadas. Não altera semântica de dados.
CREATE INDEX IF NOT EXISTS idx_admin_activity_acknowledged_by ON public.admin_activity_events(acknowledged_by);
CREATE INDEX IF NOT EXISTS idx_admin_communications_created_by ON public.admin_communications(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_communications_target_segment ON public.admin_communications(target_segment_id);
CREATE INDEX IF NOT EXISTS idx_admin_communications_target_user ON public.admin_communications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_admin ON public.ai_generation_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_content_generation_jobs_created_by ON public.content_generation_jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_monthly_care_plans_regenerated_by ON public.monthly_care_plans(regenerated_by);
CREATE INDEX IF NOT EXISTS idx_monthly_guidance_regenerated_by ON public.monthly_guidance_requests(regenerated_by);
CREATE INDEX IF NOT EXISTS idx_monthly_guidance_responded_by ON public.monthly_guidance_requests(responded_by);
CREATE INDEX IF NOT EXISTS idx_monthly_guidance_ticket ON public.monthly_guidance_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_related_ticket ON public.notifications(related_ticket_id);
CREATE INDEX IF NOT EXISTS idx_personalized_deliveries_created_by ON public.personalized_content_deliveries(created_by);
CREATE INDEX IF NOT EXISTS idx_personalized_deliveries_user ON public.personalized_content_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender ON public.ticket_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_personalization_tasks_created_by ON public.user_personalization_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_personalization_tasks_user_status ON public.user_personalization_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_personalization_tasks_queue ON public.user_personalization_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_plan_history_changed_by ON public.user_plan_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_plan_history_user ON public.user_plan_history(user_id);

-- 5) RLS: auth.uid() como initplan nas superfícies quentes, preservando exatamente o acesso existente.
DROP POLICY IF EXISTS "care_plan_action_state_own" ON public.care_plan_action_state;
CREATE POLICY "care_plan_action_state_own" ON public.care_plan_action_state
FOR ALL
USING (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.monthly_care_plans p
    WHERE p.id = care_plan_action_state.care_plan_id
      AND p.user_id = (SELECT auth.uid())
      AND p.status = 'sent'
  )
)
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND EXISTS (
    SELECT 1 FROM public.monthly_care_plans p
    WHERE p.id = care_plan_action_state.care_plan_id
      AND p.user_id = (SELECT auth.uid())
      AND p.status = 'sent'
  )
);

DROP POLICY IF EXISTS "guided_progress_own" ON public.guided_content_progress;
CREATE POLICY "guided_progress_own" ON public.guided_content_progress
FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "notifications_own_read" ON public.notifications;
CREATE POLICY "notifications_own_read" ON public.notifications
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "notifications_own_update" ON public.notifications;
CREATE POLICY "notifications_own_update" ON public.notifications
FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_view_own_tasks" ON public.user_personalization_tasks;
CREATE POLICY "users_view_own_tasks" ON public.user_personalization_tasks
FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_select_own_tickets" ON public.support_tickets;
CREATE POLICY "users_select_own_tickets" ON public.support_tickets
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users_select_own_ticket_messages" ON public.ticket_messages;
CREATE POLICY "users_select_own_ticket_messages" ON public.ticket_messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_messages.ticket_id
      AND st.user_id = (SELECT auth.uid())
  )
  AND NOT COALESCE(is_internal, false)
);

DROP POLICY IF EXISTS "users_insert_own_ticket_messages" ON public.ticket_messages;
CREATE POLICY "users_insert_own_ticket_messages" ON public.ticket_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND sender_role = 'user'
  AND NOT COALESCE(is_internal, false)
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_messages.ticket_id
      AND st.user_id = (SELECT auth.uid())
      AND st.status <> ALL (ARRAY['resolved'::text, 'closed'::text])
  )
);

-- 6) Remove apenas políticas Admin redundantes, mantendo uma política equivalente e mais completa.
DROP POLICY IF EXISTS "admin_all_notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_admin" ON public.notifications;
DROP POLICY IF EXISTS "admin_all_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "admin_all_messages" ON public.ticket_messages;

NOTIFY pgrst, 'reload schema';
