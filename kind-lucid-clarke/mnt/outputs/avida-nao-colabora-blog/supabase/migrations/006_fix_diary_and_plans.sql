-- ============================================================
-- Migration 006: Corrige diary_entries (colunas faltantes)
--                e restrição de plano (adiciona therapeutic-plus)
-- ============================================================

-- 1. Adicionar colunas faltantes em diary_entries
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS energy           INTEGER,
  ADD COLUMN IF NOT EXISTS anxiety_level    INTEGER,
  ADD COLUMN IF NOT EXISTS stress_level     INTEGER,
  ADD COLUMN IF NOT EXISTS gratitude        TEXT,
  ADD COLUMN IF NOT EXISTS small_pride      TEXT,
  ADD COLUMN IF NOT EXISTS free_note        TEXT,
  ADD COLUMN IF NOT EXISTS emotional_tags   TEXT[],
  ADD COLUMN IF NOT EXISTS self_esteem      INTEGER,
  ADD COLUMN IF NOT EXISTS irritability     INTEGER,
  ADD COLUMN IF NOT EXISTS overload         INTEGER,
  ADD COLUMN IF NOT EXISTS recurring_thoughts TEXT,
  ADD COLUMN IF NOT EXISTS emotional_need   TEXT,
  ADD COLUMN IF NOT EXISTS relationships    TEXT,
  ADD COLUMN IF NOT EXISTS habits           TEXT;

-- 2. Ampliar CHECK constraint de plan em profiles
--    (PostgreSQL não permite ALTER de CHECK diretamente; remove e recria)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));

-- 3. Ampliar CHECK constraint de plan_level em guided_meditations e mini_challenges
ALTER TABLE guided_meditations DROP CONSTRAINT IF EXISTS guided_meditations_plan_level_check;
ALTER TABLE guided_meditations
  ADD CONSTRAINT guided_meditations_plan_level_check
  CHECK (plan_level IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));

ALTER TABLE mini_challenges DROP CONSTRAINT IF EXISTS mini_challenges_plan_level_check;
ALTER TABLE mini_challenges
  ADD CONSTRAINT mini_challenges_plan_level_check
  CHECK (plan_level IN ('free', 'essential', 'therapeutic', 'therapeutic-plus'));
