-- ============================================================================
-- 103 — E-mails de VALOR (usuário ativo) — 2ª leva: orientação, conteúdo, Essencial
-- ============================================================================
-- Complementa o value_care_plan_review (102). Todos são para usuário ATIVO, com
-- teto de 1 e-mail de valor por semana (regra no run-lifecycle-emails). Assuntos
-- NEUTROS (sem dado emocional), tom acolhedor, sem cobrança. Aditivo/idempotente.
-- Variáveis: {{nome}}, {{cta_link}}, {{link_preferencias}} (+ {{titulo}}/{{resumo}}
-- no de conteúdo).
-- ============================================================================

INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES

  -- Plus — lembrete leve de que pode enviar a orientação por mensagem do mês.
  ('value_guidance_reminder',
   'Você pode enviar sua orientação deste mês',
   'Um espaço para trazer o que está no seu momento, quando fizer sentido.',
   $b$Olá, {{nome}}.

Se quiser, você pode enviar a sua orientação por mensagem deste mês. É um espaço para trazer o que está no seu momento e receber um retorno acolhedor.

Sem pressão, quando fizer sentido para você.

Enviar orientação:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  -- Todos os planos — sugestão de 1 conteúdo (não lido) compatível com o plano.
  ('value_content_recommendation',
   'Um conteúdo que pode fazer sentido para você',
   'Uma leitura curta para o seu momento, no seu ritmo.',
   $b$Olá, {{nome}}.

Separamos um conteúdo que pode combinar com o seu momento: "{{titulo}}".

{{resumo}}

Se quiser dar uma olhada, ele está no site.

Ler conteúdo:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um apoio ao seu autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  -- Gratuito ativo — convite leve para conhecer o Essencial (sem pressão).
  ('value_essential_invite',
   'Conheça o plano Essencial, no seu ritmo',
   'Recursos a mais para acompanhar seus padrões, quando fizer sentido.',
   $b$Olá, {{nome}}.

Que bom ter você usando seu espaço de autocuidado por aqui.

Se em algum momento fizer sentido, o plano Essencial abre recursos como diário ilimitado, mapa emocional completo e relatório semanal — para acompanhar seus padrões com mais clareza.

Sem pressa: você pode continuar no Gratuito o tempo que quiser.

Conhecer o Essencial:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um apoio ao seu autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true)

ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  preheader = EXCLUDED.preheader,
  body_text = EXCLUDED.body_text,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = now();
