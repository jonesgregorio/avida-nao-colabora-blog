-- Estúdio de Conteúdo (Fase 4b) — rotina de comunidade.
--
-- A ferramenta NUNCA curte, comenta ou segue por ninguém — isso viola os
-- Termos do Instagram e derruba contas. Ela só faz curadoria: sugere um
-- comentário genuíno para um alvo (perfil ou hashtag), e o admin registra
-- manualmente que interagiu. Serve de mini-CRM de relacionamento.
--
-- Só marketing. Nada do Diário, nada de dados de usuário.
-- Migration ADITIVA. Acesso restrito a administradores.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.estudio_comunidade_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  alvo text NOT NULL CHECK (char_length(alvo) BETWEEN 1 AND 120),
  post_url text,
  descricao_post text,
  comentario_sugerido text,
  comentario_usado text,

  status text NOT NULL DEFAULT 'sugerido'
    CHECK (status IN ('sugerido', 'feito', 'respondeu')),
  feito_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudio_comunidade_status_idx
  ON public.estudio_comunidade_interacoes (status);
CREATE INDEX IF NOT EXISTS estudio_comunidade_feito_idx
  ON public.estudio_comunidade_interacoes (feito_em)
  WHERE feito_em IS NOT NULL;

DROP TRIGGER IF EXISTS estudio_comunidade_set_updated_at ON public.estudio_comunidade_interacoes;
CREATE TRIGGER estudio_comunidade_set_updated_at
  BEFORE UPDATE ON public.estudio_comunidade_interacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.estudio_comunidade_interacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estudio_comunidade_admin_all" ON public.estudio_comunidade_interacoes;
CREATE POLICY "estudio_comunidade_admin_all"
  ON public.estudio_comunidade_interacoes
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.estudio_comunidade_interacoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estudio_comunidade_interacoes TO authenticated;
GRANT ALL ON public.estudio_comunidade_interacoes TO service_role;

COMMENT ON TABLE public.estudio_comunidade_interacoes IS
  'Rotina de comunidade do Estúdio (admin): comentários sugeridos + registro manual de interação. A ferramenta nunca interage automaticamente. Nunca contém dados do Diário.';
COMMENT ON COLUMN public.estudio_comunidade_interacoes.status IS
  'sugerido = a IA rascunhou; feito = o admin comentou manualmente; respondeu = o alvo respondeu de volta.';
