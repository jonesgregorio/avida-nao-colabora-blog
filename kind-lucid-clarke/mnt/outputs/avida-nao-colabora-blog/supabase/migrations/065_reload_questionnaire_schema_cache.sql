-- ============================================================================
-- Migration 065: corrige conclusão de questionário (§9) — reload do schema
-- cache do PostgREST.
--
-- Sintoma (comprovado em produção via smoke test): ao concluir um questionário,
-- o PATCH de conclusão (status='completed' + total_score/generated_tags/
-- result_id/completed_at) retornava HTTP 400 (PGRST204), enquanto o PATCH de
-- progresso (answers/current_step/status) retornava 204. Resultado: a resposta
-- ficava como 'in_progress' e o contador "X de N concluídos" não avançava.
--
-- Causa: as colunas total_score/generated_tags/result_id/completed_at EXISTEM
-- no banco (confirmado em information_schema.columns), mas o cache de schema do
-- PostgREST não as reconhecia (adicionadas sem reload posterior). Reassertamos
-- as colunas de forma idempotente e sinalizamos o reload do cache.
-- ============================================================================

alter table questionnaire_responses add column if not exists total_score    integer default 0;
alter table questionnaire_responses add column if not exists generated_tags text;
alter table questionnaire_responses add column if not exists result_id      text;
alter table questionnaire_responses add column if not exists completed_at   timestamptz;

-- Recarrega o cache de schema do PostgREST para que os PATCH de conclusão
-- passem a reconhecer todas as colunas.
notify pgrst, 'reload schema';
