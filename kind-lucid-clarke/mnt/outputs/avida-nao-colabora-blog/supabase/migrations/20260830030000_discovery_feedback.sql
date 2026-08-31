-- Fase 19R.2 — Feedback estruturado e reversível sobre uma Descoberta.
-- Uma descoberta é um padrão que os PRÓPRIOS registros estruturados da pessoa já
-- sustentam. Aqui a pessoa só guarda uma percepção sobre ela:
--   made_sense   = fez sentido
--   sort_of      = mais ou menos
--   not_following = não quero acompanhar isso (some da área e da Home; reversível)
--
-- Nunca representa progresso, pontuação, streak, adesão ou gamificação.
-- A chave é estável (tipo + assunto, sem a contagem de dias), então o feedback
-- sobrevive quando a pessoa registra mais e a contagem muda.
-- Esta migration é ADITIVA: cria uma tabela nova e não toca em nada existente.

CREATE TABLE IF NOT EXISTS public.user_discovery_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discovery_key text NOT NULL CHECK (char_length(discovery_key) BETWEEN 1 AND 120),
  feedback text NOT NULL CHECK (feedback IN ('made_sense', 'sort_of', 'not_following')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_discovery_feedback_unique UNIQUE (user_id, discovery_key)
);

CREATE INDEX IF NOT EXISTS user_discovery_feedback_user_idx
  ON public.user_discovery_feedback (user_id);

DROP TRIGGER IF EXISTS user_discovery_feedback_set_updated_at ON public.user_discovery_feedback;
CREATE TRIGGER user_discovery_feedback_set_updated_at
  BEFORE UPDATE ON public.user_discovery_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_discovery_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discovery_feedback_own_select" ON public.user_discovery_feedback;
DROP POLICY IF EXISTS "discovery_feedback_own_insert" ON public.user_discovery_feedback;
DROP POLICY IF EXISTS "discovery_feedback_own_update" ON public.user_discovery_feedback;
DROP POLICY IF EXISTS "discovery_feedback_own_delete" ON public.user_discovery_feedback;
DROP POLICY IF EXISTS "discovery_feedback_admin_all" ON public.user_discovery_feedback;

CREATE POLICY "discovery_feedback_own_select"
  ON public.user_discovery_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "discovery_feedback_own_insert"
  ON public.user_discovery_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "discovery_feedback_own_update"
  ON public.user_discovery_feedback
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "discovery_feedback_own_delete"
  ON public.user_discovery_feedback
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "discovery_feedback_admin_all"
  ON public.user_discovery_feedback
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.user_discovery_feedback FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_discovery_feedback TO authenticated;
GRANT ALL ON public.user_discovery_feedback TO service_role;

COMMENT ON TABLE public.user_discovery_feedback IS
  'Percepção estruturada e reversível do usuário sobre uma descoberta dos próprios registros; nunca vira progresso, pontuação ou gamificação.';
COMMENT ON COLUMN public.user_discovery_feedback.discovery_key IS
  'Chave estável da descoberta (tipo + assunto, sem contagem de dias).';
COMMENT ON COLUMN public.user_discovery_feedback.feedback IS
  'made_sense=fez sentido; sort_of=mais ou menos; not_following=não quero acompanhar (oculta a descoberta, reversível).';
