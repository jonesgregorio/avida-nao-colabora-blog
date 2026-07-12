-- ============================================================================
-- Migration 083: devolutiva rica do questionário.
--
-- Guarda o RESULTADO estruturado (título, resumo, insights, próximos passos e
-- conteúdos recomendados) em questionnaire_responses, para que a tela final
-- possa ser reaberta depois SEM recalcular tudo.
--
-- Linguagem de autopercepção (o texto é gerado no cliente por questionnaireResult.ts).
-- Nada aqui altera IA, planos ou dados existentes — só adiciona colunas.
-- ============================================================================

ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS result_title TEXT;
ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS result_summary TEXT;
ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS result_insights JSONB DEFAULT '{}'::jsonb;
ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS recommended_next_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE questionnaire_responses ADD COLUMN IF NOT EXISTS recommended_content_ids TEXT[] DEFAULT '{}';

-- Força reload do cache do PostgREST (DDL observado pelo pgrst_ddl_watch), para
-- as novas colunas ficarem disponíveis imediatamente na API.
COMMENT ON COLUMN questionnaire_responses.result_summary IS 'Resumo de autopercepção do resultado (não diagnóstico). Ver questionnaireResult.ts.';
