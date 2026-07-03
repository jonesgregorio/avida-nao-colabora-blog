-- =============================================
-- interactive_schema.sql
-- Tabelas interativas: Caixa de Cuidado,
-- Termômetro, Histórico, Perguntas, Trilhas
-- =============================================

-- Caixa de Cuidado
CREATE TABLE IF NOT EXISTS saved_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('article', 'quote', 'diary_prompt', 'exercise', 'meditation', 'trail')),
  item_id TEXT,
  title TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Termômetro de artigo
CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID,
  article_slug TEXT,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('helped', 'made_me_think', 'felt_heavy', 'save_for_later', 'want_lighter_content')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_slug)
);

-- Histórico de leitura
CREATE TABLE IF NOT EXISTS reading_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id UUID,
  article_slug TEXT NOT NULL,
  article_title TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_percentage INTEGER DEFAULT 0,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, article_slug)
);

-- Perguntas de diário vinculadas a artigos
CREATE TABLE IF NOT EXISTS article_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_slug TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  plan_required TEXT DEFAULT 'free',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trilhas de leitura
CREATE TABLE IF NOT EXISTS article_trails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  plan_required TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  color TEXT DEFAULT 'emerald',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS article_trail_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trail_id UUID REFERENCES article_trails(id) ON DELETE CASCADE,
  article_slug TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_trail_items ENABLE ROW LEVEL SECURITY;

-- Policies: saved_items
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own saved items' AND tablename = 'saved_items') THEN
    CREATE POLICY "Users manage own saved items" ON saved_items FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policies: article_feedback
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own feedback' AND tablename = 'article_feedback') THEN
    CREATE POLICY "Users manage own feedback" ON article_feedback FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policies: reading_history
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own reading history' AND tablename = 'reading_history') THEN
    CREATE POLICY "Users manage own reading history" ON reading_history FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policies: article_prompts (public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read prompts' AND tablename = 'article_prompts') THEN
    CREATE POLICY "Public read prompts" ON article_prompts FOR SELECT USING (true);
  END IF;
END $$;

-- Policies: article_trails (public read active)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read trails' AND tablename = 'article_trails') THEN
    CREATE POLICY "Public read trails" ON article_trails FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- Policies: article_trail_items (public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read trail items' AND tablename = 'article_trail_items') THEN
    CREATE POLICY "Public read trail items" ON article_trail_items FOR SELECT USING (true);
  END IF;
END $$;

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_items_item_type ON saved_items(item_type);
CREATE INDEX IF NOT EXISTS idx_article_feedback_user_slug ON article_feedback(user_id, article_slug);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_slug ON reading_history(user_id, article_slug);
CREATE INDEX IF NOT EXISTS idx_article_prompts_slug ON article_prompts(article_slug);
CREATE INDEX IF NOT EXISTS idx_trail_items_trail_id ON article_trail_items(trail_id);
