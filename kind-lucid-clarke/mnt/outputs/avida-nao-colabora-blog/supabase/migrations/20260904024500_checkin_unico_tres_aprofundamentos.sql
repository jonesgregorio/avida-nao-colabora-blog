-- Check-in e Diário são experiências distintas.
-- 1) Check-in: no máximo um por usuário/dia, independentemente da tela de origem.
-- 2) Diário: continua com um registro principal por dia.
-- 3) O mesmo diário principal pode ser aprofundado até três vezes no dia.

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS deepening_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.diary_entries
  DROP CONSTRAINT IF EXISTS diary_entries_deepening_count_check;
ALTER TABLE public.diary_entries
  ADD CONSTRAINT diary_entries_deepening_count_check
  CHECK (deepening_count BETWEEN 0 AND 3);

COMMENT ON COLUMN public.diary_entries.deepening_count IS
  'Quantidade de aprofundamentos voluntários feitos no registro principal do diário naquele dia. Máximo: 3.';

-- Remove duplicidades históricas de check-in antes de criar a proteção canônica.
-- Preserva o registro mais antigo do dia, preferindo o sincronizado pela Página Inicial quando existir.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, date
           ORDER BY CASE WHEN COALESCE(markers, ARRAY[]::text[]) @> ARRAY['home_checkin']::text[] THEN 0 ELSE 1 END,
                    created_at ASC,
                    id ASC
         ) AS rn
  FROM public.diary_entries
  WHERE COALESCE(entry_type, 'diary') = 'checkin'
)
DELETE FROM public.diary_entries d
USING ranked r
WHERE d.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS diary_entries_one_checkin_per_user_day_idx
  ON public.diary_entries (user_id, date)
  WHERE entry_type = 'checkin';

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
