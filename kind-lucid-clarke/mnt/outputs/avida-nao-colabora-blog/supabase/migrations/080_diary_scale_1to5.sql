-- ============================================================================
-- Migration 080: escala emocional unificada em 1–5 + alinhamento da constraint
-- diary_entries_energy_check.
--
-- Sintoma (mobile): "new row for relation diary_entries violates check
-- constraint diary_entries_energy_check" ao salvar Diário/Check-in.
--
-- Causa raiz: o front capturava energia/ansiedade em sliders 1–10, mas o app
-- inteiro trata essas métricas como 1–5 (o Mapa Emocional exibe "X/5" e a
-- constraint diary_entries_energy_check — criada fora deste repo — só aceita
-- 1–5). Quando o usuário movia a energia para 6–10, o valor violava a constraint.
--
-- Correção definitiva:
--   1) Front passou a usar escala 1–5 (SliderField max=5) e normalizeScale no
--      payload (energia/ansiedade/humor sempre inteiro 1–5).
--   2) Aqui: normaliza dados antigos (1–10 → 1–5) SEM corromper valores já 1–5,
--      e realinha a constraint para aceitar NULL ou inteiro 1–5.
--
-- Idempotente e seguro para rodar em produção.
-- ============================================================================

-- 1) Normaliza dados antigos ------------------------------------------------
--    Valores > 5 vêm da escala antiga 1–10 → mapeia para 1–5 (divide por 2).
--    Valores 1–5 já estão corretos e ficam intactos. Valores < 1 viram 1.
--    Só toca colunas que existem (o guard evita erro se a coluna não existir).
DO $$
DECLARE
  col  TEXT;
  cols TEXT[] := ARRAY[
    'energy', 'anxiety_level', 'mood_score', 'stress_level',
    'sleep_quality', 'self_esteem', 'irritability', 'overload'
  ];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'diary_entries' AND column_name = col
    ) THEN
      EXECUTE format(
        'UPDATE diary_entries SET %I = LEAST(5, GREATEST(1, ROUND(%I::numeric / 2))) WHERE %I > 5',
        col, col, col);
      EXECUTE format(
        'UPDATE diary_entries SET %I = 1 WHERE %I IS NOT NULL AND %I < 1',
        col, col, col);
    END IF;
  END LOOP;
END $$;

-- 2) Constraint de energia: NULL (diário sem energia) ou inteiro 1–5 ---------
ALTER TABLE diary_entries DROP CONSTRAINT IF EXISTS diary_entries_energy_check;
ALTER TABLE diary_entries
  ADD CONSTRAINT diary_entries_energy_check
  CHECK (energy IS NULL OR energy BETWEEN 1 AND 5);

-- 3) Constraint de ansiedade percebida: mesma regra (se a coluna existir) ----
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'diary_entries' AND column_name = 'anxiety_level'
  ) THEN
    ALTER TABLE diary_entries DROP CONSTRAINT IF EXISTS diary_entries_anxiety_level_check;
    ALTER TABLE diary_entries
      ADD CONSTRAINT diary_entries_anxiety_level_check
      CHECK (anxiety_level IS NULL OR anxiety_level BETWEEN 1 AND 5);
  END IF;
END $$;

-- 4) Reafirma entry_type (idempotente) — check-in não consome o limite (§8) --
ALTER TABLE diary_entries DROP CONSTRAINT IF EXISTS diary_entries_entry_type_check;
ALTER TABLE diary_entries
  ADD CONSTRAINT diary_entries_entry_type_check
  CHECK (entry_type IN ('diary', 'checkin', 'questionnaire', 'evaluation'));

-- 5) Força reload do cache do PostgREST (DDL observado pelo pgrst_ddl_watch) --
COMMENT ON COLUMN diary_entries.energy IS 'Energia percebida — inteiro 1–5 (NULL permitido). Escala única do app (§7).';
