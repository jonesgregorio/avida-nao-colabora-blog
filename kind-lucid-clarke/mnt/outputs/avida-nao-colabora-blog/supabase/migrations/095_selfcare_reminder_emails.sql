-- ============================================================================
-- 095 — Lembretes de autocuidado por inatividade (e-mail)
-- ============================================================================
-- Reaproveita a infra existente:
--   • run-lifecycle-emails (cron diário, migration 076) executa o motor;
--   • send-transactional-email grava email_logs + dedup por idempotency_key;
--   • email_logs já tem user_id/template_key/status/metadata/created_at (§11).
-- Esta migration só adiciona: preferências granulares e os 7 templates novos.
--
-- Tom: lembrete de autocuidado, NUNCA cobrança/culpa (§7/§8). Assuntos neutros,
-- sem dado emocional (§19). O corpo especifico por plano/gatilho e a gating de
-- plano vivem NA FUNÇÃO (run-lifecycle-emails) e chegam como {{corpo}}/{{cta_*}}.
-- O rodape (aviso de preferencias + disclaimer) fica FIXO no template, garantido
-- em todo e-mail independente da funcao.
-- Aditivo e idempotente.
-- ============================================================================

-- ── 1. Preferências granulares ──────────────────────────────────────────────
-- Modelo opt-out: ausência de linha ou coluna = recebe (default true). O master
-- continua sendo profiles.email_notifications; transacionais (pagamento/segurança)
-- NÃO passam por estas flags.
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS receive_selfcare_reminders BOOLEAN DEFAULT true;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS receive_report_reminders   BOOLEAN DEFAULT true;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS receive_care_plan_reminders BOOLEAN DEFAULT true;
ALTER TABLE user_notification_preferences ADD COLUMN IF NOT EXISTS receive_product_updates    BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_notification_preferences.receive_selfcare_reminders IS
  'Lembretes leves de check-in/diário por inatividade (095). Não afeta e-mails transacionais.';

-- ── 2. Templates (7) ────────────────────────────────────────────────────────
-- Variáveis injetadas pela função: {{nome}}, {{corpo}} (acolhedor + por plano),
-- {{cta_label}}, {{cta_link}}, {{link_preferencias}}.
-- Categoria 'selfcare_reminder' agrupa no Admin e permite futura gating.

INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('selfcare_inactive_3d',
   'Como você está hoje?',
   'Seu espaço de autocuidado continua aqui.',
   $b$Olá, {{nome}}.

Passando só para lembrar que seu espaço de autocuidado continua aqui.

{{corpo}}

Sem pressão, no seu ritmo.

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_inactive_7d',
   'Uma pausa também faz parte',
   'Quando quiser retomar, seu espaço continua disponível.',
   $b$Olá, {{nome}}.

Você ficou alguns dias sem registrar como tem se sentido, e tudo bem.

{{corpo}}

Não precisa ser perfeito, só precisa ser seu.

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_inactive_14d',
   'Seu espaço continua te esperando',
   'Um pequeno registro já pode trazer mais clareza.',
   $b$Olá, {{nome}}.

Às vezes a rotina pesa e a gente se afasta até das coisas que ajudam.

{{corpo}}

Quando fizer sentido para você, seu espaço continua disponível.

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_inactive_30d',
   'Quer retomar do seu jeito?',
   'No seu ritmo, quando quiser.',
   $b$Olá, {{nome}}.

Faz um tempo que você não aparece por aqui.

{{corpo}}

Sem pressão: o A Vida Não Colabora foi criado para ser um espaço leve, no seu ritmo.

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_weekly_low_data',
   'Seu relatório semanal pode ganhar mais contexto',
   'Um check-in rápido já ajuda a leitura da semana.',
   $b$Olá, {{nome}}.

{{corpo}}

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_monthly_low_data',
   'Seu mês ainda pode ganhar mais contexto',
   'Um check-in rápido conecta a leitura do mês ao que você viveu.',
   $b$Olá, {{nome}}.

{{corpo}}

Sem pressão, no seu ritmo.

{{cta_label}}:
{{cta_link}}

Este é um lembrete de autocuidado, não uma cobrança. Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um lembrete de autocuidado e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
   '', 'selfcare_reminder', true),

  ('selfcare_care_plan_low_data',
   'Seu plano de autocuidado pode ficar mais conectado a você',
   'Um pequeno check-in traz mais contexto para as sugestões do mês.',
   $b$Olá, {{nome}}.

{{corpo}}

{{cta_label}}:
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
