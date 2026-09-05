-- Revisão completa de comunicações automáticas e respostas prontas (set/2026).
-- Objetivos:
--   * remover promessas de funcionalidades aposentadas;
--   * alinhar nomes/regras atuais: Gratuito, Essencial e Plus;
--   * separar Check-in, Diário e Aprofundamentos;
--   * atualizar Relatórios, Mapa Emocional, Descobertas, Minha História,
--     Meu Jardim, Plano de Autocuidado e Orientação Mensal;
--   * desativar templates automáticos legados substituídos pelo motor selfcare_*;
--   * criar respostas de suporte para recursos que hoje não tinham modelo próprio.
-- Idempotente: UPDATE por chave/título e INSERT condicionado por NOT EXISTS.

-- ---------------------------------------------------------------------------
-- E-MAILS TRANSACIONAIS / AUTOMÁTICOS
-- ---------------------------------------------------------------------------

UPDATE email_templates SET
  subject = 'Boas-vindas ao A Vida Não Colabora',
  preheader = 'Sua conta está pronta. Comece no seu ritmo, com calma.',
  body_text = $b$Olá, {{nome}}. Que bom ter você aqui.

Sua conta no A Vida Não Colabora está pronta para uso.

Este é um espaço para registrar seus dias, perceber padrões e encontrar possibilidades de cuidado no seu próprio ritmo.

Um bom jeito de começar:

- faça o Check-in do dia para registrar como você está;
- escreva no Diário quando quiser colocar pensamentos e acontecimentos em palavras;
- explore os questionários e Conteúdos Guiados disponíveis no seu plano;
- conheça os recursos que fazem parte do seu plano.

Check-in e Diário são recursos diferentes: o Check-in é um registro rápido, uma vez por dia; o Diário é o espaço de escrita e reflexão.

Não existe jeito certo nem pressa. Vá no seu ritmo.

Acessar minha conta:
{{link_login}}

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'welcome';

UPDATE email_templates SET
  subject = 'Você está perto do limite mensal do Diário',
  preheader = 'No Gratuito, o Diário pode ser usado em até 5 dias com registros por mês.',
  body_text = $b$Olá, {{nome}}.

Você está perto do limite mensal do Diário no plano Gratuito.

No Gratuito, o Diário pode ser usado em até 5 dias com registros por mês. O Check-in diário continua sendo um recurso separado e pode ser feito uma vez por dia.

Se quiser usar o Diário sem limite mensal, você pode conhecer os planos disponíveis:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'diary_limit_warning';

UPDATE email_templates SET
  subject = 'Você chegou ao limite mensal do Diário',
  preheader = 'O limite do Diário no Gratuito foi atingido neste mês.',
  body_text = $b$Olá, {{nome}}.

Você chegou ao limite mensal do Diário no plano Gratuito: até 5 dias com registros por mês.

Seus registros anteriores continuam disponíveis e o Check-in diário continua sendo um recurso separado, uma vez por dia.

Para usar o Diário sem limite mensal, conheça os planos disponíveis:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'diary_limit_reached';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Seu ciclo do plano {{plano_anterior}} foi encerrado e sua conta voltou para o plano Gratuito. Seus dados e registros foram preservados.

No Gratuito, você continua com acesso a recursos para começar a se observar, incluindo:

- Check-in diário, uma vez por dia;
- Diário emocional em até 5 dias com registros por mês;
- Diário por voz;
- questionários selecionados para o Gratuito;
- visão inicial da Minha História;
- seleção de Conteúdos Guiados;
- artigos e conteúdos disponíveis no plano.

Para ver ou alterar seu plano:
{{link_meu_plano}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'plan_returned_to_free';

UPDATE email_templates SET
  subject = 'Seu relatório semanal está disponível',
  preheader = 'Veja uma leitura organizada da sua semana dentro da sua conta.',
  body_text = $b$Olá, {{nome}}.

Seu Relatório Semanal está disponível.

Ele organiza os principais pontos que apareceram nos seus registros da semana para ajudar você a acompanhar mudanças e padrões com mais clareza.

O conteúdo completo fica dentro da sua conta para preservar sua privacidade.

Acessar relatório:
{{link_relatorio}}

Este recurso é um apoio ao autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico ou médico.

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'weekly_report_available';

UPDATE email_templates SET
  subject = 'Seu Relatório Mensal Aprofundado está disponível',
  preheader = 'Veja o que o último mês mostrou sobre sua trajetória.',
  body_text = $b$Olá, {{nome}}.

Seu Relatório Mensal Aprofundado está disponível.

Ele reúne uma leitura do período sobre padrões, mudanças, conexões e momentos importantes identificados a partir dos seus registros.

Para preservar sua privacidade, o conteúdo completo fica apenas dentro da sua conta.

Acessar relatório:
{{link_relatorios}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'monthly_report_available';

UPDATE email_templates SET
  subject = 'Seu Plano de Autocuidado do mês está disponível',
  preheader = 'Veja possibilidades de cuidado conectadas ao seu momento.',
  body_text = $b$Olá, {{nome}}.

Seu Plano de Autocuidado Mensal está disponível.

Ele transforma o que apareceu nos seus registros em pequenas possibilidades de cuidado para o próximo período, com foco, ações práticas e pontos para observar no seu ritmo.

Acessar Plano de Autocuidado:
{{link_autocuidado}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'self_care_plan_available';

UPDATE email_templates SET
  subject = 'Sua Orientação Mensal recebeu uma resposta',
  preheader = 'Sua resposta está disponível dentro da sua conta.',
  body_text = $b$Olá, {{nome}}.

Sua Orientação Mensal recebeu uma resposta.

Para preservar sua privacidade, o conteúdo completo está disponível apenas dentro da sua conta.

Acessar Orientação Mensal:
{{link_orientacoes}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'guidance_answered';

UPDATE email_templates SET
  subject = 'Há um novo conteúdo preparado para você',
  preheader = 'Veja a recomendação dentro da sua conta.',
  body_text = $b$Olá, {{nome}}.

Há uma nova recomendação personalizada disponível para você.

Para preservar sua privacidade, os detalhes ficam apenas dentro da sua conta. As recomendações são sugestões de apoio ao autoconhecimento e podem ser ajustadas conforme suas preferências.

Acessar conteúdo:
{{link_para_voce}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'personalized_content_available';

UPDATE email_templates SET
  subject = 'Conheça o plano Essencial, no seu ritmo',
  preheader = 'Mais recursos para visualizar e entender seus padrões, quando fizer sentido.',
  body_text = $b$Olá, {{nome}}.

Que bom ter você usando seu espaço por aqui.

Se em algum momento fizer sentido, o plano Essencial amplia a experiência com Diário sem limite mensal, Mapa Emocional completo, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e Conteúdos Guiados completos.

Sem pressa: você pode continuar no Gratuito pelo tempo que quiser.

Conhecer o Essencial:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'value_essential_invite';

UPDATE email_templates SET
  subject = 'Veja como seu mês foi se formando',
  preheader = 'Seu Mapa Emocional ajuda a visualizar como seus registros se distribuíram.',
  body_text = $b$Olá, {{nome}}.

Seu Mapa Emocional ajuda a visualizar como emoções, contextos e outros sinais registrados foram se distribuindo ao longo do período.

Você pode observar com calma, sem conclusões automáticas e no seu ritmo.

Ver meu Mapa Emocional:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este e-mail é um apoio ao autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'value_evolution_summary';

UPDATE email_templates SET
  subject = 'Você pode enviar sua Orientação Mensal',
  preheader = 'Escolha uma questão importante do seu momento e organize seus próximos passos.',
  body_text = $b$Olá, {{nome}}.

Se fizer sentido, você pode enviar sua Orientação Mensal deste mês.

No plano Plus, você escolhe uma questão importante do seu momento e o tipo de apoio que procura. Depois da solicitação, a resposta fica disponível na sua conta em até 7 dias corridos.

A solicitação pode ser enviada até o dia 23 de cada mês.

Enviar Orientação Mensal:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Este recurso é um apoio ao autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'value_guidance_reminder';

-- Recursos aposentados ou substituídos por uma automação mais atual.
UPDATE email_templates SET is_active = false, updated_at = now()
WHERE template_key IN (
  'professional_comment_available',
  'checkin_reminder',
  'reengagement_inactive'
);

-- ---------------------------------------------------------------------------
-- RESPOSTAS PRONTAS DE SUPORTE / E-MAIL ADMINISTRATIVO
-- ---------------------------------------------------------------------------

UPDATE support_reply_templates SET
  body = $b$Olá! Hoje temos 3 planos:

Gratuito (R$ 0): Check-in diário, Diário emocional em até 5 dias com registros por mês, Diário por voz, questionários e Conteúdos Guiados selecionados, visão inicial da Minha História e artigos disponíveis no plano.

Essencial (R$ 19,90/mês): tudo do Gratuito, com Diário sem limite mensal, Mapa Emocional completo, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e Conteúdos Guiados completos.

Plus (R$ 39,90/mês): tudo do Essencial, mais Aprofundamentos do Diário (até 3 por dia), questionários do Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.

Se quiser, posso te ajudar a entender qual deles combina melhor com o que você quer usar.$b$,
  updated_at = now()
WHERE title = 'Diferença entre os planos';

UPDATE support_reply_templates SET
  body = $b$O plano Gratuito é uma forma de começar sem compromisso. Ele inclui Check-in diário, Diário emocional em até 5 dias com registros por mês, Diário por voz, uma seleção de questionários e Conteúdos Guiados, visão inicial da Minha História e artigos disponíveis no plano.$b$,
  updated_at = now()
WHERE title = 'Plano Gratuito';

UPDATE support_reply_templates SET
  body = $b$O plano Essencial custa R$ 19,90 por mês e é voltado para quem quer visualizar e entender melhor seus padrões. Ele inclui tudo do Gratuito e acrescenta Diário sem limite mensal, Mapa Emocional completo, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e Conteúdos Guiados completos.$b$,
  updated_at = now()
WHERE title = 'Plano Essencial';

UPDATE support_reply_templates SET
  body = $b$O plano Plus custa R$ 39,90 por mês e inclui tudo do Essencial. Ele acrescenta Aprofundamentos do Diário (até 3 por dia), questionários disponíveis para o Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.$b$,
  updated_at = now()
WHERE title = 'Plano Plus';

UPDATE support_reply_templates SET
  body = $b$Para escolher, pense no que você quer fazer agora.

Se quer começar a registrar e se observar, o Gratuito já oferece os recursos iniciais.

Se quer visualizar e entender padrões ao longo do tempo, o Essencial acrescenta Mapa Emocional, Descobertas, Relatório Semanal, Meu Jardim e experiência completa da Minha História.

Se quer aprofundar os registros e transformar o que percebe em possibilidades de cuidado, o Plus acrescenta Aprofundamentos, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.$b$,
  updated_at = now()
WHERE title = 'Qual plano escolher';

UPDATE support_reply_templates SET
  body = $b$Seus registros no Diário, Check-ins, respostas de questionários e relatórios são informações pessoais.

Esses dados podem ser usados dentro da plataforma para gerar visualizações, organizar sua trajetória e oferecer recursos personalizados conforme as funcionalidades do seu plano e as preferências disponíveis.

O conteúdo sensível permanece protegido dentro da sua conta. A plataforma não apresenta Comentário profissional como funcionalidade ativa dos planos atuais.$b$,
  updated_at = now()
WHERE title = 'Privacidade dos registros';

UPDATE support_reply_templates SET
  is_active = false,
  updated_at = now()
WHERE title = 'Comentário sobre relatório do mês';

UPDATE support_reply_templates SET
  title = 'Atendimento ao assinante Plus',
  body = $b$Olá! Vi que você utiliza o plano Plus. Vou considerar os recursos disponíveis nesse plano ao analisar sua solicitação e te orientar da forma mais adequada.

Se a dúvida estiver relacionada a Relatório Mensal Aprofundado, Plano de Autocuidado, Aprofundamentos do Diário ou Orientação Mensal, pode me dizer em qual etapa você encontrou dificuldade.$b$,
  updated_at = now()
WHERE title = 'Atendimento ao assinante Plus';

UPDATE support_reply_templates SET
  body = $b$A Orientação Mensal é um recurso do plano Plus.

Uma vez por mês, você pode escolher uma questão importante do seu momento, indicar o tipo de apoio que procura e enviar a solicitação até o dia 23. A resposta fica disponível na sua conta em até 7 dias corridos.

A Orientação Mensal é um apoio ao autoconhecimento e à organização de próximos passos. Ela não substitui acompanhamento psicológico, psiquiátrico ou médico.$b$,
  updated_at = now()
WHERE title = 'Orientação mensal por mensagem';

UPDATE support_reply_templates SET
  body = $b$Olá, {{nome}}.

Aqui vão alguns primeiros passos para conhecer o A Vida Não Colabora:

1. Faça o Check-in do dia para registrar como você está.
2. Use o Diário quando quiser escrever sobre pensamentos, sentimentos e acontecimentos.
3. Explore os questionários, artigos e Conteúdos Guiados disponíveis no seu plano.
4. Consulte Meu Plano para ver quais recursos estão liberados para você.

Recursos como Mapa Emocional, Descobertas, Relatórios e Meu Jardim dependem do plano contratado.

Se precisar de ajuda, é só responder este e-mail.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE title = 'Como começar a usar';

UPDATE support_reply_templates SET
  body = $b$Olá! O A Vida Não Colabora é um espaço de apoio ao autoconhecimento e à organização emocional.

Você pode fazer Check-ins, escrever no Diário, responder questionários, ler conteúdos e, conforme o seu plano, usar recursos como Mapa Emocional, Descobertas, Minha História, Relatórios, Meu Jardim, Plano de Autocuidado e Orientação Mensal.

A proposta não é oferecer diagnóstico nem substituir acompanhamento profissional, e sim ajudar você a registrar sua experiência, perceber padrões e organizar possibilidades de cuidado.$b$,
  updated_at = now()
WHERE title = 'Como o blog funciona';

-- Modelos novos de suporte: só cria se ainda não existir um título equivalente.
INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Check-in e Diário: qual a diferença?', 'Uso do site', NULL,
$b$O Check-in e o Diário são recursos diferentes.

O Check-in é um registro rápido do dia e pode ser feito uma vez por dia.

O Diário é o espaço de escrita e reflexão. No plano Gratuito, ele pode ser usado em até 5 dias com registros por mês. Nos planos Essencial e Plus, não há limite mensal de dias com registros no Diário.

No Plus, o Diário também permite até 3 Aprofundamentos por dia.$b$, 'both', true, true
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Check-in e Diário: qual a diferença?');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Aprofundamentos do Diário', 'Uso do site', NULL,
$b$Os Aprofundamentos são extensões do Diário disponíveis no plano Plus.

Depois do registro principal do dia, você pode voltar e acrescentar novos momentos, pensamentos ou sentimentos, sem criar um novo Check-in. O limite é de até 3 Aprofundamentos por dia.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Aprofundamentos do Diário');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Mapa Emocional', 'Funcionalidades', NULL,
$b$O Mapa Emocional responde principalmente à pergunta: “Como meus registros se distribuíram?”.

Ele ajuda a visualizar a evolução dos registros, emoções, contextos, sintomas e conexões ao longo do período. O acesso completo está disponível nos planos Essencial e Plus.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Mapa Emocional');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Descobertas', 'Funcionalidades', NULL,
$b$Descobertas ajuda a perceber o que está se repetindo nos seus registros.

Ela organiza padrões, repetições, conexões e destaques de forma exploratória, sem afirmar causas ou diagnósticos. Está disponível nos planos Essencial e Plus.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Descobertas');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Minha História', 'Funcionalidades', NULL,
$b$Minha História organiza sua trajetória ao longo do tempo, reunindo períodos, marcos, mudanças, temas recorrentes e momentos importantes.

O Gratuito oferece uma visão inicial. Essencial e Plus têm a experiência completa, com uma leitura mais ampla da trajetória.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Minha História');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Meu Jardim', 'Funcionalidades', NULL,
$b$Meu Jardim é uma representação visual da sua jornada de cuidado. Ele cresce com usos significativos da plataforma, como dias ativos no Diário, relatórios e marcos pessoais.

Não há sequência obrigatória, punição por pausas, ranking, XP ou perda de progresso. O Jardim está disponível nos planos Essencial e Plus.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Meu Jardim');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Relatório Semanal e Relatório Mensal', 'Funcionalidades', NULL,
$b$Os relatórios têm objetivos diferentes.

O Relatório Semanal organiza como foi sua semana e está disponível no Essencial e no Plus. O ciclo fecha no sábado e o relatório fica disponível a partir do domingo.

O Relatório Mensal Aprofundado está disponível no Plus. Ele fecha no último dia do mês e fica disponível no primeiro dia do mês seguinte, trazendo uma leitura mais ampla sobre padrões, mudanças e conexões do período.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Relatório Semanal e Relatório Mensal');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Plano de Autocuidado Mensal', 'Funcionalidades', NULL,
$b$O Plano de Autocuidado Mensal é um recurso do Plus que transforma o que apareceu nos seus registros em pequenas possibilidades de cuidado para o próximo período.

Ele pode incluir um foco do período, ações pequenas, uma ação principal e pontos para observar. Os planos anteriores ficam preservados no histórico.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Plano de Autocuidado Mensal');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Orientação Mensal: prazos e funcionamento', 'Orientação mensal', NULL,
$b$A Orientação Mensal está disponível no Plus, uma vez por mês.

A solicitação pode ser enviada até o dia 23. Você escolhe uma questão importante do seu momento e o tipo de apoio que procura. A resposta é disponibilizada em até 7 dias corridos e o histórico fica organizado por mês.

Ela é um apoio ao autoconhecimento e não substitui acompanhamento clínico.$b$, 'both', true, true
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Orientação Mensal: prazos e funcionamento');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Confirmação de e-mail', 'Conta', 'Confirme seu e-mail para acessar sua conta',
$b$Olá, {{nome}}.

Novas contas precisam confirmar o endereço de e-mail antes de concluir o acesso. Verifique a caixa de entrada e também Spam/Lixo eletrônico.

Se o link não chegar ou não funcionar, volte à tela de login/cadastro e use a opção de reenviar a confirmação.

Se ainda precisar de ajuda, responda este e-mail informando o endereço usado no cadastro.

Com cuidado,
Equipe A Vida Não Colabora$b$, 'user_email', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Confirmação de e-mail');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Mudança de plano', 'Assinatura', 'Sobre sua mudança de plano',
$b$Olá, {{nome}}.

Upgrades são aplicados assim que a alteração é concluída, seguindo as regras de cobrança apresentadas no fluxo de assinatura.

Downgrades são programados para a próxima renovação, mantendo os recursos do plano atual até o fim do ciclo em andamento.

Você pode acompanhar a situação em:
{{meu_plano_url}}

Com cuidado,
Equipe A Vida Não Colabora$b$, 'user_email', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Mudança de plano');

INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT 'Dados preservados após downgrade ou cancelamento', 'Assinatura', NULL,
$b$Ao fazer downgrade ou encerrar um plano pago, seus registros e dados pessoais não são apagados automaticamente.

O que muda é o acesso às funcionalidades conforme o plano que ficar ativo. Se voltar a um plano que inclui determinado recurso, os dados compatíveis continuam vinculados à sua conta.$b$, 'both', true, false
WHERE NOT EXISTS (SELECT 1 FROM support_reply_templates WHERE title = 'Dados preservados após downgrade ou cancelamento');
