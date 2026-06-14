-- Tabela de conteúdos automatizados
CREATE TABLE IF NOT EXISTS automated_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'article_recommendation', 'guided_meditation', 'emotional_exercise',
    'weekly_challenge', 'monthly_challenge', 'weekly_evaluation',
    'monthly_report', 'self_care_plan', 'session_preparation', 'reminder'
  )),
  category TEXT,
  plan_required TEXT NOT NULL CHECK (plan_required IN ('free', 'essential', 'therapeutic', 'therapeutic-plus')),
  frequency TEXT DEFAULT 'weekly',
  content TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de conteúdos enviados ao usuário
CREATE TABLE IF NOT EXISTS user_content_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES automated_contents(id),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  feedback TEXT,
  skipped BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Preferências de notificação
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  preferred_days TEXT[] DEFAULT ARRAY['monday', 'thursday'],
  preferred_time TEXT DEFAULT '09:00',
  max_frequency TEXT DEFAULT 'weekly',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualizar tabela profiles com novos campos
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_phrase TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS communication_preference TEXT DEFAULT 'email';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_frequency TEXT DEFAULT 'weekly';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Atualizar tabela articles com campos de imagem e SEO
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_alt TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS read_time INTEGER DEFAULT 5;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT true;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS related_slugs TEXT[];

-- RLS para novas tabelas
ALTER TABLE automated_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_content_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public can read active contents" ON automated_contents FOR SELECT USING (is_active = true);
CREATE POLICY IF NOT EXISTS "Users manage own history" ON user_content_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users manage own preferences" ON user_notification_preferences FOR ALL USING (auth.uid() = user_id);
