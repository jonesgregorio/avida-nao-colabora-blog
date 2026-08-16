-- A migration 121 passou a concentrar as regras de limite, tipo e diário
-- principal em enforce_diary_entry_rules / diary_entry_rules_trigger.
-- O trigger legado abaixo bloqueava o mesmo INSERT por uma regra diferente.
-- Removemos somente o trigger; a função antiga é preservada por segurança até
-- não haver mais nenhuma dependência externa conhecida.

DROP TRIGGER IF EXISTS diary_entry_limit_trigger ON public.diary_entries;

COMMENT ON FUNCTION public.enforce_diary_entry_rules() IS
  'Regra oficial do diário: check-ins livres, basic gratuito, main/addon pagos e um principal por dia.';
