-- P0 Permissões: fecha bypasses de questionários e artefatos exclusivos do Plus.
-- Mantém o catálogo comercial visível sem expor perguntas/resultados premium.

CREATE OR REPLACE FUNCTION public.current_user_has_plan(required_plan text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_required text := CASE
    WHEN required_plan IN ('therapeutic','therapeutic-plus','therapeutic_plus') THEN 'plus'
    WHEN required_plan = 'essential' THEN 'essential'
    ELSE 'free'
  END;
  v_plan text;
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_required = 'free' THEN RETURN true; END IF;
  IF public.has_active_unlimited_access(v_uid) THEN RETURN true; END IF;

  SELECT public.effective_plan_for_user(p.user_id)
    INTO v_plan
    FROM public.profiles p
   WHERE p.user_id = v_uid
     AND p.subscription_status IN ('active','trialing')
   LIMIT 1;

  IF v_required = 'essential' THEN RETURN v_plan IN ('essential','plus'); END IF;
  RETURN v_plan = 'plus';
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_questionnaire(p_questionnaire_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_scheduled_at timestamptz;
BEGIN
  IF public.is_admin() THEN RETURN true; END IF;
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT q.plan_required, q.status, q.scheduled_at
    INTO v_plan, v_status, v_scheduled_at
    FROM public.questionnaires q
   WHERE q.id = p_questionnaire_id
   LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;
  IF NOT (
    v_status = 'published'
    OR (v_status = 'scheduled' AND v_scheduled_at IS NOT NULL AND v_scheduled_at <= now())
  ) THEN RETURN false; END IF;

  RETURN public.current_user_has_plan(v_plan);
END;
$$;

-- Catálogo público SEGURO: somente metadados dos cards. Não retorna questions/results.
CREATE OR REPLACE FUNCTION public.get_questionnaire_catalog()
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  description text,
  short_description text,
  category text,
  plan_required text,
  estimated_time text,
  status text,
  show_on_questionnaires_page boolean,
  scheduled_at timestamptz,
  question_count integer,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    q.id, q.title, q.slug, q.description, q.short_description, q.category,
    q.plan_required, q.estimated_time, q.status, q.show_on_questionnaires_page,
    q.scheduled_at,
    COALESCE(q.question_count, jsonb_array_length(COALESCE(q.questions, '[]'::jsonb))) AS question_count,
    q.created_at
  FROM public.questionnaires q
  WHERE q.show_on_questionnaires_page = true
    AND (
      q.status = 'published'
      OR (q.status = 'scheduled' AND q.scheduled_at IS NOT NULL AND q.scheduled_at <= now())
    )
  ORDER BY q.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_questionnaire_catalog() FROM public;
GRANT EXECUTE ON FUNCTION public.get_questionnaire_catalog() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_questionnaire(uuid) TO authenticated;

-- Questionário completo: só conta autenticada com plano atual adequado.
DROP POLICY IF EXISTS "questionnaires_read" ON public.questionnaires;
DROP POLICY IF EXISTS "q_read_free" ON public.questionnaires;
DROP POLICY IF EXISTS "q_read_essential" ON public.questionnaires;
DROP POLICY IF EXISTS "q_read_plus" ON public.questionnaires;
DROP POLICY IF EXISTS "questionnaires_user_access" ON public.questionnaires;
CREATE POLICY "questionnaires_user_access" ON public.questionnaires
FOR SELECT TO authenticated
USING (public.can_access_questionnaire(id));

-- Tabelas-filhas legadas seguem exatamente a autorização do questionário pai.
DROP POLICY IF EXISTS "qq_read" ON public.questionnaire_questions;
DROP POLICY IF EXISTS "questionnaire_questions_user_access" ON public.questionnaire_questions;
CREATE POLICY "questionnaire_questions_user_access" ON public.questionnaire_questions
FOR SELECT TO authenticated
USING (public.can_access_questionnaire(questionnaire_id));

DROP POLICY IF EXISTS "qo_read" ON public.questionnaire_options;
DROP POLICY IF EXISTS "questionnaire_options_user_access" ON public.questionnaire_options;
CREATE POLICY "questionnaire_options_user_access" ON public.questionnaire_options
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.questionnaire_questions qq
     WHERE qq.id = questionnaire_options.question_id
       AND public.can_access_questionnaire(qq.questionnaire_id)
  )
);

DROP POLICY IF EXISTS "qr_read" ON public.questionnaire_results;
DROP POLICY IF EXISTS "questionnaire_results_user_access" ON public.questionnaire_results;
CREATE POLICY "questionnaire_results_user_access" ON public.questionnaire_results
FOR SELECT TO authenticated
USING (public.can_access_questionnaire(questionnaire_id));

-- Respostas: o histórico próprio continua visível, mas criar/continuar exige
-- autorização atual para o questionário. Impede usar Plus/Essencial via API.
DROP POLICY IF EXISTS "Users see own responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "auth_users_insert_own_responses" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "qr_insert" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "qr_user" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "qr_admin" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "admin_insert_any_response" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses_user_select" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses_user_insert" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses_user_update" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses_user_delete" ON public.questionnaire_responses;
DROP POLICY IF EXISTS "questionnaire_responses_admin_all" ON public.questionnaire_responses;

CREATE POLICY "questionnaire_responses_user_select" ON public.questionnaire_responses
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "questionnaire_responses_user_insert" ON public.questionnaire_responses
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND questionnaire_id IS NOT NULL
  AND public.can_access_questionnaire(questionnaire_id)
);

CREATE POLICY "questionnaire_responses_user_update" ON public.questionnaire_responses
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND questionnaire_id IS NOT NULL
  AND public.can_access_questionnaire(questionnaire_id)
)
WITH CHECK (
  user_id = auth.uid()
  AND questionnaire_id IS NOT NULL
  AND public.can_access_questionnaire(questionnaire_id)
);

CREATE POLICY "questionnaire_responses_user_delete" ON public.questionnaire_responses
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "questionnaire_responses_admin_all" ON public.questionnaire_responses
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Artefatos exclusivos do Plus que ainda tinham RLS legado somente por user_id.
DROP POLICY IF EXISTS "prof_comments_user" ON public.professional_comments;
DROP POLICY IF EXISTS "professional_comments_plus_user" ON public.professional_comments;
CREATE POLICY "professional_comments_plus_user" ON public.professional_comments
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.current_user_has_plan('plus'));

DROP POLICY IF EXISTS "scpr_user" ON public.self_care_plan_reviews;
DROP POLICY IF EXISTS "users_view_own_reviews" ON public.self_care_plan_reviews;
DROP POLICY IF EXISTS "self_care_reviews_plus_user" ON public.self_care_plan_reviews;
CREATE POLICY "self_care_reviews_plus_user" ON public.self_care_plan_reviews
FOR SELECT TO authenticated
USING (user_id = auth.uid() AND public.current_user_has_plan('plus'));

-- Guardas: falha se alguma política ampla que causou o bypass permanecer ativa.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public' AND tablename='questionnaires' AND policyname='questionnaires_read';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'P0 permissões: questionnaires_read legado ainda existe';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public'
     AND tablename IN ('questionnaire_questions','questionnaire_options','questionnaire_results')
     AND policyname IN ('qq_read','qo_read','qr_read');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'P0 permissões: leitura pública das tabelas-filhas ainda existe';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public' AND tablename='questionnaire_responses'
     AND policyname IN ('questionnaire_responses_user_insert','questionnaire_responses_user_update');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'P0 permissões: políticas de escrita de respostas incompletas';
  END IF;
END $$;
