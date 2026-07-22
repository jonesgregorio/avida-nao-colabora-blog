-- ============================================================================
-- 102 — E-mail de VALOR: "Plano de autocuidado pode ser revisado" (Plus ativo)
-- ============================================================================
-- Primeiro e-mail de valor para usuário ATIVO (COMPLEMENTO do prompt): em vez de
-- "você sumiu", convida quem está presente a revisar o plano do mês. Disparado no
-- run-lifecycle-emails (início do mês, Plus ativo com registros), respeitando
-- receive_care_plan_reminders e com dedup mensal. Tom acolhedor, sem cobrança.
-- Variáveis: {{nome}}, {{cta_link}}, {{link_preferencias}}. Aditivo/idempotente.
-- ============================================================================

INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('value_care_plan_review',
   'Seu plano de autocuidado pode ser revisado',
   'Seus registros recentes podem deixar o plano do mês mais conectado a você.',
   $b$Olá, {{nome}}.

Com base nos seus registros recentes, seu plano de autocuidado pode ficar mais conectado ao que você viveu neste mês.

Você pode revisar suas sugestões e ajustar os próximos passos, no seu ritmo.

Ver plano de autocuidado:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  preheader = EXCLUDED.preheader,
  body_text = EXCLUDED.body_text,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = now();
