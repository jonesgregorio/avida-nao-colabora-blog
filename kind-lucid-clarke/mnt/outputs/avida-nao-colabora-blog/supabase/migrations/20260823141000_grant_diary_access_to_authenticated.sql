-- O RLS já restringe cada registro ao respectivo titular. Esta permissão de
-- tabela permite que a sessão autenticada use essas regras pelo Data API.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.diary_entries TO authenticated;
