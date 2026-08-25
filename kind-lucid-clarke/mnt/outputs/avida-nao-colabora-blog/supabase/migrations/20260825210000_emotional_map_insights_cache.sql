-- ============================================================================
-- MISSÃO GERAL final (Decisão de Produto nº 2 — IA no Mapa Emocional):
-- "Evitar gerar novamente toda vez que a pessoa abrir a página. Cache por
-- user_id + período + fingerprint dos dados. Botão 'Atualizar leitura'
-- quando fizer sentido."
--
-- Uma linha por usuário+período (igual ao padrão já usado em
-- monthly_care_plans_unique_period); a Edge Function explain-emotional-map
-- decide servir do cache (fingerprint bate) ou regenerar (fingerprint mudou
-- ou o usuário pediu "Atualizar leitura" explicitamente).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emotional_map_insights (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  data_fingerprint  text NOT NULL,
  result            jsonb NOT NULL,
  ai_used           boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS emotional_map_insights_unique_period
  ON public.emotional_map_insights (user_id, period_start, period_end);

ALTER TABLE public.emotional_map_insights ENABLE ROW LEVEL SECURITY;

-- Só a própria pessoa lê a leitura já pronta do seu mapa. Nenhuma policy de
-- INSERT/UPDATE para authenticated: só a Edge Function (service role) grava.
DROP POLICY IF EXISTS "emotional_map_insights_own_select" ON public.emotional_map_insights;
CREATE POLICY "emotional_map_insights_own_select" ON public.emotional_map_insights
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.emotional_map_insights IS
  'Cache da leitura de IA do Mapa Emocional por usuário+período. `result` é sempre o resumo estruturado interpretado — nunca contém texto livre do diário. Regenerado quando data_fingerprint muda ou o usuário pede "Atualizar leitura".';
