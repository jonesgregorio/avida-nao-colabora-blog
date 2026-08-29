-- ============================================================================
-- Ideia 1 · Fase 12 — Foco da Semana
--
-- Persiste no máximo um foco por usuário e por semana para que a experiência
-- continue entre dispositivos/acessos. O foco é uma orientação opcional, não
-- uma tarefa: não há progresso, pontos, streak ou conclusão obrigatória.
--
-- A reflexão de fechamento é estruturada e curta; nenhum texto livre do
-- Diário é copiado para esta tabela.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_weekly_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  focus_key text NOT NULL,
  focus_title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  outcome text,
  chosen_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_weekly_focus_unique_week UNIQUE (user_id, week_start),
  CONSTRAINT user_weekly_focus_key_len CHECK (char_length(focus_key) BETWEEN 1 AND 120),
  CONSTRAINT user_weekly_focus_title_len CHECK (char_length(focus_title) BETWEEN 1 AND 240),
  CONSTRAINT user_weekly_focus_status_check CHECK (status IN ('active', 'closed')),
  CONSTRAINT user_weekly_focus_outcome_check CHECK (
    outcome IS NULL OR outcome IN ('helped', 'somewhat', 'not_much', 'not_used')
  )
);

CREATE INDEX IF NOT EXISTS idx_user_weekly_focus_user_week
  ON public.user_weekly_focus(user_id, week_start DESC);

ALTER TABLE public.user_weekly_focus ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_weekly_focus FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_weekly_focus TO authenticated;

CREATE POLICY "usuário lê seus focos semanais"
  ON public.user_weekly_focus FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "usuário escolhe seu foco semanal"
  ON public.user_weekly_focus FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "usuário atualiza seu foco semanal"
  ON public.user_weekly_focus FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.user_weekly_focus IS
  'Foco semanal opcional da Ideia 1. Uma linha por usuário/semana; sem gamificação e sem texto livre do Diário.';

COMMENT ON COLUMN public.user_weekly_focus.outcome IS
  'Reflexão estruturada ao fechar a semana: helped, somewhat, not_much ou not_used.';

NOTIFY pgrst, 'reload schema';
