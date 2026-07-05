-- ============================================================
-- Migration 055: template de e-mail plan_reactivated (faltava).
-- Usado quando o usuário desfaz um cancelamento/downgrade agendado
-- ("Manter meu plano"). Idempotente.
-- ============================================================

INSERT INTO email_templates (template_key, subject, preheader, category, body_text) VALUES
('plan_reactivated',
 'Sua assinatura foi mantida',
 'Sua alteração foi desfeita.',
 'plan',
 $b$Olá, {{nome}}.

Que bom que você ficou! Desfizemos o cancelamento/mudança agendada e seu plano **{{plano_atual}}** continua ativo normalmente, sem interrupção.

Ver detalhes da assinatura:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$)
ON CONFLICT (template_key) DO NOTHING;
