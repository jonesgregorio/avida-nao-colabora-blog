-- Diário por intenção: check-in, registro principal e complemento.
-- Registros antigos sem diary_kind permanecem compatíveis e são lidos como main.

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS diary_kind TEXT;

ALTER TABLE public.diary_entries
  DROP CONSTRAINT IF EXISTS diary_entries_diary_kind_check;

ALTER TABLE public.diary_entries
  ADD CONSTRAINT diary_entries_diary_kind_check
  CHECK (diary_kind IS NULL OR diary_kind IN ('basic', 'main', 'addon', 'advanced'));

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
  -- Check-ins, questionários e avaliações nunca entram nas regras do diário.
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM public.profiles WHERE user_id = NEW.user_id;
  user_plan := COALESCE(user_plan, 'free');
  -- Mantém a versão anterior do front funcionando durante o deploy: ela ainda
  -- não envia diary_kind, então o Gratuito é interpretado como Registro Básico.
  new_kind := COALESCE(NEW.diary_kind, CASE WHEN user_plan = 'free' THEN 'basic' ELSE 'main' END);

  -- Gratuito só pode gravar o Registro Básico; planos pagos usam main/addon/advanced.
  IF user_plan = 'free' AND new_kind <> 'basic' THEN
    RAISE EXCEPTION 'No Gratuito, use o registro básico do dia.';
  END IF;
  IF user_plan IN ('essential', 'plus') AND new_kind = 'basic' THEN
    RAISE EXCEPTION 'O registro básico é exclusivo do plano Gratuito.';
  END IF;
  IF user_plan = 'essential' AND new_kind = 'advanced' THEN
    RAISE EXCEPTION 'O aprofundamento avançado está disponível no Plus.';
  END IF;

  -- Um registro principal por pessoa por dia. Addons e advanced permanecem livres.
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

  -- Os cinco registros mensais do Gratuito contam apenas registros básicos.
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

DROP TRIGGER IF EXISTS diary_entry_rules_trigger ON public.diary_entries;
CREATE TRIGGER diary_entry_rules_trigger
  BEFORE INSERT OR UPDATE ON public.diary_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diary_entry_rules();
