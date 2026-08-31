-- Estúdio de Conteúdo (Fase 2a) — histórico de publicações de Instagram.
--
-- Uma linha por publicação criada no Estúdio (rascunho → pronto → publicado).
-- Guarda o briefing, os textos e, depois de publicar, o link do post e as
-- métricas que o admin digita à mão (não há API do Instagram).
--
-- Área de MARKETING: nada aqui vem do Diário dos usuários nem de marcadores
-- emocionais individuais. É só conteúdo editorial da marca.
--
-- Migration ADITIVA: cria uma tabela nova e não toca em nada existente.
-- Acesso restrito a administradores (is_admin(), que já exige AAL2).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.estudio_publicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pronto', 'publicado')),

  titulo text,
  ideia text,
  objetivos text[] NOT NULL DEFAULT '{}',
  estilo text,
  prompt_imagem text,
  legenda text,
  hashtags text,
  primeiro_comentario text,
  formatos text[] NOT NULL DEFAULT '{}',
  tema_categoria text,

  publish_mode text NOT NULL DEFAULT 'agendar'
    CHECK (publish_mode IN ('manual', 'agendar')),
  scheduled_for timestamptz,
  post_url text,
  published_at timestamptz,

  -- Métricas digitadas à mão pelo admin (Fase 2d). Nulo = ainda não medido.
  alcance integer CHECK (alcance IS NULL OR alcance >= 0),
  salvos integer CHECK (salvos IS NULL OR salvos >= 0),
  compartilhamentos integer CHECK (compartilhamentos IS NULL OR compartilhamentos >= 0),
  cliques_blog integer CHECK (cliques_blog IS NULL OR cliques_blog >= 0),
  cadastros integer CHECK (cadastros IS NULL OR cadastros >= 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudio_publicacoes_status_idx
  ON public.estudio_publicacoes (status);
CREATE INDEX IF NOT EXISTS estudio_publicacoes_scheduled_idx
  ON public.estudio_publicacoes (scheduled_for)
  WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS estudio_publicacoes_created_idx
  ON public.estudio_publicacoes (created_at DESC);

DROP TRIGGER IF EXISTS estudio_publicacoes_set_updated_at ON public.estudio_publicacoes;
CREATE TRIGGER estudio_publicacoes_set_updated_at
  BEFORE UPDATE ON public.estudio_publicacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.estudio_publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estudio_publicacoes_admin_all" ON public.estudio_publicacoes;
CREATE POLICY "estudio_publicacoes_admin_all"
  ON public.estudio_publicacoes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.estudio_publicacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudio_publicacoes TO authenticated;
GRANT ALL ON public.estudio_publicacoes TO service_role;

COMMENT ON TABLE public.estudio_publicacoes IS
  'Histórico de publicações de Instagram criadas no Estúdio de Conteúdo (admin). Conteúdo editorial da marca; nunca contém dados do Diário dos usuários.';
COMMENT ON COLUMN public.estudio_publicacoes.status IS
  'rascunho = em produção; pronto = aprovado pelo admin; publicado = já foi ao ar.';
COMMENT ON COLUMN public.estudio_publicacoes.alcance IS
  'Métrica digitada à mão pelo admin (não há API do Instagram). Nulo = não medido.';
