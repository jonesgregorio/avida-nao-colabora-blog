-- Minha História — controles pessoais da timeline.
-- Dados separados do Diário: marcos manuais e preferências de visibilidade/destaque.

CREATE TABLE IF NOT EXISTS public.user_history_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('milestone', 'hidden_month', 'highlight_month')),
  title text CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1200),
  event_date date,
  category text CHECK (category IS NULL OR char_length(category) <= 60),
  reference_key text CHECK (reference_key IS NULL OR char_length(reference_key) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_history_item_shape CHECK (
    (item_type = 'milestone' AND title IS NOT NULL AND event_date IS NOT NULL)
    OR
    (item_type IN ('hidden_month', 'highlight_month') AND reference_key IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS user_history_unique_month_control
  ON public.user_history_items (user_id, item_type, reference_key)
  WHERE item_type IN ('hidden_month', 'highlight_month');
CREATE INDEX IF NOT EXISTS user_history_user_date_idx
  ON public.user_history_items (user_id, event_date DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_user_history_items_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_history_items_set_updated_at ON public.user_history_items;
CREATE TRIGGER user_history_items_set_updated_at
  BEFORE UPDATE ON public.user_history_items
  FOR EACH ROW EXECUTE FUNCTION public.set_user_history_items_updated_at();

ALTER TABLE public.user_history_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_history_items_select_own" ON public.user_history_items;
CREATE POLICY "user_history_items_select_own"
  ON public.user_history_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_history_items_insert_own" ON public.user_history_items;
CREATE POLICY "user_history_items_insert_own"
  ON public.user_history_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_history_items_update_own" ON public.user_history_items;
CREATE POLICY "user_history_items_update_own"
  ON public.user_history_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_history_items_delete_own" ON public.user_history_items;
CREATE POLICY "user_history_items_delete_own"
  ON public.user_history_items FOR DELETE
  USING (auth.uid() = user_id);

REVOKE ALL ON public.user_history_items FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_history_items TO authenticated;
GRANT ALL ON public.user_history_items TO service_role;

COMMENT ON TABLE public.user_history_items IS
  'Controles pessoais da Minha História: marcos manuais e preferências de ocultar/destacar meses. Não altera nem apaga registros do Diário.';
