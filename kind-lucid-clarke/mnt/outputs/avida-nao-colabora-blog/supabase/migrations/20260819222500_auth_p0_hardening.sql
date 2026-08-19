-- Autenticação P0: MFA obrigatório para administração + recuperação de senha.
-- O usuário comum continua com AAL1. Somente operações que dependem de is_admin()
-- passam a exigir uma sessão AAL2 (senha + TOTP).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(auth.jwt()->>'aal', 'aal1') = 'aal2'
    AND EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE profiles.user_id = auth.uid()
         AND profiles.role = 'admin'
    );
$$;

-- O link de recuperação do Supabase cria uma sessão recovery. O frontend chama
-- esta RPC quando recebe PASSWORD_RECOVERY; App.tsx já possui um gate existente
-- para profiles.must_change_password e obriga updateUser({ password }) antes do uso.
CREATE OR REPLACE FUNCTION public.mark_password_recovery_required()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  UPDATE public.profiles
     SET must_change_password = true,
         updated_at = now()
   WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_password_recovery_required() FROM public;
GRANT EXECUTE ON FUNCTION public.mark_password_recovery_required() TO authenticated;

-- Guardas para evitar regressão do gate administrativo.
DO $$
DECLARE
  v_def text;
  v_own_select integer;
BEGIN
  SELECT pg_get_functiondef('public.is_admin()'::regprocedure) INTO v_def;
  IF position('aal2' in v_def) = 0 THEN
    RAISE EXCEPTION 'Autenticação P0: is_admin não exige AAL2';
  END IF;

  -- AAL1 precisa conseguir ler SOMENTE o próprio perfil para o frontend saber
  -- que a conta é admin e apresentar o cadastro/desafio MFA antes do painel.
  SELECT count(*) INTO v_own_select
    FROM pg_policies
   WHERE schemaname='public'
     AND tablename='profiles'
     AND policyname='users_select_own_profile'
     AND cmd='SELECT';
  IF v_own_select <> 1 THEN
    RAISE EXCEPTION 'Autenticação P0: leitura do próprio perfil ausente para o gate MFA';
  END IF;

  IF to_regprocedure('public.mark_password_recovery_required()') IS NULL THEN
    RAISE EXCEPTION 'Autenticação P0: RPC de recuperação não foi criada';
  END IF;
END $$;
