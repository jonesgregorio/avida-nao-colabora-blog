-- ============================================================================
-- 109 — Novo nível de acesso 'account' (Gratuito, exige conta) nos artigos
-- ============================================================================
-- Separa "conteúdo de usuários sem conta" (plan_required='free' = Público, anônimo
-- lê) de "conteúdo gratuito" (plan_required='account' = exige estar logado, mas
-- não exige plano pago).
--
--   free      → Público: qualquer visitante lê (com ou sem conta)   [inalterado]
--   account   → Gratuito: qualquer usuário LOGADO lê (anônimo vê só a prévia)
--   essential → assinantes Essencial/Plus
--   plus      → assinantes Plus
--
-- Decisão do usuário: o acervo atual (free) CONTINUA público — nada é migrado.
-- Aditivo/idempotente. get_article_teaser e get_guided_catalog já retornam por
-- STATUS (não por plano), então cobrem 'account' sem alteração.
-- ============================================================================

-- 1. CHECK: passa a aceitar 'account'
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_plan_required_check;
ALTER TABLE articles ADD CONSTRAINT articles_plan_required_check
  CHECK (plan_required IN ('free', 'account', 'essential', 'plus'));

-- 2. RLS: conteúdo 'account' visível a QUALQUER usuário autenticado (sem checar
--    plano/assinatura — é gratuito, só exige conta). Anônimo NÃO lê o corpo; ele
--    recebe a prévia via get_article_teaser (paywall com CTA de criar conta).
DROP POLICY IF EXISTS "articles_account" ON articles;
CREATE POLICY "articles_account" ON articles
  FOR SELECT TO authenticated
  USING (
    plan_required = 'account'
    AND (status = 'published'
         OR (status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= now()))
  );
