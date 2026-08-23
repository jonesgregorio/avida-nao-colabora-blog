-- Usuários autenticados podem consultar a própria linha; o RLS continua
-- restringindo o resultado à regra users_select_own_profile.
GRANT SELECT ON TABLE public.profiles TO authenticated;
