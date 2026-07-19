-- ============================================================================
-- 098 — Reconcilia duplicatas de categorias criadas pela 097
-- ============================================================================
-- A 097 semeou 12 temas, mas a tabela JÁ TINHA categorias reais em uso pelos
-- artigos ("Cansaço emocional" e "Sono e descanso"). Isso gerou duas
-- quase-duplicatas de tema com nomes parecidos:
--   • "Cansaço"        (seed)  ×  "Cansaço emocional"  (usado por artigos)
--   • "Sono e energia" (seed)  ×  "Sono e descanso"    (usado por artigos)
--
-- Decisão: manter os nomes que os ARTIGOS já usam (menos disruptivo — não mexe
-- na categoria de nenhum artigo), transferir os radicais de busca para eles e
-- DESATIVAR (não apagar) as duplicatas do seed. Ordem final limpa 1..12.
-- Idempotente.
-- ============================================================================

-- 1) Passa os radicais para as categorias reais (só se ainda não tiverem).
UPDATE categories SET match_terms = 'cansa, exaust, fadiga'
  WHERE name = 'Cansaço emocional' AND COALESCE(NULLIF(match_terms, ''), '') = '';
UPDATE categories SET match_terms = 'sono, energia, dormir, descanso'
  WHERE name = 'Sono e descanso' AND COALESCE(NULLIF(match_terms, ''), '') = '';

-- 2) Desativa as duplicatas do seed (ficam ocultas no blog e no dropdown, mas
--    preservadas caso o admin queira reativar).
UPDATE categories SET is_active = false WHERE name IN ('Cansaço', 'Sono e energia');

-- 3) Ordem final dos chips (só as ativas; as inativas não aparecem).
UPDATE categories SET order_index = 1  WHERE name = 'Ansiedade';
UPDATE categories SET order_index = 2  WHERE name = 'Sobrecarga';
UPDATE categories SET order_index = 3  WHERE name = 'Cansaço emocional';
UPDATE categories SET order_index = 4  WHERE name = 'Sono e descanso';
UPDATE categories SET order_index = 5  WHERE name = 'Autocobrança';
UPDATE categories SET order_index = 6  WHERE name = 'Autoestima';
UPDATE categories SET order_index = 7  WHERE name = 'Fome emocional';
UPDATE categories SET order_index = 8  WHERE name = 'Limites';
UPDATE categories SET order_index = 9  WHERE name = 'Rotina';
UPDATE categories SET order_index = 10 WHERE name = 'Respiração';
UPDATE categories SET order_index = 11 WHERE name = 'Escrita guiada';
UPDATE categories SET order_index = 12 WHERE name = 'Descanso emocional';
