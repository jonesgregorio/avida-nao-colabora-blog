-- Melhora o texto do e-mail de confirmação da newsletter (20260915100000):
-- explica de onde veio a inscrição e para qual e-mail, o que ajuda tanto a
-- pessoa (contexto claro) quanto a entregabilidade (menos cara de e-mail
-- genérico/suspeito para os filtros de spam). Upsert, não edita a migration
-- anterior — mesmo padrão usado em 20260908010000_ai_fallback_alert_template.

INSERT INTO public.email_templates (template_key, subject, preheader, body_text, category, is_active)
VALUES (
  'newsletter_confirmation',
  'Inscrição confirmada — A Vida Não Colabora',
  'Bem-vindo(a) à comunidade de A Vida Não Colabora.',
  $b$Que bom ter você com a gente.

A partir de agora, você vai receber por aqui — no e-mail {{email}} — textos sobre autocuidado, autoconhecimento e bem-estar emocional, sempre com cuidado para não lotar sua caixa de entrada.

Se essa inscrição não foi você, ou se mudar de ideia lá na frente, é só cancelar quando quiser, sem precisar de conta nem senha:
{{link_cancelar}}$b$,
  'newsletter', true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = excluded.subject,
  preheader = excluded.preheader,
  body_text = excluded.body_text,
  category = excluded.category,
  is_active = true,
  updated_at = now();
