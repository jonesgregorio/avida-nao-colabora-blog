-- ============================================================================
-- Migration 070: conserta o SALVAR do check-in rápido (Gratuito no limite 5/5)
--
-- Sintoma: no plano Gratuito, ao atingir 5/5 registros, o "Check-in rápido"
-- dá "Erro ao salvar". O check-in NÃO deve consumir nem ser bloqueado pelo
-- limite (§8). As migrations 062 (constraint) e 067 (trigger) já cobrem isso,
-- mas re-afirmamos de forma idempotente e forçamos um reload do cache do
-- PostgREST, para garantir o estado correto em produção.
-- ============================================================================

-- 1) Constraint: entry_type aceita 'checkin' -------------------------------
ALTER TABLE diary_entries DROP CONSTRAINT IF EXISTS diary_entries_entry_type_check;
ALTER TABLE diary_entries
  ADD CONSTRAINT diary_entries_entry_type_check
  CHECK (entry_type IN ('diary', 'checkin', 'questionnaire', 'evaluation'));

-- 2) Trigger de limite: só conta/bloqueia entradas de DIÁRIO ----------------
--    Check-in / questionário / avaliação passam sempre (não consomem o limite).
CREATE OR REPLACE FUNCTION check_diary_entry_limit()
RETURNS trigger AS $$
DECLARE
  user_plan   TEXT;
  entry_count INTEGER;
  entry_limit INTEGER := 5;
BEGIN
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM profiles WHERE user_id = NEW.user_id;

  IF user_plan = 'free' THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garante que o trigger existe e aponta para a função (idempotente).
DROP TRIGGER IF EXISTS diary_entry_limit_trigger ON diary_entries;
CREATE TRIGGER diary_entry_limit_trigger
  BEFORE INSERT ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION check_diary_entry_limit();

-- 3) Força reload do cache do PostgREST (DDL observado pelo pgrst_ddl_watch).
COMMENT ON COLUMN diary_entries.entry_type IS 'diary | checkin | questionnaire | evaluation. Check-in não consome o limite do Gratuito (§8).';
