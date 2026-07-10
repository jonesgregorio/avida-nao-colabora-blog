-- ============================================================================
-- Migration 064: remove questionário legado oculto (§9)
-- 'mapa-emocional-inicial' sobrou fora dos 8 questionários oficiais do MVP.
-- Estava com show_on_questionnaires_page=false (não aparecia ao usuário), mas
-- poluía a lista no admin. Removido de forma idempotente e segura:
-- respostas antigas ligadas a ele ficam com questionnaire_id nulo
-- (a FK é ON DELETE SET NULL, definida na migration 061).
-- ============================================================================

begin;

delete from questionnaires where slug = 'mapa-emocional-inicial';

commit;
