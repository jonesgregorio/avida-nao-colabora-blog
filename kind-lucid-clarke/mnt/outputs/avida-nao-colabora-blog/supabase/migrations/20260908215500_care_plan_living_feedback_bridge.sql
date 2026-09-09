-- Ponte entre o plano vivo e o pipeline de IA já existente.
-- Mantém compatibilidade com care_plan_action_feedback, usado pelo gerador mensal.

CREATE OR REPLACE FUNCTION public.sync_living_care_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_index int;
  v_feedback text;
  v_owner uuid;
BEGIN
  SELECT p.user_id INTO v_owner
  FROM public.monthly_care_plans p
  WHERE p.id = COALESCE(NEW.care_plan_id, OLD.care_plan_id);

  IF v_owner IS NULL OR v_owner <> COALESCE(NEW.user_id, OLD.user_id) THEN
    RAISE EXCEPTION 'care plan ownership mismatch';
  END IF;

  v_index := NULLIF(regexp_replace(COALESCE(NEW.action_key, OLD.action_key), '^action-', ''), '')::int;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.care_plan_action_feedback
    WHERE user_id = OLD.user_id AND care_plan_id = OLD.care_plan_id AND action_index = v_index;
    RETURN OLD;
  END IF;

  IF NEW.outcome IS NULL THEN
    RETURN NEW;
  END IF;

  v_feedback := CASE NEW.outcome
    WHEN 'helped' THEN 'helpful'
    WHEN 'not_for_me' THEN 'not_for_me'
    ELSE 'later'
  END;

  INSERT INTO public.care_plan_action_feedback(user_id, care_plan_id, action_index, feedback)
  VALUES (NEW.user_id, NEW.care_plan_id, v_index, v_feedback)
  ON CONFLICT (care_plan_id, action_index)
  DO UPDATE SET feedback = EXCLUDED.feedback;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_living_care_feedback ON public.care_plan_action_state;
CREATE TRIGGER trg_sync_living_care_feedback
AFTER INSERT OR UPDATE OF outcome OR DELETE ON public.care_plan_action_state
FOR EACH ROW EXECUTE FUNCTION public.sync_living_care_feedback();

REVOKE ALL ON FUNCTION public.sync_living_care_feedback() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.sync_living_care_feedback() IS
  'Converte resultados do plano vivo para o feedback canônico consumido pela geração do próximo Plano de Autocuidado.';

NOTIFY pgrst, 'reload schema';