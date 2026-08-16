-- Eventos personalizados do Analytics: a definição agora descreve a interação
-- observada pelo frontend. Mantém os registros existentes como clique.
ALTER TABLE public.analytics_custom_events
  ADD COLUMN IF NOT EXISTS interaction_type text NOT NULL DEFAULT 'click';

ALTER TABLE public.analytics_custom_events
  DROP CONSTRAINT IF EXISTS analytics_custom_events_interaction_type_check;

ALTER TABLE public.analytics_custom_events
  ADD CONSTRAINT analytics_custom_events_interaction_type_check
  CHECK (interaction_type IN ('click', 'submit', 'view'));

COMMENT ON COLUMN public.analytics_custom_events.interaction_type IS
  'Interação observada no seletor: click, submit ou view. Configuração disponível somente a admins.';
