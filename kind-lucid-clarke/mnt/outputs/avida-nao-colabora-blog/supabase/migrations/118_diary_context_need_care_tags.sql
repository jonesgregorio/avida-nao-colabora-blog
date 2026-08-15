-- ============================================================================
-- Migration 118: tags de contexto, necessidade e ações de cuidado no diário
-- (Essencial+; Gratuito continua só com emotional_tags básicas)
--
-- Idempotente. RLS já cobre a linha inteira via a policy existente
-- "Users manage own diary" (auth.uid() = user_id) — colunas novas herdam a
-- mesma proteção automaticamente, não precisam de policy própria.
-- ============================================================================

ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS context_tags TEXT[] DEFAULT '{}';
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS need_tags TEXT[] DEFAULT '{}';
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS care_action_tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN diary_entries.context_tags IS 'Contextos marcados no diário completo (Essencial+): onde a emoção apareceu.';
COMMENT ON COLUMN diary_entries.need_tags IS 'Necessidades emocionais marcadas no diário completo (Essencial+).';
COMMENT ON COLUMN diary_entries.care_action_tags IS 'Pequenas ações de cuidado marcadas no diário completo (Essencial+).';
