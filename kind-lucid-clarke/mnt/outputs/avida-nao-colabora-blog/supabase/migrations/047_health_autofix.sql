-- ============================================================
-- Migration 047: Auto-reparo da Saúde do Sistema
-- ------------------------------------------------------------
-- RPC SECURITY DEFINER que corrige DE VERDADE os erros do
-- painel SISTEMA > SAÚDE DO SISTEMA com 1 clique.
--
-- Os checks do painel falham (vermelho) quando a TABELA que
-- eles testam não existe no banco. Como o cliente do navegador
-- (anon/authenticated) não tem permissão para DDL, a correção
-- real precisa rodar no servidor via função SECURITY DEFINER.
--
-- Cada branch garante o schema CANÔNICO da tabela (igual às
-- migrations originais) + RLS + policies. Tudo idempotente
-- (CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS).
--
-- IMPORTANTE: NÃO altera lógica de IA, prompts, provedores ou
-- dados. Apenas GARANTE a existência das tabelas/colunas.
-- Se a tabela já existe, é no-op completo.
-- ============================================================

-- ─── Correção de UM check específico ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_autofix_health_check(p_check_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem executar o auto-reparo.';
  END IF;

  -- ── profiles (conexão / tabela base) ──────────────────────────────────────
  IF p_check_key IN ('supabase_conn', 'db_profiles') THEN
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role                TEXT    DEFAULT 'user';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT    DEFAULT 'active';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlimited_access    BOOLEAN DEFAULT false;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email               TEXT;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();
    v_msg := 'Colunas essenciais de profiles garantidas.';

  -- ── notifications ─────────────────────────────────────────────────────────
  ELSIF p_check_key = 'db_notifications' THEN
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      action_url TEXT,
      action_data JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "notifications_own" ON notifications;
    CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "notifications_admin" ON notifications;
    CREATE POLICY "notifications_admin" ON notifications FOR ALL USING (is_admin());
    v_msg := 'Tabela notifications garantida (schema + RLS).';

  -- ── diary_entries ─────────────────────────────────────────────────────────
  ELSIF p_check_key = 'db_diary' THEN
    CREATE TABLE IF NOT EXISTS diary_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
      entry_type TEXT DEFAULT 'diary',
      questionnaire_score INTEGER,
      questionnaire_category TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE diary_entries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users manage own diary" ON diary_entries;
    CREATE POLICY "Users manage own diary" ON diary_entries
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    v_msg := 'Tabela diary_entries garantida (schema + RLS).';

  -- ── questionnaire_responses ───────────────────────────────────────────────
  ELSIF p_check_key = 'db_questionnaires' THEN
    CREATE TABLE IF NOT EXISTS questionnaire_responses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      answers JSONB NOT NULL DEFAULT '{}',
      score INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'Bem-estar',
      created_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE questionnaire_responses ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Users see own responses" ON questionnaire_responses;
    CREATE POLICY "Users see own responses" ON questionnaire_responses
      USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "Anyone can insert questionnaire" ON questionnaire_responses;
    CREATE POLICY "Anyone can insert questionnaire" ON questionnaire_responses
      FOR INSERT WITH CHECK (true);
    v_msg := 'Tabela questionnaire_responses garantida (schema + RLS).';

  -- ── articles (colunas essenciais) ─────────────────────────────────────────
  ELSIF p_check_key = 'db_articles' THEN
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS status        TEXT DEFAULT 'published';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS plan_required TEXT DEFAULT 'free';
    ALTER TABLE articles ADD COLUMN IF NOT EXISTS image_url     TEXT;
    v_msg := 'Colunas essenciais de articles garantidas.';

  -- ── trails ────────────────────────────────────────────────────────────────
  ELSIF p_check_key = 'db_trails' THEN
    CREATE TABLE IF NOT EXISTS trails (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      plan_required TEXT DEFAULT 'free',
      is_active BOOLEAN DEFAULT true,
      active BOOLEAN DEFAULT true,
      category TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE trails ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "trails_public" ON trails;
    CREATE POLICY "trails_public" ON trails FOR SELECT USING (is_active = true OR active = true);
    DROP POLICY IF EXISTS "trails_admin" ON trails;
    CREATE POLICY "trails_admin" ON trails FOR ALL USING (is_admin());
    v_msg := 'Tabela trails garantida (schema + RLS).';

  -- ── user_personalization_tasks (fila de personalização) ───────────────────
  ELSIF p_check_key = 'db_pers_tasks' THEN
    CREATE TABLE IF NOT EXISTS user_personalization_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      plan_key TEXT NOT NULL,
      task_key TEXT NOT NULL,
      task_title TEXT NOT NULL,
      task_description TEXT,
      content_type TEXT NOT NULL,
      target_area TEXT,
      period_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      due_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      related_report_id UUID,
      related_guidance_id UUID,
      related_session_id UUID,
      delivery_id UUID,
      data_snapshot JSONB DEFAULT '{}'::jsonb,
      generated_at TIMESTAMPTZ,
      sent_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      admin_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, task_key, period_key)
    );
    ALTER TABLE user_personalization_tasks ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "admins_manage_personalization_tasks" ON user_personalization_tasks;
    CREATE POLICY "admins_manage_personalization_tasks" ON user_personalization_tasks
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    DROP POLICY IF EXISTS "users_view_own_tasks" ON user_personalization_tasks;
    CREATE POLICY "users_view_own_tasks" ON user_personalization_tasks
      FOR SELECT USING (auth.uid() = user_id);
    v_msg := 'Tabela user_personalization_tasks garantida (schema + RLS).';

  -- ── personalized_content_deliveries ───────────────────────────────────────
  ELSIF p_check_key = 'db_pers_deliveries' THEN
    CREATE TABLE IF NOT EXISTS personalized_content_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      plan_key TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      target_area TEXT,
      data_snapshot JSONB DEFAULT '{}'::jsonb,
      ai_generated BOOLEAN DEFAULT true,
      status TEXT DEFAULT 'draft',
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE personalized_content_deliveries ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "admins_manage_personalized_content" ON personalized_content_deliveries;
    CREATE POLICY "admins_manage_personalized_content" ON personalized_content_deliveries
      FOR ALL USING (is_admin()) WITH CHECK (is_admin());
    DROP POLICY IF EXISTS "users_view_own_sent_content" ON personalized_content_deliveries;
    CREATE POLICY "users_view_own_sent_content" ON personalized_content_deliveries
      FOR SELECT USING (auth.uid() = user_id AND status = 'sent');
    v_msg := 'Tabela personalized_content_deliveries garantida (schema + RLS).';

  -- ── monthly_guidance_requests ─────────────────────────────────────────────
  ELSIF p_check_key = 'db_guidance' THEN
    CREATE TABLE IF NOT EXISTS monthly_guidance_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      expected_help TEXT,
      response TEXT,
      status TEXT DEFAULT 'open',
      responded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      responded_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, month_key)
    );
    ALTER TABLE monthly_guidance_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_own_guidance" ON monthly_guidance_requests;
    CREATE POLICY "users_own_guidance" ON monthly_guidance_requests
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS "admins_manage_guidance" ON monthly_guidance_requests;
    CREATE POLICY "admins_manage_guidance" ON monthly_guidance_requests
      USING (is_admin()) WITH CHECK (is_admin());
    v_msg := 'Tabela monthly_guidance_requests garantida (schema + RLS).';

  -- ── user_sessions (Sessões Plus) ──────────────────────────────────────────
  ELSIF p_check_key = 'db_sessions' THEN
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      professional_id UUID,
      month_key TEXT NOT NULL,
      scheduled_at TIMESTAMPTZ,
      duration_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'available',
      notes TEXT,
      professional_name TEXT,
      meeting_link TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_view_own_sessions" ON user_sessions;
    CREATE POLICY "users_view_own_sessions" ON user_sessions
      FOR SELECT USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "admins_manage_sessions" ON user_sessions;
    CREATE POLICY "admins_manage_sessions" ON user_sessions
      USING (is_admin()) WITH CHECK (is_admin());
    v_msg := 'Tabela user_sessions garantida (schema + RLS).';

  -- ── monthly_reports ───────────────────────────────────────────────────────
  ELSIF p_check_key = 'db_reports' THEN
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      month_key TEXT NOT NULL,
      plan_key TEXT,
      report_type TEXT NOT NULL DEFAULT 'simple',
      title TEXT,
      summary TEXT,
      data_json JSONB DEFAULT '{}'::jsonb,
      pdf_url TEXT,
      status TEXT DEFAULT 'generated',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, month_key, report_type)
    );
    ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "users_own_reports" ON monthly_reports;
    CREATE POLICY "users_own_reports" ON monthly_reports
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    DROP POLICY IF EXISTS "admins_manage_reports" ON monthly_reports;
    CREATE POLICY "admins_manage_reports" ON monthly_reports
      USING (is_admin()) WITH CHECK (is_admin());
    v_msg := 'Tabela monthly_reports garantida (schema + RLS).';

  -- ── support_tickets + ticket_messages ─────────────────────────────────────
  ELSIF p_check_key = 'db_support' THEN
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      ticket_number SERIAL,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'open',
      source TEXT DEFAULT 'contact_page',
      plan_at_creation TEXT,
      unread_for_admin BOOLEAN DEFAULT true,
      unread_for_user BOOLEAN DEFAULT false,
      resolved_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tickets_own" ON support_tickets;
    CREATE POLICY "tickets_own" ON support_tickets FOR ALL USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "tickets_admin" ON support_tickets;
    CREATE POLICY "tickets_admin" ON support_tickets FOR ALL USING (is_admin());
    v_msg := 'Tabela support_tickets garantida (schema + RLS).';

  -- ── saved_items (Caixa de Cuidado) ────────────────────────────────────────
  ELSIF p_check_key = 'db_saved' THEN
    CREATE TABLE IF NOT EXISTS saved_items (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      item_type TEXT NOT NULL DEFAULT 'article',
      item_id UUID,
      article_slug TEXT,
      title TEXT,
      description TEXT,
      image_url TEXT,
      category TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE saved_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "saved_items_own" ON saved_items;
    CREATE POLICY "saved_items_own" ON saved_items FOR ALL USING (auth.uid() = user_id);
    DROP POLICY IF EXISTS "saved_items_admin" ON saved_items;
    CREATE POLICY "saved_items_admin" ON saved_items FOR ALL USING (is_admin());
    v_msg := 'Tabela saved_items garantida (schema + RLS).';

  -- ── Não auto-corrigível por schema ────────────────────────────────────────
  ELSE
    RETURN jsonb_build_object(
      'success', false,
      'fixable', false,
      'check_key', p_check_key,
      'message', 'Este item não é corrigível automaticamente por schema (serviço externo, sessão de login, IA ou performance). Verifique a configuração correspondente.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fixable', true,
    'check_key', p_check_key,
    'message', v_msg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_autofix_health_check(text) TO authenticated;

-- ─── Correção de TODOS os checks corrigíveis de uma vez ───────────────────────
CREATE OR REPLACE FUNCTION admin_autofix_all_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keys text[] := ARRAY[
    'db_profiles', 'db_notifications', 'db_diary', 'db_questionnaires',
    'db_articles', 'db_trails', 'db_pers_tasks', 'db_pers_deliveries',
    'db_guidance', 'db_sessions', 'db_reports', 'db_support', 'db_saved'
  ];
  k       text;
  r       jsonb;
  v_all   jsonb := '[]'::jsonb;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores.';
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    r := admin_autofix_health_check(k);
    v_all := v_all || jsonb_build_array(r);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_count', array_length(v_keys, 1),
    'results', v_all
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_autofix_all_health() TO authenticated;
