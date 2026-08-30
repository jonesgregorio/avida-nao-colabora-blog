-- Fase 20.4 — memória histórica real das descobertas reconhecidas.
-- Guarda apenas snapshot estruturado da descoberta; nunca copia texto livre do Diário.
-- A tabela é aditiva, com RLS por usuário e sem qualquer mecânica de pontuação/progresso.

CREATE TABLE IF NOT EXISTS public.user_discovery_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discovery_key text NOT NULL CHECK (char_length(discovery_key) BETWEEN 1 AND 120),
  discovery_kind text NOT NULL CHECK (discovery_kind IN ('mood','emotion','context','trigger','context_emotion','trigger_emotion','sleep_anxiety','energy_anxiety')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description text NOT NULL CHECK (char_length(description) <= 1600),
  evidence text NOT NULL CHECK (char_length(evidence) <= 1000),
  question text NOT NULL CHECK (char_length(question) <= 800),
  recognized_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_discovery_memories_unique UNIQUE (user_id, discovery_key)
);

CREATE INDEX IF NOT EXISTS user_discovery_memories_user_recognized_idx
  ON public.user_discovery_memories (user_id, recognized_at DESC);

DROP TRIGGER IF EXISTS user_discovery_memories_set_updated_at ON public.user_discovery_memories;
CREATE TRIGGER user_discovery_memories_set_updated_at
  BEFORE UPDATE ON public.user_discovery_memories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_discovery_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "discovery_memories_own_select" ON public.user_discovery_memories;
DROP POLICY IF EXISTS "discovery_memories_own_insert" ON public.user_discovery_memories;
DROP POLICY IF EXISTS "discovery_memories_own_update" ON public.user_discovery_memories;
DROP POLICY IF EXISTS "discovery_memories_own_delete" ON public.user_discovery_memories;
DROP POLICY IF EXISTS "discovery_memories_admin_all" ON public.user_discovery_memories;

CREATE POLICY "discovery_memories_own_select"
  ON public.user_discovery_memories FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "discovery_memories_own_insert"
  ON public.user_discovery_memories FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "discovery_memories_own_update"
  ON public.user_discovery_memories FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "discovery_memories_own_delete"
  ON public.user_discovery_memories FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "discovery_memories_admin_all"
  ON public.user_discovery_memories FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.user_discovery_memories FROM anon;
REVOKE ALL ON public.user_discovery_memories FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_discovery_memories TO authenticated;
GRANT ALL ON public.user_discovery_memories TO service_role;

COMMENT ON TABLE public.user_discovery_memories IS
  'Snapshots estruturados de descobertas reconhecidas pelo próprio usuário; sem texto livre do Diário e sem pontuação/progresso.';
