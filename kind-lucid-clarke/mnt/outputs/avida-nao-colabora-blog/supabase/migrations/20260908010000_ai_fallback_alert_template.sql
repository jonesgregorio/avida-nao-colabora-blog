-- Alerta ao admin quando a automação emocional cai no rascunho determinístico
-- (as 3 IAs falharam). O run-emotional-automations dispara este e-mail para
-- ADMIN_ALERT_EMAIL ao fim de uma execução com pelo menos 1 fallback.
-- Idempotente.

insert into public.email_templates (template_key, subject, preheader, body_text, category, is_active)
values (
  'admin_ai_fallback_alert',
  'IA emocional falhou — rascunho de emergência usado',
  'Um ou mais relatórios/planos foram gerados sem IA. Revise antes de enviar.',
  $b$A automação emocional terminou uma execução, mas a IA não respondeu para {{quantidade}} geração(ões) e o rascunho determinístico de emergência foi usado.

Conteúdos afetados:
{{itens}}

Motivo técnico (provedores):
{{motivo}}

Esses rascunhos são genéricos e NÃO devem ser enviados ao usuário sem antes regenerar com IA.
Revise em: {{link_admin}}

Se o erro se repetir, verifique as chaves e modelos de IA (GEMINI/GROQ/OPENAI) nas configurações da Edge Function.$b$,
  'account', true
)
on conflict (template_key) do update set
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_text = excluded.body_text,
  category = excluded.category,
  is_active = true,
  updated_at = now();
