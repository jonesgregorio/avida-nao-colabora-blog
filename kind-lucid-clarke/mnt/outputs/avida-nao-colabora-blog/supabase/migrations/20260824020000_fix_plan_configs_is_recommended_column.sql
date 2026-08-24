-- ============================================================
-- Fix: plan_configs.is_recommended pode nunca ser criada num
-- replay completo do historico de migrations a partir do zero.
--
-- 009_plan_configs_and_saved_items.sql e
-- 013_fix_admin_blog_sync.sql fazem CREATE TABLE IF NOT EXISTS
-- plan_configs com esquemas diferentes (009 tem "recommended",
-- 013 tem "is_recommended"). Em ordem lexical pura (009 < 013),
-- o CREATE da 009 vence e o da 013 vira no-op, entao
-- is_recommended nunca existe -- quebrando 057, 058 e
-- 20260819210600_plans_p0_reconcile.sql, que dependem dela.
--
-- Em producao isso nao se manifestou porque as migrations
-- 001-052 foram aplicadas manualmente, fora da ordem lexical dos
-- arquivos (is_recommended ja existe la, confirmado via leitura
-- publica). Esta migration e idempotente e vira no-op em
-- producao; alinha apenas replays a partir do zero (local/CI).
-- ============================================================

ALTER TABLE plan_configs ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;