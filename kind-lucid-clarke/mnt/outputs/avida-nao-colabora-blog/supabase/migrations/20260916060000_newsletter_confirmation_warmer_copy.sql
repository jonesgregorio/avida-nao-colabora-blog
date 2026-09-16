-- Texto do e-mail de confirmação da newsletter ainda soava frio/institucional
-- ("feita agora pouco pelo formulário no rodapé de avidanaocolabora.com" lia
-- como um log de auditoria). Reescrito num tom mais acolhedor, coerente com o
-- resto da voz da marca ("Junte-se a quem escolhe se cuidar"), mantendo o
-- e-mail do destinatário no corpo (ajuda a entregabilidade — ver
-- 20260916050000) e o link de cancelamento em 1 clique. Upsert, não edita a
-- migration anterior — mesmo padrão já usado no projeto.

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
