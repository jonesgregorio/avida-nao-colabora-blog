-- Fecha uma brecha encontrada na auditoria de permissões por plano: o limite de "até 3
-- aprofundamentos por dia" já era garantido aqui (deepening_count), mas nada nesta função
-- confirmava que o PLANO de quem está aprofundando é Plus — só a tela (DiaryExperience.tsx)
-- fazia essa checagem. Um usuário Essencial, chamando a API diretamente (fora da tela),
-- conseguiria incrementar deepening_count no próprio registro 'main' sem ser Plus.
-- Repete a função inteira (idempotente) e adiciona só a checagem de plano que faltava.

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
  meaningful_update BOOLEAN := false;
BEGIN
  -- Check-in não é Diário. Ele tem sua própria regra: uma vez ao dia.
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  user_plan := public.effective_plan_for_user(NEW.user_id);
  user_plan := COALESCE(user_plan, 'free');
  new_kind := COALESCE(NEW.diary_kind, CASE WHEN user_plan = 'free' THEN 'basic' ELSE 'main' END);

  IF TG_OP = 'INSERT' AND new_kind = 'addon' THEN
    RAISE EXCEPTION 'Complementos separados não estão disponíveis. Aprofunde o registro principal de hoje.';
  END IF;

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
    RAISE EXCEPTION 'Você já escreveu o diário principal de hoje. Continue pelo registro existente.';
  END IF;

  IF TG_OP = 'INSERT' AND new_kind IN ('basic', 'main') THEN
    NEW.deepened_at := NULL;
    NEW.deepening_count := 0;
  ELSIF TG_OP = 'UPDATE' AND new_kind IN ('basic', 'main') THEN
    meaningful_update :=
      OLD.user_id IS DISTINCT FROM NEW.user_id OR
      OLD.date IS DISTINCT FROM NEW.date OR
      OLD.entry_type IS DISTINCT FROM NEW.entry_type OR
      OLD.diary_kind IS DISTINCT FROM NEW.diary_kind OR
      OLD.mood IS DISTINCT FROM NEW.mood OR
      OLD.mood_score IS DISTINCT FROM NEW.mood_score OR
      OLD.text IS DISTINCT FROM NEW.text OR
      OLD.energy IS DISTINCT FROM NEW.energy OR
      OLD.anxiety_level IS DISTINCT FROM NEW.anxiety_level OR
      OLD.stress_level IS DISTINCT FROM NEW.stress_level OR
      OLD.self_esteem IS DISTINCT FROM NEW.self_esteem OR
      OLD.irritability IS DISTINCT FROM NEW.irritability OR
      OLD.overload IS DISTINCT FROM NEW.overload OR
      OLD.sleep_quality IS DISTINCT FROM NEW.sleep_quality OR
      OLD.emotional_triggers IS DISTINCT FROM NEW.emotional_triggers OR
      OLD.recurring_thoughts IS DISTINCT FROM NEW.recurring_thoughts OR
      OLD.emotional_need IS DISTINCT FROM NEW.emotional_need OR
      OLD.relationships IS DISTINCT FROM NEW.relationships OR
      OLD.habits IS DISTINCT FROM NEW.habits OR
      OLD.gratitude IS DISTINCT FROM NEW.gratitude OR
      OLD.small_pride IS DISTINCT FROM NEW.small_pride OR
      OLD.free_note IS DISTINCT FROM NEW.free_note;

    IF meaningful_update THEN
      -- NOVO: aprofundamento (edição significativa do registro principal já salvo) é
      -- recurso exclusivo do Plus (README "Planos oficiais" → Plus → "Aprofundamentos do
      -- Diário"). Antes desta migration, só a tela confirmava isso; o banco só limitava a
      -- quantidade (até 3), sem confirmar o plano de quem estava aprofundando.
      IF user_plan <> 'plus' THEN
        RAISE EXCEPTION 'Aprofundar o registro do dia (editar depois de salvo) está disponível no plano Plus.';
      END IF;
      IF COALESCE(OLD.deepening_count, 0) >= 3 THEN
        RAISE EXCEPTION 'Você já usou os 3 aprofundamentos disponíveis para o diário de hoje.';
      END IF;
      NEW.deepening_count := COALESCE(OLD.deepening_count, 0) + 1;
      NEW.deepened_at := now();
    ELSE
      NEW.deepening_count := OLD.deepening_count;
      NEW.deepened_at := OLD.deepened_at;
    END IF;
  END IF;

  IF user_plan = 'free' AND new_kind = 'basic' AND TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO monthly_count
    FROM public.diary_entries d
    WHERE d.user_id = NEW.user_id
      AND COALESCE(d.entry_type, 'diary') = 'diary'
      AND COALESCE(d.diary_kind, 'main') IN ('basic', 'main')
      AND date_trunc('month', d.date::timestamp) = date_trunc('month', NEW.date::timestamp);
    IF monthly_count >= 5 THEN
      RAISE EXCEPTION 'Você atingiu o limite de 5 registros básicos deste mês.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
