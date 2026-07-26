-- ============================================================================
-- 106 — Fila de cancelamentos no Admin (revisar + responder por e-mail)
-- ============================================================================
-- O motivo do cancelamento já é gravado em subscription_change_feedback (094).
-- Aqui adicionamos o rastreio de TRATAMENTO pelo admin: quando foi revisado,
-- qual resposta foi enviada e por quem. O cancelamento em si continua sendo
-- honrado na hora (agendado p/ fim do ciclo) — isto é só a camada de retenção.
-- RLS de admin já existe (scf_admin_all). Aditivo/idempotente.
-- ============================================================================

ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS admin_handled_at TIMESTAMPTZ;
ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS admin_reply      TEXT;
ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS admin_replied_at TIMESTAMPTZ;
ALTER TABLE subscription_change_feedback ADD COLUMN IF NOT EXISTS admin_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Template da resposta do admin (1:1, transacional — não leva List-Unsubscribe).
INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('cancellation_reply',
   'Sobre a sua assinatura',
   'Uma mensagem da nossa equipe sobre o seu plano.',
   $b$Olá, {{nome}}.

{{mensagem}}

Se quiser retomar ou ajustar seu plano, é só acessar sua conta:
{{link_meu_plano}}

Com carinho,
Equipe A Vida Não Colabora$b$,
   '', 'account', true),

  -- Alerta INTERNO para o admin quando um usuário pede cancelamento (vai p/ o admin).
  ('admin_cancellation_alert',
   'Novo cancelamento solicitado',
   'Um usuário pediu cancelamento — revise e responda.',
   $b$Um usuário solicitou o cancelamento da assinatura.

Usuário: {{usuario}}
Plano: {{plano}}
Motivo: {{motivo}}
Comentário: {{comentario}}

Revise e responda em:
{{link_admin}}$b$,
   '', 'account', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject, preheader = EXCLUDED.preheader, body_text = EXCLUDED.body_text,
  category = EXCLUDED.category, is_active = true, updated_at = now();
