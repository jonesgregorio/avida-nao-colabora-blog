-- Diário v2: metadados opcionais da experiência de IA.
-- O texto original do diário continua em diary_entries.text e nunca é
-- substituído automaticamente por uma resposta de IA.

ALTER TABLE public.diary_entries
  ADD COLUMN IF NOT EXISTS ai_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_title text,
  ADD COLUMN IF NOT EXISTS ai_reflection jsonb,
  ADD COLUMN IF NOT EXISTS ai_suggested_tags jsonb,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz;

ALTER TABLE public.diary_entries
  DROP CONSTRAINT IF EXISTS diary_entries_ai_title_length_check;
ALTER TABLE public.diary_entries
  ADD CONSTRAINT diary_entries_ai_title_length_check
  CHECK (ai_title IS NULL OR char_length(ai_title) <= 120);

COMMENT ON COLUMN public.diary_entries.ai_disabled IS 'Se true, o registro não deve ser enviado ao companheiro de IA do diário.';
COMMENT ON COLUMN public.diary_entries.ai_title IS 'Título privado curto sugerido pela IA; não substitui o texto original.';
COMMENT ON COLUMN public.diary_entries.ai_reflection IS 'Espelho não clínico gerado após salvar, quando autorizado pelo usuário.';
COMMENT ON COLUMN public.diary_entries.ai_suggested_tags IS 'Tags sugeridas pela IA; só entram nas colunas analíticas após confirmação explícita do usuário.';
COMMENT ON COLUMN public.diary_entries.ai_processed_at IS 'Momento em que a devolutiva opcional de IA foi concluída.';
