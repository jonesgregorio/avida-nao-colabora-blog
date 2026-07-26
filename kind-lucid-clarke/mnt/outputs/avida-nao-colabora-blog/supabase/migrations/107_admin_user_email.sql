-- ============================================================================
-- 107 — Enviar e-mail para o usuário (Admin > Usuários > Ver detalhes)
-- ============================================================================
-- Objetivo: o admin escolhe um MODELO já existente do Suporte, edita e envia um
-- e-mail real para o usuário. Reaproveitamos toda a infra existente:
--   • envio ............. Edge Function send-transactional-email (Resend + log)
--   • modelos ........... tabela support_reply_templates (a mesma do Suporte)
--   • histórico ......... tabela email_logs (nada de tabela nova)
--
-- Nada é removido nem quebrado. Tudo aqui é ADITIVO e idempotente.
-- ============================================================================

-- 1. Modelos do Suporte ganham campos opcionais para servir também como e-mail.
--    • subject: assunto sugerido (o Suporte só usa o corpo; para e-mail damos um
--      assunto). Nulo = o app cai no título do modelo.
--    • usage_context: onde o modelo aparece — 'support' (só ticket), 'user_email'
--      (só e-mail admin) ou 'both'. Padrão 'both' → todos os modelos EXISTENTES
--      continuam aparecendo no Suporte exatamente como antes.
ALTER TABLE support_reply_templates ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE support_reply_templates ADD COLUMN IF NOT EXISTS usage_context TEXT NOT NULL DEFAULT 'both';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_reply_templates_usage_context_chk'
  ) THEN
    ALTER TABLE support_reply_templates
      ADD CONSTRAINT support_reply_templates_usage_context_chk
      CHECK (usage_context IN ('support', 'user_email', 'both'));
  END IF;
END $$;

-- 2. Template genérico de e-mail administrativo. O admin escreve assunto e corpo
--    livremente; enviamos como variáveis {{assunto}}/{{corpo}}. Assim reusamos a
--    renderização/branding/log da Edge Function sem duplicar nada nem criar um
--    provedor de e-mail novo. Categoria 'account' → NÃO leva disclaimer clínico.
INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('admin_custom_message',
   '{{assunto}}',
   '',
   '{{corpo}}',
   '', 'account', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject, body_text = EXCLUDED.body_text,
  category = EXCLUDED.category, is_active = true, updated_at = now();

-- 3. Modelos iniciais para o e-mail administrativo (não substituem os do Suporte).
--    usage_context='user_email' → aparecem SÓ na ferramenta de e-mail do admin,
--    mantendo o seletor de resposta do ticket limpo. Guardados por NOT EXISTS
--    (support_reply_templates não tem unique em title) para serem idempotentes.
--    Linguagem acolhedora e profissional — sem termos clínicos/terapêuticos.
INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active)
SELECT v.title, v.category, v.subject, v.body, 'user_email', true
FROM (VALUES
  ('Boas-vindas',
   'Conta',
   'Bem-vindo ao A Vida Não Colabora',
   E'Olá, {{nome}}.\n\nQue bom ter você no A Vida Não Colabora. Estamos aqui para apoiar sua rotina de autoconhecimento e organização emocional, no seu tempo.\n\nSempre que precisar, é só acessar sua conta ou responder este e-mail.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Ajuda com acesso',
   'Conta',
   'Ajuda com seu acesso',
   E'Olá, {{nome}}.\n\nRecebemos sua mensagem sobre o acesso à conta. Estamos aqui para ajudar você a entrar novamente.\n\nSe o problema continuar, responda este e-mail contando o que aparece na tela que a gente resolve junto.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Atualização sobre assinatura',
   'Assinatura',
   'Atualização sobre sua assinatura',
   E'Olá, {{nome}}.\n\nEstamos entrando em contato sobre a sua assinatura no A Vida Não Colabora. Seu plano atual é: {{plano}}.\n\nQualquer dúvida sobre o seu plano, você pode acessar {{meu_plano_url}} ou responder este e-mail.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Informações sobre pagamento',
   'Pagamento',
   'Informações sobre pagamento',
   E'Olá, {{nome}}.\n\nEstamos entrando em contato com informações sobre o pagamento da sua assinatura.\n\nSe tiver qualquer dúvida, responda este e-mail ou acesse {{meu_plano_url}}. Ficamos felizes em ajudar.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Como começar a usar',
   'Conta',
   'Como começar a usar o A Vida Não Colabora',
   E'Olá, {{nome}}.\n\nAqui vão alguns primeiros passos para aproveitar o A Vida Não Colabora:\n\n1. Faça seu check-in emocional do dia.\n2. Explore os conteúdos guiados.\n3. Acompanhe seu mapa emocional ao longo do tempo.\n\nSe precisar de ajuda, é só responder este e-mail.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Informações sobre seu plano',
   'Assinatura',
   'Informações sobre seu plano',
   E'Olá, {{nome}}.\n\nQueremos manter você informado(a) sobre o seu plano no A Vida Não Colabora. Seu plano atual é: {{plano}}.\n\nPara ver os detalhes ou ajustar, acesse {{meu_plano_url}}. Qualquer dúvida, é só responder este e-mail.\n\nCom cuidado,\nEquipe A Vida Não Colabora'),
  ('Mensagem da equipe',
   'Geral',
   'Mensagem da equipe A Vida Não Colabora',
   E'Olá, {{nome}}.\n\n[Escreva aqui a sua mensagem personalizada para o usuário.]\n\nCom cuidado,\nEquipe A Vida Não Colabora')
) AS v(title, category, subject, body)
WHERE NOT EXISTS (
  SELECT 1 FROM support_reply_templates s WHERE s.title = v.title
);
