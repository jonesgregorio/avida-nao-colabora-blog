-- Estúdio de Conteúdo (Fase 4a) — perfis de inspiração do Instagram.
--
-- O admin cadastra @perfis de referência e, de vez em quando, cola algumas
-- legendas recentes deles. A IA extrai o padrão (formato, tom, cadência) e
-- devolve como recomendação para o calendário. Não raspa dados: o texto é
-- colado à mão pelo admin.
--
-- Só dados públicos de marketing. Nada do Diário, nada de dados de usuário.
-- Migration ADITIVA. Acesso restrito a administradores.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.estudio_perfis_inspiracao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  handle text NOT NULL CHECK (char_length(handle) BETWEEN 1 AND 80),
  tema text,
  notas text,
  legendas_coladas text,
  analise text,
  analisado_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudio_perfis_inspiracao_created_idx
  ON public.estudio_perfis_inspiracao (created_at DESC);

DROP TRIGGER IF EXISTS estudio_perfis_inspiracao_set_updated_at ON public.estudio_perfis_inspiracao;
CREATE TRIGGER estudio_perfis_inspiracao_set_updated_at
  BEFORE UPDATE ON public.estudio_perfis_inspiracao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.estudio_perfis_inspiracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estudio_perfis_inspiracao_admin_all" ON public.estudio_perfis_inspiracao;
CREATE POLICY "estudio_perfis_inspiracao_admin_all"
  ON public.estudio_perfis_inspiracao
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.estudio_perfis_inspiracao FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudio_perfis_inspiracao TO authenticated;
GRANT ALL ON public.estudio_perfis_inspiracao TO service_role;

COMMENT ON TABLE public.estudio_perfis_inspiracao IS
  'Perfis de referência do Instagram para o Estúdio (admin). Legendas coladas à mão pelo admin; nunca contém dados do Diário nem raspagem.';
