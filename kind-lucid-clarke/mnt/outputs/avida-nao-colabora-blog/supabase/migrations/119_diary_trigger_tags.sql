-- ============================================================================
-- Migration 119: gatilhos emocionais REAIS (trigger_tags), exclusivo Plus
--
-- Corrige um problema conceitual: o Mapa Emocional chamava emotional_tags
-- (sentimentos como ansiedade/tristeza) de "gatilhos", o que é incorreto —
-- emoção não é gatilho. trigger_tags guarda gatilhos de verdade (cobrança,
-- conflito, excesso de tarefas etc.), separados dos sentimentos.
--
-- Idempotente. RLS já cobre a linha inteira via a policy existente
-- "Users manage own diary" — não precisa de policy própria.
-- ============================================================================

ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS trigger_tags TEXT[] DEFAULT '{}';

COMMENT ON COLUMN diary_entries.trigger_tags IS 'Gatilhos emocionais reais marcados no diário completo (Plus) — separados de emotional_tags (sentimentos).';
