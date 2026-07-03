-- ============================================================
-- Migration 049: E-mails transacionais
-- ------------------------------------------------------------
-- 1. email_templates: templates reutilizáveis (assunto neutro,
--    corpo com {{variáveis}}, sem dado sensível no assunto).
-- 2. email_logs: ESTENDE a tabela existente (migration 004) com
--    colunas de e-mail transacional + idempotência.
-- 3. Seed dos 21 templates (ON CONFLICT DO NOTHING — não
--    sobrescreve edições do admin).
-- Tudo idempotente.
-- ============================================================

-- ─── 1. email_templates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT UNIQUE NOT NULL,
  subject      TEXT NOT NULL,
  preheader    TEXT,
  body_text    TEXT NOT NULL,
  body_html    TEXT NOT NULL DEFAULT '',   -- vazio = Edge Function gera HTML a partir do body_text
  category     TEXT,                        -- account | plan | payment | support | clinical | session | diary
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Só admin gerencia templates (a Edge Function usa service role e ignora RLS)
DROP POLICY IF EXISTS "email_templates_admin" ON email_templates;
CREATE POLICY "email_templates_admin" ON email_templates
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─── 2. email_logs: estende a tabela existente (migration 004) ─────────────────
-- A tabela já existe com: user_id, content_id, email, subject, status, error, sent_at.
-- Adicionamos as colunas do fluxo transacional (todas IF NOT EXISTS).
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS to_email            TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS template_key        TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider            TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_message       TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_entity_type TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS related_entity_id   TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS idempotency_key     TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS metadata            JSONB DEFAULT '{}'::jsonb;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT now();

-- O FK antigo de user_id apontava para profiles(id). O fluxo transacional usa
-- o id do auth.users. Removemos o FK para aceitar ambos sem quebrar inserts.
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_user_id_fkey;

-- Idempotência: no máximo 1 log por idempotency_key (quando presente)
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_idempotency_key_idx
  ON email_logs(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_logs_status       ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_template_key ON email_logs(template_key);

-- RLS: usuário vê apenas os próprios logs; admin vê tudo.
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_logs_own_read" ON email_logs;
CREATE POLICY "email_logs_own_read" ON email_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "email_logs_admin_all" ON email_logs;
CREATE POLICY "email_logs_admin_all" ON email_logs
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ─── 3. Seed dos templates ────────────────────────────────────────────────────
-- Assuntos SEMPRE neutros (nada sensível). Conteúdo completo fica dentro da conta.
-- body_html vazio → a Edge Function gera o HTML de marca a partir do body_text.

INSERT INTO email_templates (template_key, subject, preheader, category, body_text) VALUES
('welcome',
 'Bem-vindo ao A Vida Não Colabora',
 'Sua conta foi criada com sucesso.',
 'account',
 $b$Olá, {{nome}}.

Sua conta no A Vida Não Colabora foi criada com sucesso.

Aqui você encontra um espaço para organizar pensamentos, registrar como está se sentindo, acompanhar sua evolução e acessar conteúdos de apoio ao autocuidado.

Para começar, você pode:

- ler artigos gratuitos;
- responder ao questionário básico;
- registrar seu primeiro diário de bem-estar;
- conhecer os recursos disponíveis no seu plano.

Acesse sua conta:
{{link_login}}

Com carinho,
Equipe A Vida Não Colabora$b$),

('email_confirmation',
 'Confirme seu e-mail',
 'Confirme seu e-mail para liberar o acesso completo.',
 'account',
 $b$Olá, {{nome}}.

Para proteger sua conta e liberar o acesso completo, confirme seu e-mail clicando no link abaixo:

{{link_confirmacao}}

Se você não criou uma conta no A Vida Não Colabora, ignore esta mensagem.

Equipe A Vida Não Colabora$b$),

('plan_activated',
 'Seu plano {{plano}} foi ativado',
 'Seu plano foi ativado com sucesso.',
 'plan',
 $b$Olá, {{nome}}.

Seu plano {{plano}} foi ativado com sucesso.

A partir de agora, você já pode acessar os recursos incluídos no seu plano.

Resumo do plano:
{{beneficios_do_plano}}

Você pode acompanhar sua assinatura em:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('plan_upgraded',
 'Seu plano foi atualizado',
 'Seu plano foi atualizado.',
 'plan',
 $b$Olá, {{nome}}.

Seu plano foi atualizado de {{plano_antigo}} para {{plano_novo}}.

Os novos recursos já estão disponíveis na sua conta.

Ver meu plano:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('plan_downgrade_scheduled',
 'Sua mudança de plano foi agendada',
 'Sua mudança de plano foi agendada.',
 'plan',
 $b$Olá, {{nome}}.

Recebemos sua solicitação para mudar do plano {{plano_atual}} para o plano {{plano_novo}}.

A mudança será aplicada ao final do ciclo atual, em {{data_fim_ciclo}}.

Até essa data, você continua com acesso aos recursos do plano {{plano_atual}}.

Ver detalhes da assinatura:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('plan_cancel_requested',
 'Seu cancelamento foi solicitado',
 'Recebemos sua solicitação de cancelamento.',
 'plan',
 $b$Olá, {{nome}}.

Recebemos sua solicitação de cancelamento.

Seu plano {{plano_atual}} continuará ativo até {{data_fim_ciclo}}. Depois dessa data, sua conta voltará para o plano Gratuito.

Caso tenha sido um engano, você pode desfazer o cancelamento antes do fim do ciclo:

{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('plan_returned_to_free',
 'Sua conta voltou para o plano Gratuito',
 'Seu ciclo foi encerrado.',
 'plan',
 $b$Olá, {{nome}}.

Seu ciclo do plano {{plano_anterior}} foi encerrado, e sua conta voltou para o plano Gratuito.

Você ainda pode acessar:

- artigos gratuitos;
- questionário básico;
- diário de bem-estar com até 5 entradas por mês;
- registro simples de humor;
- mini-desafios disponíveis para o plano Gratuito.

Para ver ou alterar seu plano:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('payment_confirmed',
 'Pagamento confirmado',
 'Confirmamos o pagamento do seu plano.',
 'payment',
 $b$Olá, {{nome}}.

Confirmamos o pagamento do seu plano {{plano}}.

Valor: {{valor}}
Data: {{data_pagamento}}
Ciclo atual: {{inicio_ciclo}} até {{fim_ciclo}}

Seu acesso aos recursos do plano está ativo.

Ver assinatura:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('payment_failed',
 'Não conseguimos confirmar seu pagamento',
 'Atualize seu pagamento para evitar interrupção.',
 'payment',
 $b$Olá, {{nome}}.

Não conseguimos confirmar o pagamento do seu plano {{plano}}.

Isso pode acontecer por limite do cartão, dados incorretos, vencimento ou recusa da operadora.

Atualize o pagamento para evitar interrupção dos recursos premium:

{{link_pagamento}}

Equipe A Vida Não Colabora$b$),

('support_reply',
 'Você recebeu uma resposta do suporte',
 'Sua solicitação de suporte recebeu uma resposta.',
 'support',
 $b$Olá, {{nome}}.

Sua solicitação de suporte recebeu uma resposta.

Você pode visualizar e responder pelo painel da sua conta:

{{link_suporte}}

Equipe A Vida Não Colabora$b$),

('guidance_answered',
 'Sua orientação mensal recebeu uma resposta',
 'Sua orientação recebeu uma resposta.',
 'clinical',
 $b$Olá, {{nome}}.

Sua orientação mensal recebeu uma resposta.

Para preservar sua privacidade, o conteúdo completo está disponível apenas dentro da sua conta.

Acessar orientação:
{{link_orientacoes}}

Equipe A Vida Não Colabora$b$),

('session_requested',
 'Recebemos sua solicitação de sessão',
 'Recebemos sua solicitação de sessão.',
 'session',
 $b$Olá, {{nome}}.

Recebemos sua solicitação de sessão mensal do plano Terapêutico Plus.

Nossa equipe irá analisar os horários enviados e confirmar a melhor opção disponível.

Acompanhar solicitação:
{{link_sessao_plus}}

Equipe A Vida Não Colabora$b$),

('session_scheduled',
 'Sua sessão foi agendada',
 'Sua sessão foi agendada.',
 'session',
 $b$Olá, {{nome}}.

Sua sessão mensal foi agendada.

Data: {{data_sessao}}
Horário: {{horario_sessao}}
Duração: 30 minutos
Profissional: {{nome_profissional}}

Link ou instruções:
{{link_sessao}}

Acompanhar sessão:
{{link_sessao_plus}}

Equipe A Vida Não Colabora$b$),

('session_rescheduled',
 'Sua sessão foi remarcada',
 'Sua sessão foi remarcada.',
 'session',
 $b$Olá, {{nome}}.

Sua sessão mensal foi remarcada.

Nova data: {{data_sessao}}
Novo horário: {{horario_sessao}}

Acompanhar sessão:
{{link_sessao_plus}}

Equipe A Vida Não Colabora$b$),

('session_cancelled',
 'Sua sessão foi cancelada',
 'Sua sessão foi cancelada.',
 'session',
 $b$Olá, {{nome}}.

Sua sessão mensal foi cancelada.

Você pode acompanhar as informações na sua área de sessão:

{{link_sessao_plus}}

Equipe A Vida Não Colabora$b$),

('monthly_report_available',
 'Seu relatório mensal está disponível',
 'Seu relatório mensal está disponível.',
 'clinical',
 $b$Olá, {{nome}}.

Seu relatório mensal já está disponível na área Minha Evolução.

Você pode acessar o resumo do período, acompanhar registros e visualizar os dados conforme os recursos do seu plano.

Acessar relatório:
{{link_relatorios}}

Equipe A Vida Não Colabora$b$),

('professional_comment_available',
 'Há um novo comentário disponível para você',
 'Há um novo comentário disponível.',
 'clinical',
 $b$Olá, {{nome}}.

Há um novo comentário disponível na sua área de evolução.

Para preservar sua privacidade, o conteúdo completo está disponível apenas dentro da sua conta.

Acessar comentário:
{{link_comentarios}}

Equipe A Vida Não Colabora$b$),

('self_care_plan_available',
 'Seu plano de autocuidado foi atualizado',
 'Seu plano de autocuidado foi atualizado.',
 'clinical',
 $b$Olá, {{nome}}.

Seu plano de autocuidado recebeu uma atualização.

Você pode acessar as sugestões e próximos passos diretamente na sua área Minha Evolução.

Acessar plano:
{{link_autocuidado}}

Equipe A Vida Não Colabora$b$),

('personalized_content_available',
 'Há uma nova recomendação para você',
 'Há uma nova recomendação para você.',
 'clinical',
 $b$Olá, {{nome}}.

Preparamos uma nova recomendação dentro da sua área Minha Evolução.

Para preservar sua privacidade, o conteúdo completo está disponível apenas dentro da sua conta.

Acessar conteúdo:
{{link_para_voce}}

Equipe A Vida Não Colabora$b$),

('diary_limit_warning',
 'Você está próximo do limite mensal do diário',
 'Você está próximo do limite mensal do diário.',
 'diary',
 $b$Olá, {{nome}}.

Você está próximo do limite mensal de registros do diário no plano Gratuito.

No plano Gratuito, é possível registrar até 5 entradas por mês.

Para continuar registrando sem limite, você pode conhecer os planos disponíveis:

{{link_meu_plano}}

Equipe A Vida Não Colabora$b$),

('diary_limit_reached',
 'Você atingiu o limite mensal do diário',
 'Você atingiu o limite mensal do diário.',
 'diary',
 $b$Olá, {{nome}}.

Você atingiu o limite mensal de registros do diário no plano Gratuito.

Você ainda pode acessar seus registros disponíveis e usar os demais recursos gratuitos.

Para registrar sem limite, conheça os planos disponíveis:

{{link_meu_plano}}

Equipe A Vida Não Colabora$b$)

ON CONFLICT (template_key) DO NOTHING;
