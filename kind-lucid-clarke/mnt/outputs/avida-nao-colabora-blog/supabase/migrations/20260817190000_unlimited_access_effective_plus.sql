-- ==========================================================================
-- Acesso ilimitado = entitlement Plus efetivo, sem alterar o plano comercial.
-- Também respeita unlimited_access_until: acesso expirado deixa de liberar
-- recursos premium automaticamente.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.has_active_unlimited_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT p.unlimited_access = true
       AND (p.unlimited_access_until IS NULL OR p.unlimited_access_until > now())
    FROM public.profiles p
    WHERE p.user_id = p_user_id
    LIMIT 1
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.effective_plan_for_user(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_active_unlimited_access(p_user_id) THEN 'plus'
    ELSE COALESCE((
      SELECT CASE p.plan
        WHEN 'therapeutic' THEN 'plus'
        WHEN 'therapeutic-plus' THEN 'plus'
        WHEN 'therapeutic_plus' THEN 'plus'
        ELSE COALESCE(p.plan, 'free')
      END
      FROM public.profiles p
      WHERE p.user_id = p_user_id
      LIMIT 1
    ), 'free')
  END;
$$;

REVOKE ALL ON FUNCTION public.has_active_unlimited_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.effective_plan_for_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_unlimited_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.effective_plan_for_user(uuid) TO authenticated, service_role;

-- Defesa em profundidade para geração de relatórios/plano/orientação.
CREATE OR REPLACE FUNCTION public.assert_emotional_resource_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
BEGIN
  v_plan := public.effective_plan_for_user(NEW.user_id);

  IF TG_TABLE_NAME = 'reports' THEN
    IF NEW.report_type = 'weekly' AND v_plan NOT IN ('essential', 'plus') THEN
      RAISE EXCEPTION 'weekly report requires essential or plus entitlement';
    ELSIF NEW.report_type = 'monthly' AND v_plan <> 'plus' THEN
      RAISE EXCEPTION 'monthly report requires plus entitlement';
    END IF;
  ELSIF TG_TABLE_NAME IN ('monthly_care_plans', 'monthly_guidance_requests') AND v_plan <> 'plus' THEN
    RAISE EXCEPTION '% requires plus entitlement', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_emotional_resource_plan() FROM PUBLIC, anon, authenticated;

-- Relatórios: usuário só lê artefatos disponíveis para seu entitlement atual.
DROP POLICY IF EXISTS "reports_own_eligible" ON public.reports;
CREATE POLICY "reports_own_eligible"
ON public.reports FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  AND status = 'generated'
  AND (available_at IS NULL OR available_at <= now())
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND (
          (reports.report_type = 'weekly' AND public.effective_plan_for_user(p.user_id) IN ('essential','plus'))
          OR (reports.report_type = 'monthly' AND public.effective_plan_for_user(p.user_id) = 'plus')
        )
    )
  )
);

-- Orientação mensal: Plus real OU acesso ilimitado ativo.
DROP POLICY IF EXISTS "guidance_own_eligible" ON public.monthly_guidance_requests;
CREATE POLICY "guidance_own_eligible"
ON public.monthly_guidance_requests FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND public.effective_plan_for_user(p.user_id) = 'plus'
    )
  )
);

DROP POLICY IF EXISTS "guidance_own_request" ON public.monthly_guidance_requests;
CREATE POLICY "guidance_own_request"
ON public.monthly_guidance_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = (select auth.uid())
  AND status = 'open'
  AND response IS NULL
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND public.effective_plan_for_user(p.user_id) = 'plus'
    )
  )
);

-- Plano de autocuidado: apenas plano enviado + entitlement Plus atual.
DROP POLICY IF EXISTS "mcp_own_sent" ON public.monthly_care_plans;
CREATE POLICY "mcp_own_sent" ON public.monthly_care_plans
FOR SELECT TO authenticated
USING (
  user_id = (select auth.uid())
  AND status = 'sent'
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND public.effective_plan_for_user(p.user_id) = 'plus'
    )
  )
);

-- Artigos premium: unlimited ativo libera Essencial + Plus, inclusive se o
-- plano comercial salvo for Gratuito.
DROP POLICY IF EXISTS "articles_essential" ON public.articles;
CREATE POLICY "articles_essential" ON public.articles
FOR SELECT TO authenticated
USING (
  plan_required = 'essential'
  AND (status = 'published' OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND public.effective_plan_for_user(p.user_id) IN ('essential','plus')
    )
  )
);

DROP POLICY IF EXISTS "articles_plus" ON public.articles;
CREATE POLICY "articles_plus" ON public.articles
FOR SELECT TO authenticated
USING (
  plan_required = 'plus'
  AND (status = 'published' OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
  AND (
    public.has_active_unlimited_access((select auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (select auth.uid())
        AND p.subscription_status IN ('active','trialing')
        AND public.effective_plan_for_user(p.user_id) = 'plus'
    )
  )
);

-- Questionários seguem o mesmo entitlement.
DROP POLICY IF EXISTS "q_read_essential" ON public.questionnaires;
CREATE POLICY "q_read_essential" ON public.questionnaires
FOR SELECT USING (
  (status = 'published' OR coalesce(active,false) = true)
  AND plan_required = 'essential'
  AND (is_admin() OR public.effective_plan_for_user((select auth.uid())) IN ('essential','plus'))
);

DROP POLICY IF EXISTS "q_read_plus" ON public.questionnaires;
CREATE POLICY "q_read_plus" ON public.questionnaires
FOR SELECT USING (
  (status = 'published' OR coalesce(active,false) = true)
  AND plan_required = 'plus'
  AND (is_admin() OR public.effective_plan_for_user((select auth.uid())) = 'plus')
);

COMMENT ON FUNCTION public.effective_plan_for_user(uuid) IS
  'Plano efetivo para autorização: acesso ilimitado ativo equivale a Plus sem alterar o plano comercial/cobrança.';

-- Automação editorial: regras antigas sem executor ficam pausadas para não
-- aparentarem funcionar. A UI também deixa de oferecer esses tipos.
UPDATE public.content_automations
SET status = 'paused',
    last_error = 'Automação pausada automaticamente: este tipo não possui executor server-side ativo.'
WHERE type IN ('update_old','publish_scheduled','notify_after_publish','email_after_publish','social_caption','review_low_perf')
  AND status = 'active';

-- Diário: o trigger de regras também deve usar o entitlement efetivo. Sem isso,
-- um usuário Gratuito com acesso ilimitado ativo continuaria limitado ao diário
-- básico apesar de o restante da aplicação tratá-lo como Plus.
CREATE OR REPLACE FUNCTION public.enforce_diary_entry_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  monthly_count INTEGER;
  new_kind TEXT;
BEGIN
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  user_plan := public.effective_plan_for_user(NEW.user_id);
  user_plan := COALESCE(user_plan, 'free');
  new_kind := COALESCE(NEW.diary_kind, CASE WHEN user_plan = 'free' THEN 'basic' ELSE 'main' END);

  IF user_plan = 'free' AND new_kind <> 'basic' THEN
    RAISE EXCEPTION 'No Gratuito, use o registro básico do dia.';
  END IF;
  IF user_plan IN ('essential', 'plus') AND new_kind = 'basic' THEN
    RAISE EXCEPTION 'O registro básico é exclusivo do plano Gratuito.';
  END IF;
  IF user_plan = 'essential' AND new_kind = 'advanced' THEN
    RAISE EXCEPTION 'O aprofundamento avançado está disponível no Plus.';
  END IF;

  IF new_kind IN ('basic', 'main') AND EXISTS (
    SELECT 1 FROM public.diary_entries d
    WHERE d.user_id = NEW.user_id
      AND d.date = NEW.date
      AND COALESCE(d.entry_type, 'diary') = 'diary'
      AND COALESCE(d.diary_kind, 'main') IN ('basic', 'main')
      AND d.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Você já escreveu o diário principal de hoje. Você pode editar o registro de hoje ou adicionar um complemento.';
  END IF;

  IF user_plan = 'free' AND new_kind = 'basic' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO monthly_count
    FROM public.diary_entries d
    WHERE d.user_id = NEW.user_id
      AND COALESCE(d.entry_type, 'diary') = 'diary'
      AND COALESCE(d.diary_kind, 'main') IN ('basic', 'main')
      AND date_trunc('month', d.date::timestamp) = date_trunc('month', NEW.date::timestamp);
    IF monthly_count >= 5 THEN
      RAISE EXCEPTION 'Você atingiu o limite de 5 registros básicos deste mês. Check-ins rápidos continuam liberados.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_diary_entry_rules() FROM PUBLIC, anon, authenticated;

-- Sincronização mensal: usuários com acesso ilimitado ativo participam como Plus,
-- mesmo que o plano comercial armazenado em profiles seja free/essential.
CREATE OR REPLACE FUNCTION public.sync_monthly_personalization()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period text := to_char(now(), 'YYYY-MM');
  v_count int := 0;
BEGIN
  INSERT INTO user_personalization_tasks
    (user_id, plan_key, task_key, task_title, task_description, content_type, target_area, period_key, status, due_at, expires_at)
  SELECT p.user_id,
         public.effective_plan_for_user(p.user_id),
         'monthly_summary',
         'Resumo mensal simples',
         'Resumo personalizado do mês com base nos registros da pessoa.',
         'monthly_summary',
         'reports',
         v_period,
         'pending',
         (date_trunc('month', now()) + interval '1 month' - interval '1 second')::timestamptz,
         (date_trunc('month', now()) + interval '1 month' + interval '10 days')::timestamptz
  FROM public.profiles p
  WHERE public.effective_plan_for_user(p.user_id) IN ('essential', 'plus')
    AND (
      public.has_active_unlimited_access(p.user_id)
      OR COALESCE(p.subscription_status, 'active') IN ('active', 'trialing')
    )
  ON CONFLICT (user_id, task_key, period_key) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_monthly_personalization() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_monthly_personalization() TO service_role;
