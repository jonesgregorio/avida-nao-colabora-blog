-- Fechamento da prontidão do Plano de Autocuidado vivo.
-- Novos ciclos sem contexto suficiente NÃO recebem plano genérico.

CREATE OR REPLACE FUNCTION public.care_plan_readiness_from_records(p_records jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH v AS (
    SELECT
      COALESCE(NULLIF(p_records->>'total_entries','')::int, NULLIF(p_records->>'totalEntries','')::int, 0) AS total_entries,
      COALESCE(NULLIF(p_records->>'active_days','')::int, NULLIF(p_records->>'activeDays','')::int, 0) AS active_days
  )
  SELECT CASE WHEN total_entries >= 12 AND active_days >= 8 THEN
    jsonb_build_object(
      'reason_code','ready','title','Há contexto suficiente para um plano pessoal.',
      'explanation','Os registros deste ciclo têm continuidade suficiente para apoiar escolhas específicas sem preencher lacunas com suposições.',
      'next_steps','[]'::jsonb,'total_entries',total_entries,'active_days',active_days,'min_entries',12,'min_active_days',8
    )
  ELSE
    jsonb_build_object(
      'reason_code','insufficient_activity','title','Ainda estamos conhecendo o seu ritmo.',
      'explanation',format('Neste ciclo houve registros em %s dia(s) e %s registro(s) no total. Preferimos não criar um plano genérico só para preencher a tela: ele aparece quando consegue ser específico o bastante para ser útil.', active_days, total_entries),
      'next_steps',jsonb_build_array(
        'Faça check-ins quando eles ajudarem você a nomear como está.',
        'Use o Diário quando quiser acrescentar contexto a um dia importante.',
        'Não é preciso registrar todos os dias: continuidade e variedade ajudam mais do que quantidade.'
      ),
      'total_entries',total_entries,'active_days',active_days,'min_entries',12,'min_active_days',8
    ) END
  FROM v;
$$;

CREATE OR REPLACE FUNCTION public.enforce_care_plan_readiness()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ready jsonb;
BEGIN
  v_ready := public.care_plan_readiness_from_records(COALESCE(NEW.records_summary, '{}'::jsonb));
  NEW.readiness := v_ready;

  -- Preserva um plano histórico que já foi enviado e não está sendo reenviado.
  IF TG_OP = 'UPDATE' AND OLD.status = 'sent' AND NEW.status = 'sent' THEN
    RETURN NEW;
  END IF;

  IF v_ready->>'reason_code' = 'insufficient_activity' THEN
    NEW.status := 'skipped';
    -- Conteúdo não aprovado não deve ficar acessível pela policy de transparência.
    NEW.ai_summary := NULL;
    NEW.ai_summary_json := '{}'::jsonb;
    NEW.care_plan := '{}'::jsonb;
    NEW.recommended_content_ids := '{}';
    NEW.generated_by_ai := false;
    NEW.fallback_used := false;
    NEW.error_message := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_monthly_care_plan_readiness ON public.monthly_care_plans;
CREATE TRIGGER trg_monthly_care_plan_readiness
BEFORE INSERT OR UPDATE OF records_summary, status ON public.monthly_care_plans
FOR EACH ROW EXECUTE FUNCTION public.enforce_care_plan_readiness();

-- Preenche a explicação em linhas não enviadas já existentes e remove rascunhos genéricos insuficientes.
UPDATE public.monthly_care_plans
SET readiness = public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb)),
    status = CASE
      WHEN status <> 'sent' AND public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb))->>'reason_code'='insufficient_activity' THEN 'skipped'
      ELSE status END,
    ai_summary = CASE WHEN status <> 'sent' AND public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb))->>'reason_code'='insufficient_activity' THEN NULL ELSE ai_summary END,
    ai_summary_json = CASE WHEN status <> 'sent' AND public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb))->>'reason_code'='insufficient_activity' THEN '{}'::jsonb ELSE ai_summary_json END,
    care_plan = CASE WHEN status <> 'sent' AND public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb))->>'reason_code'='insufficient_activity' THEN '{}'::jsonb ELSE care_plan END,
    recommended_content_ids = CASE WHEN status <> 'sent' AND public.care_plan_readiness_from_records(COALESCE(records_summary,'{}'::jsonb))->>'reason_code'='insufficient_activity' THEN '{}'::uuid[] ELSE recommended_content_ids END;

CREATE OR REPLACE FUNCTION public.admin_care_plan_dashboard(p_month date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := COALESCE(p_month, date_trunc('month', CURRENT_DATE - interval '1 month')::date);
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT jsonb_build_object(
    'month_reference', v_month,
    'total', count(*),
    'ready', count(*) FILTER (WHERE readiness->>'reason_code'='ready'),
    'insufficient_activity', count(*) FILTER (WHERE readiness->>'reason_code'='insufficient_activity'),
    'pending_review', count(*) FILTER (WHERE status IN ('draft','pending_review')),
    'sent', count(*) FILTER (WHERE status='sent'),
    'failed', count(*) FILTER (WHERE status='failed')
  ) INTO v
  FROM public.monthly_care_plans
  WHERE month_reference=v_month;

  RETURN COALESCE(v,'{}'::jsonb) || jsonb_build_object(
    'actions', COALESCE((
      SELECT jsonb_build_object(
        'active', count(*) FILTER (WHERE s.state='active'),
        'paused', count(*) FILTER (WHERE s.state='paused'),
        'removed', count(*) FILTER (WHERE s.state='removed'),
        'helped', count(*) FILTER (WHERE s.outcome='helped'),
        'neutral', count(*) FILTER (WHERE s.outcome='neutral'),
        'could_not', count(*) FILTER (WHERE s.outcome='could_not'),
        'adapt_requests', count(*) FILTER (WHERE s.outcome='adapt'),
        'not_for_me', count(*) FILTER (WHERE s.outcome='not_for_me')
      )
      FROM public.care_plan_action_state s
      JOIN public.monthly_care_plans p ON p.id=s.care_plan_id
      WHERE p.month_reference=v_month
    ), '{}'::jsonb)
  );
END $$;

REVOKE ALL ON FUNCTION public.care_plan_readiness_from_records(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_care_plan_dashboard(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_care_plan_dashboard(date) TO authenticated;

COMMENT ON FUNCTION public.admin_care_plan_dashboard(date) IS
  'Painel agregado do Plano de Autocuidado vivo: prontidão, revisão/envio e retorno das escolhas do usuário, sem texto íntimo.';

NOTIFY pgrst, 'reload schema';