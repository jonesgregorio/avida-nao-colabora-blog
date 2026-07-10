-- ============================================================================
-- Migration 066: força reload do schema cache do PostgREST via DDL real (§9)
--
-- A migration 065 usou `NOTIFY pgrst, 'reload schema'`, mas em teste manual
-- esse NOTIFY não recarregou o cache (o PATCH de conclusão seguia 400 para as
-- colunas total_score/generated_tags/result_id/completed_at). O caminho
-- confiável no Supabase é executar um DDL REAL: o event trigger de schema do
-- Supabase (pgrst_ddl_watch) dispara o reload automaticamente ao detectar DDL.
--
-- `COMMENT ON` é DDL de verdade (diferente de ADD COLUMN IF NOT EXISTS quando a
-- coluna já existe, que é no-op e não dispara o watcher). Isso obriga o
-- PostgREST a recarregar o cache e passar a reconhecer as 4 colunas.
-- ============================================================================

comment on column questionnaire_responses.total_score    is 'Pontuação total do questionário (reload cache 066).';
comment on column questionnaire_responses.generated_tags is 'Tags geradas a partir das respostas.';
comment on column questionnaire_responses.result_id      is 'Id do resultado correspondente (results[].id).';
comment on column questionnaire_responses.completed_at   is 'Momento de conclusão do questionário.';

-- Reforço explícito do reload (redundante com o watcher, mas inofensivo).
notify pgrst, 'reload schema';
