-- Simplifica o diário para um único registro principal por dia + um único aprofundamento.
-- Registros históricos do tipo addon/advanced continuam legíveis, mas novos addons
-- deixam de ser aceitos. A regra é aplicada no banco para não depender só da UI.

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS deepened_at TIMESTAMPTZ;

COMMENT ON COLUMN public.diary_entries.deepened_at IS
  'Momento da única edição/aprofundamento permitida no registro principal do dia.';

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
  -- Check-ins, questionários e avaliações não entram nas regras do diário.
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  -- Mantém a regra canônica de entitlement, inclusive acesso ilimitado efetivo.
  user_plan := public.effective_plan_for_user(NEW.user_id);
  user_plan := COALESCE(user_plan, 'free');
  new_kind := COALESCE(NEW.diary_kind, CASE WHEN user_plan = 'free' THEN 'basic' ELSE 'main' END);

  -- O fluxo novo não cria um segundo diário do mesmo dia.
  -- Mantemos o valor addon no schema apenas para compatibilidade com histórico.
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

  -- Ao criar o diário, ele começa sem aprofundamento. A primeira atualização do
  -- registro principal consome a única oportunidade do dia; a segunda é barrada.
  IF TG_OP = 'INSERT' AND new_kind IN ('basic', 'main') THEN
    NEW.deepened_at := NULL;
  ELSIF TG_OP = 'UPDATE' AND new_kind IN ('basic', 'main') THEN
    IF OLD.deepened_at IS NOT NULL THEN
      RAISE EXCEPTION 'Você já aprofundou o registro de hoje. Um novo diário fica disponível amanhã.';
    END IF;
    NEW.deepened_at := now();
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