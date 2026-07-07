-- =============================================================================
-- LIMPEZA DE DADOS DE TESTE — A Vida Não Colabora
-- =============================================================================
-- NÃO é migration (não roda no CI). Aplicar MANUALMENTE no Supabase SQL Editor
-- (ref lejvvhzluggyxlfwfoxl), revisando o resultado dos SELECT antes de deletar.
--
-- Alvo: tickets/registros de teste tipo "teste", "testeeee", "Olaa", "ola".
-- Padrões propositalmente restritos para não apagar conteúdo real.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PASSO 1 — PREVIEW. Rode só esta parte primeiro e confira o que apareceria.
-- -----------------------------------------------------------------------------

-- 1a) Tickets de suporte de teste
SELECT ticket_number, subject, description, status, created_at
FROM support_tickets
WHERE subject ILIKE 'teste%'
   OR subject ILIKE 'testee%'
   OR subject ILIKE 'olaa%'
   OR subject ILIKE 'ola'
   OR subject ILIKE 'olá'
   OR description ILIKE 'teste%'
   OR description ILIKE 'testee%'
   OR description ILIKE 'olaa%'
ORDER BY created_at DESC;

-- 1b) Orientações mensais de teste (mensagem)
SELECT id, message, status, created_at
FROM monthly_guidance_requests
WHERE message ILIKE 'teste%'
   OR message ILIKE 'testee%'
   OR message ILIKE 'olaa%'
ORDER BY created_at DESC;

-- 1c) Planos de autocuidado de teste (resumo)
SELECT id, month_key, summary, created_at
FROM self_care_plan_reviews
WHERE summary ILIKE 'teste%'
   OR summary ILIKE 'testee%'
   OR summary ILIKE 'olaa%'
ORDER BY created_at DESC;

-- 1d) Artigos de teste (título)
SELECT id, title, status, created_at
FROM articles
WHERE title ILIKE 'teste%'
   OR title ILIKE 'testee%'
   OR title ILIKE 'olaa%'
   OR title ILIKE 'ola'
ORDER BY created_at DESC;

-- -----------------------------------------------------------------------------
-- PASSO 2 — DELETE. Só rode DEPOIS de conferir o PASSO 1.
-- Remova o comentário (--) das linhas que quiser executar.
-- ticket_messages some junto (ON DELETE CASCADE).
-- -----------------------------------------------------------------------------

-- DELETE FROM support_tickets
-- WHERE subject ILIKE 'teste%'
--    OR subject ILIKE 'testee%'
--    OR subject ILIKE 'olaa%'
--    OR subject ILIKE 'ola'
--    OR subject ILIKE 'olá'
--    OR description ILIKE 'teste%'
--    OR description ILIKE 'testee%'
--    OR description ILIKE 'olaa%';

-- DELETE FROM monthly_guidance_requests
-- WHERE message ILIKE 'teste%'
--    OR message ILIKE 'testee%'
--    OR message ILIKE 'olaa%';

-- DELETE FROM self_care_plan_reviews
-- WHERE summary ILIKE 'teste%'
--    OR summary ILIKE 'testee%'
--    OR summary ILIKE 'olaa%';

-- DELETE FROM articles
-- WHERE title ILIKE 'teste%'
--    OR title ILIKE 'testee%'
--    OR title ILIKE 'olaa%'
--    OR title ILIKE 'ola';

-- -----------------------------------------------------------------------------
-- Dica: se algum registro legítimo aparecer no PASSO 1, ajuste o WHERE
-- (por ex. deletando por ticket_number/id específico) antes de rodar o DELETE.
-- -----------------------------------------------------------------------------
