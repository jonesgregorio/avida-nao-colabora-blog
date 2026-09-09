-- Plano de Autocuidado vivo: escolhas, acompanhamento e transparência de elegibilidade.
ALTER TABLE public.monthly_care_plans
  ADD COLUMN IF NOT EXISTS readiness jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.care_plan_action_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  care_plan_id uuid NOT NULL REFERENCES public.monthly_care_plans(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  action_text text NOT NULL,
  state text NOT NULL DEFAULT 'considering' CHECK (state IN ('active','considering','paused','removed')),
  outcome text CHECK (outcome IS NULL OR outcome IN ('helped','neutral','not_tried','could_not','adapt','not_for_me')),
  adapted_text text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (care_plan_id, action_key)
);

ALTER TABLE public.care_plan_action_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "care_plan_action_state_own" ON public.care_plan_action_state;
CREATE POLICY "care_plan_action_state_own" ON public.care_plan_action_state
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.monthly_care_plans p
      WHERE p.id = care_plan_id AND p.user_id = auth.uid() AND p.status = 'sent'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.monthly_care_plans p
      WHERE p.id = care_plan_id AND p.user_id = auth.uid() AND p.status = 'sent'
    )
  );
DROP POLICY IF EXISTS "care_plan_action_state_admin" ON public.care_plan_action_state;
CREATE POLICY "care_plan_action_state_admin" ON public.care_plan_action_state
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_care_plan_action_state_user_plan
  ON public.care_plan_action_state(user_id, care_plan_id);

-- Não ampliamos a policy da tabela monthly_care_plans: ela contém campos internos
-- (admin_notes, proveniência e erros técnicos). Para o estado sem plano, o usuário
-- recebe SOMENTE os campos seguros abaixo por RPC.
DROP POLICY IF EXISTS "mcp_own_readiness" ON public.monthly_care_plans;

CREATE OR REPLACE FUNCTION public.get_my_care_plan_readiness()
RETURNS TABLE (
  id uuid,
  month_reference date,
  period_start date,
  period_end date,
  status text,
  readiness jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.month_reference, p.period_start, p.period_end, p.status, p.readiness
  FROM public.monthly_care_plans p
  WHERE p.user_id = auth.uid()
    AND p.status = 'skipped'
    AND COALESCE(p.readiness->>'reason_code','') = 'insufficient_activity'
  ORDER BY p.month_reference DESC
  LIMIT 120;
$$;
REVOKE ALL ON FUNCTION public.get_my_care_plan_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_care_plan_readiness() TO authenticated;

COMMENT ON COLUMN public.monthly_care_plans.readiness IS
  'Explicação estruturada e não diagnóstica sobre suficiência de dados para o plano do ciclo.';
COMMENT ON TABLE public.care_plan_action_state IS
  'Estado vivo das ações escolhidas pelo usuário no Plano de Autocuidado; não é gamificação nem prontuário.';
COMMENT ON FUNCTION public.get_my_care_plan_readiness() IS
  'Retorna somente o motivo seguro de ciclos sem plano para o próprio usuário; não expõe campos internos de monthly_care_plans.';

NOTIFY pgrst, 'reload schema';