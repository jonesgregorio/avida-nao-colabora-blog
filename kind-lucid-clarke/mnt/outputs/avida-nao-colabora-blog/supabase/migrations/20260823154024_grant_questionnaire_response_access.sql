-- O RLS já restringe cada resposta ao titular e ao questionário elegível.
-- Esta permissão de tabela permite que sessões autenticadas usem essas regras
-- pelo Data API, sem conceder acesso anônimo.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questionnaire_responses TO authenticated;
