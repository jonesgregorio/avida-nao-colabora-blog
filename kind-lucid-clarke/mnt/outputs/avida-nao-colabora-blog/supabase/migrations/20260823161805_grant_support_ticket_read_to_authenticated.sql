
-- O RLS mantém a leitura limitada aos tickets do titular; este GRANT apenas
-- permite que a sessão autenticada use a política pela Data API.
GRANT SELECT ON TABLE public.support_tickets TO authenticated;
