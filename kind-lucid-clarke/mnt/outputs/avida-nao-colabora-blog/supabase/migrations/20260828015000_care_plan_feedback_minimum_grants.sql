-- Corrige privilégios herdados pelos defaults do projeto na tabela de feedback.
-- A aplicação usa somente operações CRUD via Data API; TRUNCATE/TRIGGER/REFERENCES
-- não são necessários para usuários autenticados.

REVOKE ALL ON public.care_plan_action_feedback FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plan_action_feedback TO authenticated;

REVOKE ALL ON public.care_plan_action_feedback FROM anon;
GRANT ALL ON public.care_plan_action_feedback TO service_role;
