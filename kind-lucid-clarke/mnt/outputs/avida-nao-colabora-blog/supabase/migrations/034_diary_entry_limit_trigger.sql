-- ============================================================
-- Migration 034: Trigger para limitar entradas de diário por plano
-- ============================================================
-- Garante que usuários do plano Gratuito não ultrapassem 5 entradas/mês
-- mesmo via acesso direto à API (bypass do controle de cliente).

CREATE OR REPLACE FUNCTION check_diary_entry_limit()
RETURNS trigger AS $$
DECLARE
  user_plan TEXT;
  entry_count INTEGER;
  entry_limit INTEGER := 5;
BEGIN
  -- Busca o plano do usuário
  SELECT plan INTO user_plan FROM profiles WHERE id = NEW.user_id;

  -- Só aplica limite ao plano gratuito
  IF user_plan = 'free' THEN
    -- Conta entradas do mês atual
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger se existir (idempotente)
DROP TRIGGER IF EXISTS diary_entry_limit_trigger ON diary_entries;

-- Cria o trigger
CREATE TRIGGER diary_entry_limit_trigger
  BEFORE INSERT ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION check_diary_entry_limit();
