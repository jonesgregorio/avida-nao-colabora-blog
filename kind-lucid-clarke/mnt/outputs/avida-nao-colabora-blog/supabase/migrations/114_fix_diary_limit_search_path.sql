-- Migration 114: Corrige check_diary_entry_limit() para fixar search_path
-- (migration 034 criou a função SECURITY DEFINER sem SET search_path, o que
-- permite a um usuário manipular o search_path da sessão para redirecionar
-- as referências a "profiles"/"diary_entries" para um schema controlado por ele).

CREATE OR REPLACE FUNCTION check_diary_entry_limit()
RETURNS trigger AS $$
DECLARE
  user_plan TEXT;
  entry_count INTEGER;
  entry_limit INTEGER := 5;
BEGIN
  SELECT plan INTO user_plan FROM profiles WHERE user_id = NEW.user_id;

  IF user_plan = 'free' THEN
    SELECT COUNT(*) INTO entry_count
    FROM diary_entries
    WHERE user_id = NEW.user_id
      AND date_trunc('month', created_at) = date_trunc('month', now());

    IF entry_count >= entry_limit THEN
      RAISE EXCEPTION 'Limite de % entradas por mês atingido para o plano Gratuito.', entry_limit;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
