-- Feedback estruturado e reversível por microação do Plano de Autocuidado.
-- Não representa conclusão, progresso, streak, pontuação ou adesão clínica.
-- O usuário escolhe somente uma percepção sobre uma ação já enviada no próprio plano.

CREATE TABLE IF NOT EXISTS public.care_plan_action_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id uuid NOT NULL REFERENCES public.monthly_care_plans(id) ON DELETE CASCADE,
  action_index integer NOT NULL CHECK (action_index >= 0 AND action_index < 20),
  feedback text NOT NULL CHECK (feedback IN ('helpful', 'later', 'not_for_me')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_plan_action_feedback_unique_action UNIQUE (care_plan_id, action_index)
);

CREATE INDEX IF NOT EXISTS care_plan_action_feedback_user_plan_idx
  ON public.care_plan_action_feedback (user_id, care_plan_id);

DROP TRIGGER IF EXISTS care_plan_action_feedback_set_updated_at ON public.care_plan_action_feedback;
CREATE TRIGGER care_plan_action_feedback_set_updated_at
  BEFORE UPDATE ON public.care_plan_action_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.care_plan_action_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "care_plan_feedback_own_select" ON public.care_plan_action_feedback;
DROP POLICY IF EXISTS "care_plan_feedback_own_insert" ON public.care_plan_action_feedback;
DROP POLICY IF EXISTS "care_plan_feedback_own_update" ON public.care_plan_action_feedback;
DROP POLICY IF EXISTS "care_plan_feedback_own_delete" ON public.care_plan_action_feedback;
DROP POLICY IF EXISTS "care_plan_feedback_admin_all" ON public.care_plan_action_feedback;

-- Leitura e escrita só existem enquanto o próprio plano enviado continua elegível
-- para a pessoa. O dado é preservado no banco em downgrade e volta a aparecer se
-- o acesso Plus for retomado; nunca é convertido em progresso ou recompensa.
CREATE POLICY "care_plan_feedback_own_select"
  ON public.care_plan_action_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_care_plans p
      WHERE p.id = care_plan_id
        AND p.user_id = auth.uid()
        AND p.status = 'sent'
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.user_id = auth.uid()
              AND pr.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(pr.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "care_plan_feedback_own_insert"
  ON public.care_plan_action_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_care_plans p
      WHERE p.id = care_plan_id
        AND p.user_id = auth.uid()
        AND p.status = 'sent'
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.user_id = auth.uid()
              AND pr.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(pr.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "care_plan_feedback_own_update"
  ON public.care_plan_action_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_care_plans p
      WHERE p.id = care_plan_id
        AND p.user_id = auth.uid()
        AND p.status = 'sent'
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.user_id = auth.uid()
              AND pr.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(pr.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "care_plan_feedback_own_delete"
  ON public.care_plan_action_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "care_plan_feedback_admin_all"
  ON public.care_plan_action_feedback
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.care_plan_action_feedback FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_action_feedback TO authenticated;
GRANT ALL ON public.care_plan_action_feedback TO service_role;

COMMENT ON TABLE public.care_plan_action_feedback IS
  'Percepção estruturada e reversível do usuário sobre microações de um plano de autocuidado enviado; não representa conclusão ou gamificação.';
COMMENT ON COLUMN public.care_plan_action_feedback.feedback IS
  'helpful=fez sentido; later=talvez depois; not_for_me=não combinou comigo.';
