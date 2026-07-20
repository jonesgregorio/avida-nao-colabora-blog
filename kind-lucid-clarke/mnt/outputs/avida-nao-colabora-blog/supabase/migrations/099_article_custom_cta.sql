-- ============================================================================
-- 099 — CTA final personalizável por artigo
-- ============================================================================
-- O bloco de CTA no fim do artigo (aquisição, para visitante sem conta) era
-- fixo para todos. Agora cada artigo pode escolher:
--   • cta_mode = 'auto'   → texto padrão do código (comportamento atual)
--   • cta_mode = 'custom' → título/texto próprios (cta_custom_title/text),
--                            geráveis por IA a partir do conteúdo do artigo.
-- Os botões continuam fixos ("Criar conta gratuita" / "Entrar"). Idempotente.
-- ============================================================================

ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_mode text NOT NULL DEFAULT 'auto';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_custom_title text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cta_custom_text text;

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_cta_mode_check;
ALTER TABLE articles ADD CONSTRAINT articles_cta_mode_check
  CHECK (cta_mode IN ('auto', 'custom'));
