-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT DEFAULT '',
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'essential', 'therapeutic')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON profiles
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- ARTICLES
-- ============================================================
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image TEXT,
  author TEXT DEFAULT 'A Vida Não Colabora',
  category TEXT DEFAULT 'Saúde Mental',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are public" ON articles FOR SELECT USING (true);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments are public" ON comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- DIARY ENTRIES
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT DEFAULT 'neutro',
  mood_score INTEGER DEFAULT 5,
  text TEXT DEFAULT '',
  sleep_quality INTEGER,
  pain_intensity INTEGER,
  food_compulsion INTEGER,
  emotional_triggers TEXT,
  markers TEXT[],
  entry_type TEXT DEFAULT 'diary' CHECK (entry_type IN ('diary', 'questionnaire', 'evaluation')),
  questionnaire_score INTEGER,
  questionnaire_category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own diary" ON diary_entries
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- QUESTIONNAIRE RESPONSES
-- ============================================================
CREATE TABLE IF NOT EXISTS questionnaire_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'Bem-estar',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own responses" ON questionnaire_responses
  USING (auth.uid() = user_id);
CREATE POLICY "Anyone can insert questionnaire" ON questionnaire_responses FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- GUIDED MEDITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_meditations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  duration_minutes INTEGER DEFAULT 10,
  content TEXT NOT NULL,
  theme TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE guided_meditations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Meditations are public" ON guided_meditations FOR SELECT USING (true);

-- ============================================================
-- MINI CHALLENGES
-- ============================================================
CREATE TABLE IF NOT EXISTS mini_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  duration_days INTEGER DEFAULT 7,
  days JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE mini_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Challenges are public" ON mini_challenges FOR SELECT USING (true);

-- ============================================================
-- GUIDED PROMPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  text TEXT NOT NULL,
  theme TEXT,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  plan_level TEXT DEFAULT 'free' CHECK (plan_level IN ('free', 'essential', 'therapeutic')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE guided_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prompts are public" ON guided_prompts FOR SELECT USING (true);

-- ============================================================
-- WEEKLY EVALUATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS weekly_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  avg_mood NUMERIC(3,1) DEFAULT 5,
  avg_sleep NUMERIC(3,1),
  avg_pain NUMERIC(3,1),
  highlight TEXT,
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE weekly_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own evaluations" ON weekly_evaluations
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE: avatars bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar upload for authenticated" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Avatars are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
