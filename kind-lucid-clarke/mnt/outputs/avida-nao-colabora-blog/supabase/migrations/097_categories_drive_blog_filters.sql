-- ============================================================================
-- 097 — Categorias controlam os filtros ("temas") do blog
-- ============================================================================
-- Antes: os chips de tema do blog (Ansiedade, Sobrecarga, …) eram FIXOS no
-- código (Articles.tsx). A aba Categorias do admin usava a tabela `categories`
-- (vazia). Eram dois sistemas separados.
--
-- Agora: o blog lê `categories` (ativas) para montar os filtros. Cada categoria
-- pode ter `match_terms` — radicais separados por vírgula que o filtro procura
-- no conteúdo (título, resumo, tags, temas, palavras-chave). Sem match_terms, o
-- filtro ainda funciona casando pela própria categoria do artigo.
--
-- `order_index` (já existe desde a 013) define a ordem dos chips.
-- Idempotente: pode rodar quantas vezes quiser.
-- ============================================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS match_terms text;

-- Seed dos 12 temas atuais do blog. ON CONFLICT (name) preserva categorias que
-- o admin já tenha criado, mas preenche match_terms/order quando estiverem vazios
-- (não sobrescreve customização existente).
INSERT INTO categories (name, slug, is_active, order_index, match_terms) VALUES
  ('Ansiedade',          'ansiedade',          true,  1, 'ansiedad, respira'),
  ('Sobrecarga',         'sobrecarga',         true,  2, 'sobrecarg'),
  ('Cansaço',            'cansaco',            true,  3, 'cansa, exaust, fadiga'),
  ('Sono e energia',     'sono-e-energia',     true,  4, 'sono, energia, dormir, descanso'),
  ('Autocobrança',       'autocobranca',       true,  5, 'autocobr, cobranc, culpa, perfeccion'),
  ('Autoestima',         'autoestima',         true,  6, 'autoestim, autocompaix'),
  ('Fome emocional',     'fome-emocional',     true,  7, 'fome, compuls, comida, aliment'),
  ('Limites',            'limites',            true,  8, 'limite, rela'),
  ('Rotina',             'rotina',             true,  9, 'rotina, habito, organiza'),
  ('Respiração',         'respiracao',         true, 10, 'respira'),
  ('Escrita guiada',     'escrita-guiada',     true, 11, 'escrita'),
  ('Descanso emocional', 'descanso-emocional', true, 12, 'descanso, pausa, acolhiment')
ON CONFLICT (name) DO UPDATE SET
  match_terms = COALESCE(NULLIF(categories.match_terms, ''), EXCLUDED.match_terms),
  order_index = CASE
    WHEN categories.order_index IS NULL OR categories.order_index = 0
    THEN EXCLUDED.order_index ELSE categories.order_index END,
  slug = COALESCE(NULLIF(categories.slug, ''), EXCLUDED.slug);
