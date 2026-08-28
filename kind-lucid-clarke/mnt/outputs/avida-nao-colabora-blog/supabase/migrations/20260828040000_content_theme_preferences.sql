-- ============================================================================
-- Etapa 17 — Personalização negativa reversível de conteúdos.
--
-- "Mostrar menos conteúdos assim" / "Não quero ver este tema agora": o usuário
-- silencia um TEMA emocional (dos já usados em contentRecommendation.ts, ex.
-- "ansiedade", "sono") das recomendações de Conteúdos Guiados. Reversível a
-- qualquer momento em Perfil → Temas reduzidos ("Voltar a mostrar").
--
-- Não é exclusão permanente: só filtra recomendações futuras enquanto o tema
-- estiver na lista. Nada de conteúdo é apagado; nenhum outro dado é afetado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_muted_content_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL,
  muted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, theme)
);

CREATE INDEX IF NOT EXISTS idx_user_muted_content_themes_user
  ON public.user_muted_content_themes(user_id);

ALTER TABLE public.user_muted_content_themes ENABLE ROW LEVEL SECURITY;

-- Grants mínimos: authenticated só CRUD das próprias linhas; anon sem acesso.
REVOKE ALL ON public.user_muted_content_themes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_muted_content_themes TO authenticated;

CREATE POLICY "usuário lê seus temas silenciados"
  ON public.user_muted_content_themes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usuário silencia um tema"
  ON public.user_muted_content_themes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuário reverte (des-silencia) um tema"
  ON public.user_muted_content_themes FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_muted_content_themes IS
  'Temas emocionais que o usuário pediu para não ver por enquanto nas recomendações de Conteúdos Guiados. Reversível — não é preferência de exclusão permanente.';

NOTIFY pgrst, 'reload schema';
