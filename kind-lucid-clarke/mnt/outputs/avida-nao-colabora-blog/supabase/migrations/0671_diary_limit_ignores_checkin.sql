-- ============================================================================
-- Migration 067: trigger de limite do diário NÃO conta check-ins (§8)
--
-- Bug achado no smoke test (só afeta o Gratuito): o trigger `diary_entry_limit_trigger`
-- (migration 034) contava TODOS os registros do mês (COUNT(*) sem filtrar entry_type)
-- e disparava em QUALQUER insert. Como o check-in agora é `entry_type='checkin'`
-- (migration 062), isso fazia (a) check-ins consumirem o limite de 5/mês e (b) um
-- usuário Gratuito com 5 registros ser BLOQUEADO ao tentar fazer um check-in — mesmo
-- o cliente permitindo. O §8 exige que check-ins não consumam o limite.
--
-- Correção: só conta/bloqueia entradas de diário (entry_type='diary'); check-in,
-- questionário e avaliação passam sempre. Alinha o trigger com a lógica do cliente.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_diary_entry_limit()
RETURNS trigger AS $$
DECLARE
  user_plan TEXT;
  entry_count INTEGER;
  entry_limit INTEGER := 5;
BEGIN
  -- Só entradas de diário contam para o limite. Check-in/questionário/avaliação
  -- nunca são bloqueados nem consomem o limite (§8).
  IF COALESCE(NEW.entry_type, 'diary') <> 'diary' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO user_plan FROM profiles WHERE user_id = NEW.user_id;

  IF user_plan = 'free' THEN
    -- Conta apenas entradas de diário do mês atual (exclui check-in/questionário/avaliação).
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

-- O trigger já aponta para esta função (CREATE OR REPLACE atualiza em lugar).
