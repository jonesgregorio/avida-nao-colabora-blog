-- ============================================================================
-- 075 — Novos templates de e-mail (lacunas do modelo atual)
-- ============================================================================
-- Complementa os 21 templates da 049 com envios úteis ao produto de 3 planos:
-- relatório semanal, novo conteúdo, lembrete de check-in, reengajamento,
-- cartão a vencer e fim de teste. body_html vazio = a Edge Function gera o HTML.
-- Idempotente por template_key (UNIQUE) → ON CONFLICT DO NOTHING.
-- ============================================================================

INSERT INTO email_templates (template_key, subject, preheader, body_text, category, is_active) VALUES

('weekly_report_available',
 'Seu relatório semanal está pronto',
 'Um resumo do seu diário e do seu mapa emocional na semana.',
'Olá, {{nome}}!

Seu relatório semanal já está disponível. Ele reúne um resumo dos seus registros no diário e do seu mapa emocional nos últimos dias, para você acompanhar seus padrões com mais clareza.

Acesse quando quiser, no seu ritmo.

{{link_relatorio}}

Este conteúdo é um apoio ao seu autoconhecimento.',
 'clinical', true),

('new_content_published',
 'Novo conteúdo para você: {{titulo}}',
 'Publicamos algo novo que pode fazer sentido para o seu momento.',
'Olá, {{nome}}!

Acabamos de publicar um novo conteúdo: {{titulo}}.

{{resumo}}

Se quiser dar uma olhada, o conteúdo completo está no site.

{{link_conteudo}}',
 'account', true),

('checkin_reminder',
 'Como você está hoje?',
 'Um momento rápido para registrar como você se sente.',
'Olá, {{nome}}!

Que tal reservar um minutinho para registrar como você está se sentindo hoje? Anotar o seu momento ajuda a perceber padrões e a cuidar de você com mais gentileza.

{{link_diario}}

Sem pressa e sem cobrança: um registro simples já vale.',
 'diary', true),

('reengagement_inactive',
 'Seu espaço continua aqui',
 'Quando quiser voltar, é no seu ritmo.',
'Olá, {{nome}}!

Faz um tempo que a gente não te vê por aqui, e tudo bem: cada pessoa tem o seu ritmo. Se quiser retomar, seu diário, seus registros e seus conteúdos continuam esperando por você.

{{link_site}}

Um passo de cada vez.',
 'account', true),

('card_expiring',
 'Seu cartão está perto de vencer',
 'Atualize seus dados para manter seu plano sem interrupções.',
'Olá, {{nome}}!

Notamos que o cartão cadastrado para o seu plano {{plano}} está próximo do vencimento. Para evitar qualquer interrupção no seu acesso, atualize seus dados de pagamento quando puder.

{{link_meu_plano}}

Qualquer dúvida, é só responder este e-mail.',
 'payment', true),

('trial_ending',
 'Seu período de teste está terminando',
 'Continue com seu plano para não perder o acesso.',
'Olá, {{nome}}!

Seu período de teste do plano {{plano}} está chegando ao fim em {{data_fim_teste}}. Se quiser continuar com todos os recursos, basta manter sua assinatura ativa.

{{link_meu_plano}}

Se tiver qualquer dúvida sobre os planos, a gente ajuda.',
 'plan', true)

ON CONFLICT (template_key) DO NOTHING;
