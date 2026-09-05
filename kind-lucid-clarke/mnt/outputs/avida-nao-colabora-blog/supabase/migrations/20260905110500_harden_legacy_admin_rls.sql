-- Harden legacy administrator RLS policies.
--
-- public.is_admin() is the canonical authorization predicate and requires:
--   1) an authenticated user whose profile role is admin; and
--   2) an AAL2 JWT (MFA completed).
--
-- Older policies checked profiles.role directly. PostgreSQL permissive policies
-- are OR'ed together, so those legacy predicates could bypass the AAL2 guard
-- even when a newer policy on the same table used public.is_admin().

DROP POLICY IF EXISTS "admin_logs_admin" ON public.admin_logs;
CREATE POLICY "admin_logs_admin"
ON public.admin_logs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin le todos os eventos" ON public.analytics_events;
CREATE POLICY "Admin le todos os eventos"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "automated_admin" ON public.automated_contents;
CREATE POLICY "automated_admin"
ON public.automated_contents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_cats" ON public.categories;
CREATE POLICY "admin_all_cats"
ON public.categories
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "diary_config_admin" ON public.diary_config;
CREATE POLICY "diary_config_admin"
ON public.diary_config
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "professionals_admin" ON public.professionals;
CREATE POLICY "professionals_admin"
ON public.professionals
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "qa_admin" ON public.questionnaire_answers;
CREATE POLICY "qa_admin"
ON public.questionnaire_answers
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "qo_admin" ON public.questionnaire_options;
CREATE POLICY "qo_admin"
ON public.questionnaire_options
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "qq_admin" ON public.questionnaire_questions;
CREATE POLICY "qq_admin"
ON public.questionnaire_questions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "qr_admin" ON public.questionnaire_results;
CREATE POLICY "qr_admin"
ON public.questionnaire_results
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "questionnaires_admin" ON public.questionnaires;
CREATE POLICY "questionnaires_admin"
ON public.questionnaires
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin ve todos salvos" ON public.saved_items;
CREATE POLICY "Admin ve todos salvos"
ON public.saved_items
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "scheduled_admin" ON public.scheduled_contents;
CREATE POLICY "scheduled_admin"
ON public.scheduled_contents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "testimonials_admin" ON public.testimonials;
CREATE POLICY "testimonials_admin"
ON public.testimonials
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
