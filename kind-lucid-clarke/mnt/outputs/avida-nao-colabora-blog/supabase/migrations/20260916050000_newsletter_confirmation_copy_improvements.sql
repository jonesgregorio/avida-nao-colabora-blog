-- Melhora o texto do e-mail de confirmação da newsletter (20260915100000):
-- explica de onde veio a inscrição e para qual e-mail, o que ajuda tanto a
-- pessoa (contexto claro) quanto a entregabilidade (menos cara de e-mail
-- genérico/suspeito para os filtros de spam). Upsert, não edita a migration
-- anterior — mesmo padrão usado em 20260908010000_ai_fallback_alert_template.

INSERT INTO public.email_templates (template_key, subject, preheader, body_text, category, is_active)
VALUES (
  'newsletter_confirmation',
  'Inscrição confirmada — A Vida Não Colabora',
  'Confirmamos sua inscrição na newsletter de A Vida Não Colabora.',
  $b$Que bom ter você aqui.

Confirmamos a inscrição na newsletter de A Vida Não Colabora para o e-mail {{email}}, feita agora pouco pelo formulário no rodapé de avidanaocolabora.com.

A partir de agora, você recebe da gente — sem exagero na frequência — textos sobre autocuidado, autoconhecimento e bem-estar emocional.

Não foi você quem pediu essa inscrição, ou prefere não receber mais? Cancele quando quiser, sem precisar de conta nem senha:
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
