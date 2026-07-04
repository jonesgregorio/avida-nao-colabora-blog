-- ============================================================
-- Migration 050: Correções de segurança RLS
-- Identificadas na auditoria de 04/07/2026 (via pg_policies).
-- ⚠️ REVISAR antes de aplicar — o FIX 1 muda o comportamento do
-- paywall (passa a bloquear artigos pagos para quem não tem plano).
-- Idempotente (DROP IF EXISTS + CREATE).
-- ============================================================

-- ── FIX 1 (ALTO) — Paywall de artigos furado ─────────────────────────────────
-- "public_read_published" tinha USING (status='published'), liberando TODO
-- artigo publicado a qualquer um (anônimo/Gratuito) e anulando as policies por
-- plano (articles_essential/therapeutic/therapeutic_plus). Removida.
DROP POLICY IF EXISTS "public_read_published" ON articles;

-- "admin_all" (USING role='admin') é redundante com "articles_admin_all"
-- (is_admin()). Removida para evitar duplicidade.
DROP POLICY IF EXISTS "admin_all" ON articles;

-- Resultado: anônimo/Gratuito leem só artigos free (articles_public_free);
-- planos pagos leem conforme plano; admin lê tudo (articles_admin_all).

-- ── FIX 2 (MÉDIO) — site_metrics gravável por não-admin ───────────────────────
-- "Admin gerencia métricas" tinha WITH CHECK (true): como INSERT só valida
-- WITH CHECK (não o USING), QUALQUER usuário conseguia INSERIR métrica.
-- "site_metrics_admin" usava profiles.id (padrão quebrado, nunca casa).
-- A HOME (HomeContent.tsx) lê site_metrics publicamente (contadores), então a
-- LEITURA pública é MANTIDA; só a ESCRITA passa a ser exclusiva de admin.
DROP POLICY IF EXISTS "Admin gerencia métricas" ON site_metrics;
DROP POLICY IF EXISTS "site_metrics_admin" ON site_metrics;
DROP POLICY IF EXISTS "site_metrics_read" ON site_metrics;
DROP POLICY IF EXISTS "site_metrics_public_read" ON site_metrics;
DROP POLICY IF EXISTS "site_metrics_admin_all" ON site_metrics;

-- leitura pública (necessária p/ os contadores da home):
CREATE POLICY "site_metrics_public_read" ON site_metrics
  FOR SELECT USING (true);
-- escrita (INSERT/UPDATE/DELETE) só admin:
CREATE POLICY "site_metrics_admin_all" ON site_metrics
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ── FIX 3 (BAIXO-MÉDIO) — usuário podia "responder" a própria orientação ──────
-- "users_own_guidance" era FOR ALL (auth.uid()=user_id), permitindo ao usuário
-- dar UPDATE no campo response/status da própria orientação (fingir resposta
-- profissional). Já existem "mgr_insert" (INSERT do próprio) e "mgr_user"
-- (SELECT do próprio + admin), então basta remover a policy ampla.
DROP POLICY IF EXISTS "users_own_guidance" ON monthly_guidance_requests;
-- Resultado: usuário cria (mgr_insert) e lê (mgr_user) a própria orientação;
-- só admin responde (admins_manage_guidance / mgr_admin).
