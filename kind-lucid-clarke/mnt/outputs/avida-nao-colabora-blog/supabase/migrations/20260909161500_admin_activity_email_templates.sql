-- Templates de e-mail para os alertas administrativos de novos usuários e
-- novas assinaturas. Enviados para ADMIN_ALERT_EMAIL pelo stripe-webhook
-- (nova assinatura, ativo) — nunca para todos os perfis admin.
-- Idempotente.

insert into public.email_templates (template_key, subject, preheader, body_text, category, is_active)
values (
  'admin_new_subscription_alert',
  '🎉 Nova assinatura {{plano}}',
  '{{usuario}} acabou de assinar o Plano {{plano}}.',
  $b${{usuario}} acabou de assinar o Plano {{plano}}.

Plano: {{plano}}
Data: {{data}}
E-mail: {{email}}

Ver usuário no Admin: {{link_admin}}$b$,
  'account', true
)
on conflict (template_key) do update set
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_text = excluded.body_text,
  category = excluded.category,
  is_active = true,
  updated_at = now();

insert into public.email_templates (template_key, subject, preheader, body_text, category, is_active)
values (
  'admin_new_signup_alert',
  'Novo cadastro — {{usuario}}',
  '{{usuario}} criou uma conta {{plano}}.',
  $b${{usuario}} acabou de criar uma conta {{plano}}.

Data: {{data}}
E-mail: {{email}}

Ver usuário no Admin: {{link_admin}}$b$,
  'account', true
)
on conflict (template_key) do update set
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_text = excluded.body_text,
  category = excluded.category,
  is_active = true,
  updated_at = now();
