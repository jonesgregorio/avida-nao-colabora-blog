-- ============================================================
-- Migration 022: Assinaturas, histórico de mudanças e e-mail no profile
-- ============================================================

-- 1. E-mail no profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Sincroniza e-mails existentes de auth.users para profiles
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');

-- Função para sincronizar e-mail ao criar ou atualizar usuário
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email, updated_at = now()
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_sync ON auth.users;
CREATE TRIGGER on_auth_user_email_sync
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Atualiza handle_new_user para incluir e-mail
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Tabela user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL DEFAULT 'free',
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','cancel_pending','cancelled','past_due','trial','inactive')),
  current_period_start TIMESTAMPTZ DEFAULT now(),
  current_period_end TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  cancel_at_period_end BOOLEAN DEFAULT false,
  pending_plan TEXT,
  pending_plan_starts_at TIMESTAMPTZ,
  provider TEXT DEFAULT 'internal',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sub_own" ON user_subscriptions;
CREATE POLICY "sub_own" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "sub_admin" ON user_subscriptions;
CREATE POLICY "sub_admin" ON user_subscriptions FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "sub_insert_own" ON user_subscriptions;
CREATE POLICY "sub_insert_own" ON user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sub_update_own" ON user_subscriptions;
CREATE POLICY "sub_update_own" ON user_subscriptions FOR UPDATE USING (auth.uid() = user_id);

-- 3. Tabela plan_change_history
CREATE TABLE IF NOT EXISTS plan_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT,
  change_type TEXT CHECK (change_type IN ('upgrade','downgrade','cancel','reactivate','admin_change')),
  amount_charged NUMERIC DEFAULT 0,
  effective_at TIMESTAMPTZ DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'user',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_change_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pch_own" ON plan_change_history;
CREATE POLICY "pch_own" ON plan_change_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pch_admin" ON plan_change_history;
CREATE POLICY "pch_admin" ON plan_change_history FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "pch_insert" ON plan_change_history;
CREATE POLICY "pch_insert" ON plan_change_history FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

-- 4. Tabela payment_events
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  plan_key TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  status TEXT DEFAULT 'pending',
  type TEXT CHECK (type IN ('monthly_payment','upgrade_proration','refund','discount','manual_adjustment')),
  provider TEXT DEFAULT 'internal',
  provider_payment_id TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pe_own" ON payment_events;
CREATE POLICY "pe_own" ON payment_events FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "pe_admin" ON payment_events;
CREATE POLICY "pe_admin" ON payment_events FOR ALL USING (is_admin());

-- 5. Índices
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_change_history_user_id ON plan_change_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- 6. Atualizar constraint de tipo de notificação para incluir novos tipos
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info','content','promo','reminder','alert','support_reply','admin_message','system','plan_change','payment'));
