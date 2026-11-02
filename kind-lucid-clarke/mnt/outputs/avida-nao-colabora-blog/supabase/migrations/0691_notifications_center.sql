-- ============================================================================
-- Migration 069: Central de Notificações — reconcilia a tabela e cria os gatilhos
--
-- A tabela `notifications` foi criada no 007 (title/body/type/is_read) e o 046
-- assumiu outro shape (message/action_url/action_data) num CREATE TABLE IF NOT
-- EXISTS que virou no-op. Aqui reconciliamos as colunas e criamos gatilhos que
-- inserem uma notificação quando:
--   • um ticket é respondido pelo admin (não interna);
--   • chega um comentário profissional (visível ao usuário);
--   • uma orientação mensal é respondida;
--   • um relatório mensal fica disponível;
--   • uma revisão do plano de autocuidado é criada;
--   • um novo artigo é publicado (broadcast a todos via user_id NULL).
--
-- Todas as funções são SECURITY DEFINER e ENGOLEM exceções (EXCEPTION WHEN
-- OTHERS) — uma falha ao notificar NUNCA pode quebrar a operação principal
-- (abrir ticket, publicar artigo, gerar relatório, etc.).
-- ============================================================================

-- 1) Reconciliação de colunas ------------------------------------------------
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message     TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body        TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url  TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_data JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read     BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at     TIMESTAMPTZ;

-- message/body podem existir como NOT NULL em algum ambiente; garante que não travem inserts.
DO $$ BEGIN
  BEGIN ALTER TABLE notifications ALTER COLUMN message DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE notifications ALTER COLUMN body    DROP NOT NULL; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

-- 2) Tipos permitidos --------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'info','alert','promo','system','content','reminder','support_reply','admin_message',
  'professional_comment','plan_change','payment','personalized_content',
  'monthly_report','monthly_guidance','self_care_review'
));

-- 3) Policies explícitas (idempotentes) --------------------------------------
-- Usuário lê/atualiza as próprias; qualquer autenticado lê os broadcasts (user_id NULL).
DROP POLICY IF EXISTS "notifications_own_read" ON notifications;
CREATE POLICY "notifications_own_read" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_broadcast_read" ON notifications;
CREATE POLICY "notifications_broadcast_read" ON notifications
  FOR SELECT USING (user_id IS NULL);

DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
CREATE POLICY "notifications_own_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Gatilhos ----------------------------------------------------------------

-- 4.1 Resposta de ticket (admin, não interna)
CREATE OR REPLACE FUNCTION notify_ticket_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t_user UUID; t_subject TEXT;
BEGIN
  IF NEW.sender_role = 'admin' AND COALESCE(NEW.is_internal, false) = false THEN
    SELECT user_id, subject INTO t_user, t_subject FROM support_tickets WHERE id = NEW.ticket_id;
    IF t_user IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, message, type, action_url)
      VALUES (t_user, 'Resposta no seu chamado',
              COALESCE('Respondemos "' || t_subject || '".', 'Sua solicitação de suporte foi respondida.'),
              'support_reply', 'support-ticket:' || NEW.ticket_id::text);
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_ticket_reply ON ticket_messages;
CREATE TRIGGER trg_notify_ticket_reply AFTER INSERT ON ticket_messages
  FOR EACH ROW EXECUTE FUNCTION notify_ticket_reply();

-- 4.2 Comentário profissional (visível ao usuário)
CREATE OR REPLACE FUNCTION notify_professional_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND COALESCE(NEW.visibility, 'user') = 'user' THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (NEW.user_id, 'Novo comentário profissional',
            COALESCE(NEW.title, 'Você recebeu um comentário do profissional.'),
            'professional_comment', 'my-evolution');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_professional_comment ON professional_comments;
CREATE TRIGGER trg_notify_professional_comment AFTER INSERT ON professional_comments
  FOR EACH ROW EXECUTE FUNCTION notify_professional_comment();

-- 4.3 Relatório mensal disponível
CREATE OR REPLACE FUNCTION notify_monthly_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (NEW.user_id, 'Seu relatório está pronto',
            COALESCE(NEW.title, 'Um novo relatório de bem-estar está disponível.'),
            'monthly_report', 'my-report');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_monthly_report ON monthly_reports;
CREATE TRIGGER trg_notify_monthly_report AFTER INSERT ON monthly_reports
  FOR EACH ROW EXECUTE FUNCTION notify_monthly_report();

-- 4.4 Revisão do plano de autocuidado
CREATE OR REPLACE FUNCTION notify_self_care_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (NEW.user_id, 'Seu plano de autocuidado foi atualizado',
            COALESCE(NEW.summary, 'Há uma nova revisão do seu plano de autocuidado.'),
            'self_care_review', 'self-care');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_self_care_review ON self_care_plan_reviews;
CREATE TRIGGER trg_notify_self_care_review AFTER INSERT ON self_care_plan_reviews
  FOR EACH ROW EXECUTE FUNCTION notify_self_care_review();

-- 4.5 Orientação mensal respondida
CREATE OR REPLACE FUNCTION notify_guidance_answered()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'answered' AND COALESCE(OLD.status, '') <> 'answered' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (NEW.user_id, 'Sua orientação chegou',
            'Sua orientação mensal foi respondida.',
            'monthly_guidance', 'monthly-guidance');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_guidance_answered ON monthly_guidance_requests;
CREATE TRIGGER trg_notify_guidance_answered AFTER UPDATE ON monthly_guidance_requests
  FOR EACH ROW EXECUTE FUNCTION notify_guidance_answered();

-- 4.6 Novo artigo publicado → broadcast (user_id NULL). Cada usuário vê pela
--     policy de broadcast; a contagem de não-lidas do sino ignora broadcasts.
CREATE OR REPLACE FUNCTION notify_new_article()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (user_id, title, message, type, action_url)
  VALUES (NULL, 'Novo conteúdo disponível',
          COALESCE('Novo conteúdo: ' || NEW.title, 'Publicamos um novo conteúdo para você.'),
          'content', 'article:' || NEW.slug);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_new_article ON articles;
CREATE TRIGGER trg_notify_new_article AFTER INSERT ON articles
  FOR EACH ROW EXECUTE FUNCTION notify_new_article();

-- 5) Índice para o feed + contagem de não-lidas
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON notifications (user_id, is_read, created_at DESC);

-- 6) Força reload do cache do PostgREST (DDL observado pelo pgrst_ddl_watch)
COMMENT ON COLUMN notifications.action_url IS 'Token de navegação do app ao clicar (ex.: my-report, support-ticket:<id>, article:<slug>).';
