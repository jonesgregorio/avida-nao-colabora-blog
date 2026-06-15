-- Caixa de Cuidado (favoritos)
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('article','quote','diary_prompt','exercise','meditation','trail')),
  item_id TEXT,
  title TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback/termômetro dos artigos
CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helped','made_me_think','felt_heavy','save_for_later','want_lighter_content')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Histórico de leitura
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  article_slug TEXT,
  article_title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_id)
);

-- Perguntas de diário vinculadas a artigos
CREATE TABLE IF NOT EXISTS article_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_slug TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  plan_required TEXT DEFAULT 'free' CHECK (plan_required IN ('free','essential','therapeutic','therapeutic-plus')),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_prompts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saved_items' AND policyname='Users manage own saved items') THEN
    CREATE POLICY "Users manage own saved items" ON saved_items FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='article_feedback' AND policyname='Users manage own feedback') THEN
    CREATE POLICY "Users manage own feedback" ON article_feedback FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reading_history' AND policyname='Users manage own reading history') THEN
    CREATE POLICY "Users manage own reading history" ON reading_history FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='article_prompts' AND policyname='Public can read prompts') THEN
    CREATE POLICY "Public can read prompts" ON article_prompts FOR SELECT USING (true);
  END IF;
END $$;
