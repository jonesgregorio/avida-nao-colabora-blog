-- Conteúdo P0: impede que superfícies legadas ignorem a matriz de planos.
-- `articles` já possui RLS forte e não é alterada aqui.

DROP POLICY IF EXISTS "Public can read active contents" ON public.automated_contents;
DROP POLICY IF EXISTS "Usuários leem conteúdos automáticos ativos" ON public.automated_contents;
DROP POLICY IF EXISTS "automated_contents_free" ON public.automated_contents;
DROP POLICY IF EXISTS "automated_contents_essential" ON public.automated_contents;
DROP POLICY IF EXISTS "automated_contents_plus" ON public.automated_contents;

-- O widget de conteúdo diário só aparece para usuário logado. Gratuito recebe
-- apenas conteúdo free; planos pagos usam o helper central criado no P0 de permissões.
CREATE POLICY "automated_contents_free" ON public.automated_contents
FOR SELECT TO authenticated
USING (
  COALESCE(is_active, active, false) = true
  AND COALESCE(plan_required, 'free') = 'free'
);

CREATE POLICY "automated_contents_essential" ON public.automated_contents
FOR SELECT TO authenticated
USING (
  COALESCE(is_active, active, false) = true
  AND plan_required = 'essential'
  AND public.current_user_has_plan('essential')
);

CREATE POLICY "automated_contents_plus" ON public.automated_contents
FOR SELECT TO authenticated
USING (
  COALESCE(is_active, active, false) = true
  AND plan_required IN ('plus','therapeutic','therapeutic-plus','therapeutic_plus')
  AND public.current_user_has_plan('plus')
);

-- Tabela antiga sem consumidor no frontend atual: não deve continuar pública.
-- Mantemos os registros para histórico/admin, sem expor 14 conteúdos legados via API.
DROP POLICY IF EXISTS "Meditations are public" ON public.guided_meditations;
DROP POLICY IF EXISTS "guided_meditations_admin" ON public.guided_meditations;
CREATE POLICY "guided_meditations_admin" ON public.guided_meditations
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public' AND tablename='automated_contents'
     AND policyname IN ('Public can read active contents','Usuários leem conteúdos automáticos ativos');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Conteúdo P0: políticas públicas antigas ainda existem';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public' AND tablename='automated_contents'
     AND policyname IN ('automated_contents_free','automated_contents_essential','automated_contents_plus');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Conteúdo P0: matriz de automated_contents incompleta';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname='public' AND tablename='guided_meditations'
     AND policyname='Meditations are public';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Conteúdo P0: guided_meditations segue pública';
  END IF;
END $$;
