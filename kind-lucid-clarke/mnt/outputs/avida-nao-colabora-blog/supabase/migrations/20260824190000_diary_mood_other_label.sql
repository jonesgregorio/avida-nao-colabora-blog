-- Quando o usuário escolhe o humor "Outro" (rótulo genérico, tanto no
-- check-in rápido quanto no diário completo), deixa escrever em uma frase
-- curta o que está sentindo de verdade. Esse texto substitui "Outro" na
-- devolutiva de reflexão da IA (evita frases sem sentido como "algo
-- relacionado a outro") e também melhora a leitura do Mapa Emocional.

ALTER TABLE public.diary_entries ADD COLUMN IF NOT EXISTS mood_other_label TEXT;

ALTER TABLE public.diary_entries DROP CONSTRAINT IF EXISTS diary_entries_mood_other_label_length_check;
ALTER TABLE public.diary_entries ADD CONSTRAINT diary_entries_mood_other_label_length_check
  CHECK (mood_other_label IS NULL OR char_length(mood_other_label) <= 80);

-- Coluna nova usada em INSERT logo após o deploy: um DDL real (COMMENT)
-- força o PostgREST a recarregar o cache de schema imediatamente, em vez de
-- esperar o próximo reload automático (aprendizado documentado do projeto).
COMMENT ON COLUMN public.diary_entries.mood_other_label IS 'Texto curto digitado pela pessoa quando o humor selecionado é "Outro", usado na devolutiva de IA e no Mapa Emocional.';
