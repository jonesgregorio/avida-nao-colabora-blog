-- Complemento da revisão de e-mails: reduz conteúdo potencialmente sensível em
-- caixa de entrada e remove detalhes que podem ficar desatualizados.

-- O alerta administrativo não deve carregar motivo/comentário livre no e-mail.
-- O detalhe continua disponível, autenticado, dentro do Admin.
UPDATE email_templates SET
  subject = 'Novo pedido de cancelamento para revisar',
  preheader = 'Há um novo pedido de cancelamento aguardando análise.',
  body_text = $b$Há um novo pedido de cancelamento aguardando análise.

Usuário: {{usuario}}
Plano: {{plano}}

Por privacidade, motivos e comentários ficam disponíveis apenas dentro do painel administrativo.

Revisar pedido:
{{link_admin}}$b$,
  updated_at = now()
WHERE template_key = 'admin_cancellation_alert';

-- Conteúdo editorial pode revelar um tema emocional no assunto/preheader. Mantemos
-- o e-mail neutro e deixamos título/resumo somente dentro do site.
UPDATE email_templates SET
  subject = 'Há um novo conteúdo disponível',
  preheader = 'Veja as novidades dentro da sua conta.',
  body_text = $b$Olá, {{nome}}.

Há um novo conteúdo disponível para você no A Vida Não Colabora.

Para preservar sua privacidade, o tema e os detalhes ficam dentro do site.

Ver conteúdo:
{{link_conteudo}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'new_content_published';

UPDATE email_templates SET
  subject = 'Há uma nova recomendação de conteúdo',
  preheader = 'Veja a recomendação dentro da sua conta.',
  body_text = $b$Olá, {{nome}}.

Há uma nova recomendação de conteúdo disponível para você.

Para preservar sua privacidade, o título, o tema e os detalhes ficam apenas dentro da sua conta.

Ver recomendação:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'value_content_recommendation';

-- Evita duplicar/engessar uma lista de recursos no e-mail de ativação: a fonte
-- atualizada de benefícios continua em Meu Plano.
UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Seu plano {{plano}} foi ativado com sucesso e os recursos correspondentes já estão disponíveis na sua conta.

Você pode consultar a lista atualizada de funcionalidades e acompanhar sua assinatura em:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'plan_activated';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Sua alteração agendada foi desfeita e seu plano {{plano_atual}} continua ativo normalmente, sem interrupção.

Ver detalhes da assinatura:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'plan_reactivated';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Não conseguimos confirmar o pagamento do seu plano {{plano}}.

Isso pode acontecer por diferentes motivos, como limite, vencimento, dados do meio de pagamento ou recusa da operadora.

Atualize os dados de pagamento para evitar interrupção dos recursos do seu plano:
{{link_pagamento}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'payment_failed';
