-- Protege a leitura de artefatos emocionais pelo plano atual e impede que
-- usuários alterem uma resposta de orientação já revisada pelo Admin.
-- As Edge Functions usam service_role; administradores continuam cobertos pelas
-- políticas *_admin existentes.

DROP POLICY IF EXISTS "reports_own" ON public.reports;
DROP POLICY IF EXISTS "reports_own_eligible" ON public.reports;

CREATE POLICY "reports_own_eligible"
ON public.reports
FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid())
  AND status = 'generated'
  AND (available_at IS NULL OR available_at <= now())
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = (select auth.uid())
      AND (
        profiles.unlimited_access = true
        OR (
          profiles.subscription_status IN ('active', 'trialing')
          AND (
            (reports.report_type = 'weekly' AND profiles.plan IN ('essential', 'plus'))
            OR (reports.report_type = 'monthly' AND profiles.plan = 'plus')
          )
        )
      )
  )
);

DROP POLICY IF EXISTS "users_own_guidance" ON public.monthly_guidance_requests;
DROP POLICY IF EXISTS "guidance_own_eligible" ON public.monthly_guidance_requests;
DROP POLICY IF EXISTS "guidance_own_request" ON public.monthly_guidance_requests;

CREATE POLICY "guidance_own_eligible"
ON public.monthly_guidance_requests
FOR SELECT
TO authenticated
USING (
  user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = (select auth.uid())
      AND (
        profiles.unlimited_access = true
        OR (profiles.plan = 'plus' AND profiles.subscription_status IN ('active', 'trialing'))
      )
  )
);

CREATE POLICY "guidance_own_request"
ON public.monthly_guidance_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND status = 'open'
  AND response IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = (select auth.uid())
      AND (
        profiles.unlimited_access = true
        OR (profiles.plan = 'plus' AND profiles.subscription_status IN ('active', 'trialing'))
      )
  )
);
