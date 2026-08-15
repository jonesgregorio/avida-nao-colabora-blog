-- Migration 117: check_diary_entry_limit() estava contando check-ins no
-- limite mensal do plano Gratuito.
--
-- A função original (034) e a correção de search_path (114) contavam TODAS
-- as linhas de diary_entries do mês, sem filtrar por entry_type — ou seja,
-- um check-in rápido (entry_type='checkin') também incrementava a contagem
-- e podia contribuir para bloquear o usuário, mesmo a interface afirmando
-- "check-ins são ilimitados e não entram nessa conta".
--
-- Esta versão só conta/bloqueia entry_type = 'diary' (ou NULL, tratado como
-- 'diary' por segurança — linhas antigas sem o campo preenchido). Check-in,
-- questionário e avaliação nunca são contados nem bloqueados.

CREATE OR REPLACE FUNCTION check_diary_entry_limit()
RETURNS trigger AS $$
DECLARE
  user_plan TEXT;
  entry_count INTEGER;
  entry_limit INTEGER := 5;
BEGIN
  -- Check-in, questionário e avaliação não contam e nunca são bloqueados.
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM profiles WHERE user_id = NEW.user_id;

  IF COALESCE(user_plan, 'free') = 'free' THEN
    SELECT COUNT(*) INTO entry_count
    FROM diary_entries
    WHERE user_id = NEW.user_id
      AND COALESCE(entry_type, 'diary') = 'diary'
      AND date_trunc('month', created_at) = date_trunc('month', now());

    IF entry_count >= entry_limit THEN
      RAISE EXCEPTION 'Limite de % entradas por mês atingido para o plano Gratuito.', entry_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS diary_entry_limit_trigger ON diary_entries;

CREATE TRIGGER diary_entry_limit_trigger
  BEFORE INSERT ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION check_diary_entry_limit();
