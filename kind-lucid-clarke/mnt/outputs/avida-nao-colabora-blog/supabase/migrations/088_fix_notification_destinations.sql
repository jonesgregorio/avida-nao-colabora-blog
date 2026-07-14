-- ============================================================================
-- 088 — Corrige destinos de notificações in-app
-- ============================================================================
-- O gatilho de comentário profissional apontava para o Mapa Emocional
-- ('my-evolution'); o destino correto é a área de comentários. Também corrige
-- linhas já criadas com o destino errado.
--
-- Os demais gatilhos (autocuidado→'self-care', orientação→'monthly-guidance',
-- relatório→'my-report', ticket→'support-ticket:<id>') já estavam corretos.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_professional_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND COALESCE(NEW.visibility, 'user') = 'user' THEN
    INSERT INTO notifications (user_id, title, message, type, action_url)
    VALUES (NEW.user_id, 'Novo comentário profissional',
            COALESCE(NEW.title, 'Você recebeu um comentário do profissional.'),
            'professional_comment', 'professional-comments');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

-- Corrige destinos legados errados já gravados.
UPDATE notifications
   SET action_url = 'professional-comments'
 WHERE type = 'professional_comment' AND action_url IN ('my-evolution', 'mapa-emocional');

UPDATE notifications
   SET action_url = 'self-care'
 WHERE type = 'self_care_review' AND action_url IN ('my-evolution', 'mapa-emocional');

-- Reafirma o comentário do PostgREST (dispara reload do cache de schema).
COMMENT ON COLUMN notifications.action_url IS 'Token de navegação do app ao clicar (ex.: my-report, self-care, professional-comments, support-ticket:<id>, article:<slug>).';
