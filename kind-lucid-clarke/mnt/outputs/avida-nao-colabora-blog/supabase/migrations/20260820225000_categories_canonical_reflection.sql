-- Go-live: restaura a taxonomia canônica dos filtros de Conteúdos.
--
-- A migration 098 já definiu que "Cansaço" e "Sono e energia" eram
-- duplicatas de seed. Em produção elas permaneceram/voltaram ativas e artigos
-- posteriores acabaram usando esses nomes. Para não deixar conteúdo órfão de
-- um filtro ativo, primeiro remapeamos os artigos e só então desativamos as
-- duplicatas. Nada é apagado.

UPDATE public.articles
SET category = 'Cansaço emocional'
WHERE category = 'Cansaço';

UPDATE public.articles
SET category = 'Sono e descanso'
WHERE category = 'Sono e energia';

UPDATE public.categories
SET is_active = true,
    match_terms = 'cansa, exaust, fadiga',
    order_index = 3
WHERE name = 'Cansaço emocional';

UPDATE public.categories
SET is_active = true,
    match_terms = 'sono, energia, dormir, descanso',
    order_index = 4
WHERE name = 'Sono e descanso';

UPDATE public.categories
SET is_active = false
WHERE name IN ('Cansaço', 'Sono e energia');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.articles
    WHERE category IN ('Cansaço', 'Sono e energia')
  ) THEN
    RAISE EXCEPTION 'articles still use duplicate category names';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.categories
    WHERE name IN ('Cansaço', 'Sono e energia')
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'duplicate categories are still active';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE name = 'Cansaço emocional' AND is_active = true
  ) OR NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE name = 'Sono e descanso' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'canonical categories must remain active';
  END IF;
END;
$$;
