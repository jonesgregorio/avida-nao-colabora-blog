-- ETAPA 3 — IA no Mapa Emocional
-- Completa o contrato de cache pedido pelo produto sem apagar o cache legado.
-- Novas leituras passam a usar period_key/source_hash/result_json/provider/model/generated_at;
-- period_start/period_end/data_fingerprint/result/ai_used permanecem para compatibilidade.

ALTER TABLE public.emotional_map_insights
  ADD COLUMN IF NOT EXISTS period_key text,
  ADD COLUMN IF NOT EXISTS source_hash text,
  ADD COLUMN IF NOT EXISTS result_json jsonb,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS generated_at timestamptz;

UPDATE public.emotional_map_insights
SET
  period_key = COALESCE(period_key, period_start::text || ':' || period_end::text),
  source_hash = COALESCE(source_hash, data_fingerprint),
  result_json = COALESCE(result_json, result),
  generated_at = COALESCE(generated_at, updated_at, created_at, now())
WHERE period_key IS NULL
   OR source_hash IS NULL
   OR result_json IS NULL
   OR generated_at IS NULL;

ALTER TABLE public.emotional_map_insights
  ALTER COLUMN period_key SET NOT NULL,
  ALTER COLUMN source_hash SET NOT NULL,
  ALTER COLUMN result_json SET NOT NULL,
  ALTER COLUMN generated_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS emotional_map_insights_unique_period_key
  ON public.emotional_map_insights (user_id, period_key);

-- RLS permanece deliberadamente somente-leitura para authenticated.
-- A escrita continua exclusiva da Edge Function via service role.
ALTER TABLE public.emotional_map_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emotional_map_insights_own_select" ON public.emotional_map_insights;
CREATE POLICY "emotional_map_insights_own_select" ON public.emotional_map_insights
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

COMMENT ON COLUMN public.emotional_map_insights.period_key IS
  'Chave estável do período interpretado, atualmente period_start:period_end.';
COMMENT ON COLUMN public.emotional_map_insights.source_hash IS
  'SHA-256 de todas as fontes estruturadas da leitura, incluindo versão do contrato; nunca contém texto livre.';
COMMENT ON COLUMN public.emotional_map_insights.result_json IS
  'Resultado estruturado da leitura do Mapa Emocional; nunca contém texto bruto do Diário.';
COMMENT ON COLUMN public.emotional_map_insights.provider IS
  'Provedor que gerou a leitura (gemini/groq/openai/fallback).';
COMMENT ON COLUMN public.emotional_map_insights.model IS
  'Modelo usado pelo provedor, quando houve IA.';
COMMENT ON COLUMN public.emotional_map_insights.generated_at IS
  'Instante em que o resultado atualmente cacheado foi gerado.';
