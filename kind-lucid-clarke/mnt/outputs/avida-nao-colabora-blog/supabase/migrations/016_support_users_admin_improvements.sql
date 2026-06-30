-- support_tickets columns
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'support_page';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS unread_for_admin BOOLEAN DEFAULT false;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS unread_for_user BOOLEAN DEFAULT false;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_user_message_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS last_admin_message_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('open','awaiting_admin','awaiting_user','in_progress','resolved','closed'));

-- ticket_messages columns
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE ticket_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- notifications columns
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('info','content','promo','reminder','alert','support_reply','admin_message','system'));

-- user_internal_notes
CREATE TABLE IF NOT EXISTS user_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_internal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_all_notes" ON user_internal_notes;
CREATE POLICY "admin_all_notes" ON user_internal_notes FOR ALL USING (is_admin());

-- profiles admin columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_percent INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_fixed NUMERIC DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_account_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_account_status_check CHECK (account_status IN ('active','blocked','suspended','cancelled','trial'));

-- user_plan_history
CREATE TABLE IF NOT EXISTS user_plan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan TEXT,
  new_plan TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_plan_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_plan_history" ON user_plan_history;
CREATE POLICY "admin_plan_history" ON user_plan_history FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "user_own_plan_history" ON user_plan_history;
CREATE POLICY "user_own_plan_history" ON user_plan_history FOR SELECT USING (user_id = auth.uid());
