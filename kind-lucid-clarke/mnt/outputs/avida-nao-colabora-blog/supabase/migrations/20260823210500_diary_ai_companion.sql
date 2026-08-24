-- Diário v2: metadados opcionais da experiência de IA.
-- O texto original do diário continua em diary_entries.text e nunca é
-- substituído automaticamente por uma resposta de IA.

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS ai_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_title text,
  ADD COLUMN IF NOT EXISTS ai_reflection jsonb,
  ADD COLUMN IF NOT EXISTS ai_suggested_tags jsonb,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz;

ALTER TABLE public.diary_entries
  DROP CONSTRAINT IF EXISTS diary_entries_ai_title_length_check;
ALTER TABLE public.diary_entries
  ADD CONSTRAINT diary_entries_ai_title_length_check
  CHECK (ai_title IS NULL OR char_length(ai_title) <= 120);

COMMENT ON COLUMN public.diary_entries.ai_disabled IS 'Se true, o registro não deve ser enviado ao companheiro de IA do diário.';
COMMENT ON COLUMN public.diary_entries.ai_title IS 'Título privado curto sugerido pela IA; não substitui o texto original.';
COMMENT ON COLUMN public.diary_entries.ai_reflection IS 'Espelho não clínico gerado após salvar, quando autorizado pelo usuário.';
COMMENT ON COLUMN public.diary_entries.ai_suggested_tags IS 'Tags sugeridas pela IA; só entram nas colunas analíticas após confirmação explícita do usuário.';
COMMENT ON COLUMN public.diary_entries.ai_processed_at IS 'Momento em que a devolutiva opcional de IA foi concluída.';

-- A regra anterior tratava qualquer UPDATE como o único aprofundamento diário.
-- Isso faria duas operações técnicas do Diário v2 (persistir o espelho da IA e
-- confirmar tags sugeridas) consumirem a oportunidade de aprofundar. A partir
-- daqui, somente mudança em conteúdo reflexivo, métricas ou identidade do
-- registro conta como aprofundamento. Tags e metadados de IA podem ser
-- atualizados sem transformar um processamento automático em “edição do dia”.
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
  -- Check-ins, questionários e avaliações não entram nas regras do diário.
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  -- Mantém a regra canônica de entitlement, inclusive acesso ilimitado efetivo.
  user_plan := public.effective_plan_for_user(NEW.user_id);
  user_plan := COALESCE(user_plan, 'free');
  new_kind := COALESCE(NEW.diary_kind, CASE WHEN user_plan = 'free' THEN 'basic' ELSE 'main' END);

  IF TG_OP = 'INSERT' AND new_kind = 'addon' THEN
    RAISE EXCEPTION 'Complementos separados não estão mais disponíveis. Aprofunde o registro principal de hoje.';
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

  -- Continua existindo apenas um registro principal por pessoa/dia.
  IF new_kind IN ('basic', 'main') AND EXISTS (
    SELECT 1 FROM public.diary_entries d
    WHERE d.user_id = NEW.user_id
      AND d.date = NEW.date
      AND COALESCE(d.entry_type, 'diary') = 'diary'
      AND COALESCE(d.diary_kind, 'main') IN ('basic', 'main')
      AND d.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'Você já escreveu o diário principal de hoje. Aprofunde o registro existente ou faça um check-in rápido.';
  END IF;

  IF TG_OP = 'INSERT' AND new_kind IN ('basic', 'main') THEN
    NEW.deepened_at := NULL;
  ELSIF TG_OP = 'UPDATE' AND new_kind IN ('basic', 'main') THEN
    -- Campos estruturais, texto e indicadores representam uma alteração real
    -- do registro. Arrays de tags e colunas ai_* ficam fora de propósito:
    -- confirmação de classificação e processamento automático não devem gastar
    -- o único aprofundamento diário.
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
      IF OLD.deepened_at IS NOT NULL THEN
        RAISE EXCEPTION 'Você já aprofundou o registro de hoje. Um novo diário fica disponível amanhã.';
      END IF;
      NEW.deepened_at := now();
    ELSE
      NEW.deepened_at := OLD.deepened_at;
    END IF;
  END IF;

  -- Gratuito mantém o limite mensal somente para novos registros básicos.
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
