-- Feedback estruturado e reversível de uma Orientação Mensal já respondida.
-- Não cria thread, réplica, pontuação ou continuidade de atendimento.

CREATE TABLE IF NOT EXISTS public.monthly_guidance_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guidance_request_id uuid NOT NULL REFERENCES public.monthly_guidance_requests(id) ON DELETE CASCADE,
  feedback text NOT NULL CHECK (feedback IN ('helpful', 'partial', 'not_for_me')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_guidance_feedback_unique_request UNIQUE (guidance_request_id),
  CONSTRAINT monthly_guidance_feedback_tags_limit CHECK (cardinality(tags) <= 3),
  CONSTRAINT monthly_guidance_feedback_tags_allowed CHECK (
    tags <@ ARRAY[
      'clear',
      'practical',
      'organized_ideas',
      'felt_relevant',
      'too_generic',
      'not_applicable',
      'unclear',
      'missing_practical_steps'
    ]::text[]
  )
);

CREATE INDEX IF NOT EXISTS monthly_guidance_feedback_user_idx
  ON public.monthly_guidance_feedback (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS monthly_guidance_feedback_set_updated_at ON public.monthly_guidance_feedback;
CREATE TRIGGER monthly_guidance_feedback_set_updated_at
  BEFORE UPDATE ON public.monthly_guidance_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.monthly_guidance_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guidance_feedback_own_select" ON public.monthly_guidance_feedback;
DROP POLICY IF EXISTS "guidance_feedback_own_insert" ON public.monthly_guidance_feedback;
DROP POLICY IF EXISTS "guidance_feedback_own_update" ON public.monthly_guidance_feedback;
DROP POLICY IF EXISTS "guidance_feedback_own_delete" ON public.monthly_guidance_feedback;
DROP POLICY IF EXISTS "guidance_feedback_admin_all" ON public.monthly_guidance_feedback;

-- A pessoa só avalia uma orientação própria que já recebeu resposta final.
-- Mantém a mesma elegibilidade Plus da própria área de Orientação Mensal.
CREATE POLICY "guidance_feedback_own_select"
  ON public.monthly_guidance_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_guidance_requests g
      WHERE g.id = guidance_request_id
        AND g.user_id = auth.uid()
        AND g.status = 'answered'
        AND (
          NULLIF(btrim(COALESCE(g.response, '')), '') IS NOT NULL
          OR g.final_response_json IS NOT NULL
        )
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(p.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "guidance_feedback_own_insert"
  ON public.monthly_guidance_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_guidance_requests g
      WHERE g.id = guidance_request_id
        AND g.user_id = auth.uid()
        AND g.status = 'answered'
        AND (
          NULLIF(btrim(COALESCE(g.response, '')), '') IS NOT NULL
          OR g.final_response_json IS NOT NULL
        )
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(p.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "guidance_feedback_own_update"
  ON public.monthly_guidance_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.monthly_guidance_requests g
      WHERE g.id = guidance_request_id
        AND g.user_id = auth.uid()
        AND g.status = 'answered'
        AND (
          NULLIF(btrim(COALESCE(g.response, '')), '') IS NOT NULL
          OR g.final_response_json IS NOT NULL
        )
        AND (
          public.has_active_unlimited_access(auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid()
              AND p.subscription_status IN ('active', 'trialing')
              AND public.effective_plan_for_user(p.user_id) = 'plus'
          )
        )
    )
  );

CREATE POLICY "guidance_feedback_own_delete"
  ON public.monthly_guidance_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "guidance_feedback_admin_all"
  ON public.monthly_guidance_feedback
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Grants mínimos para Data API: usuários comuns só precisam de CRUD.
REVOKE ALL ON public.monthly_guidance_feedback FROM anon;
REVOKE ALL ON public.monthly_guidance_feedback FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_guidance_feedback TO authenticated;
GRANT ALL ON public.monthly_guidance_feedback TO service_role;

COMMENT ON TABLE public.monthly_guidance_feedback IS
  'Avaliação estruturada e reversível de uma Orientação Mensal respondida; não abre conversa nem representa pontuação.';
COMMENT ON COLUMN public.monthly_guidance_feedback.feedback IS
  'helpful=me ajudou; partial=em parte; not_for_me=não combinou comigo.';
