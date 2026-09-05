-- Fechamento da revisão de comunicação: remove a última menção nominal a uma
-- funcionalidade aposentada e evita duplicar o aviso clínico já incluído
-- automaticamente pelo renderer de e-mail para a categoria `clinical`.

UPDATE support_reply_templates SET
  body = $b$Seus registros no Diário, Check-ins, respostas de questionários e relatórios são informações pessoais.

Esses dados podem ser usados dentro da plataforma para gerar visualizações, organizar sua trajetória e oferecer recursos personalizados conforme as funcionalidades do seu plano e as preferências disponíveis.

O conteúdo sensível permanece protegido dentro da sua conta. Os recursos disponíveis são sempre os apresentados no seu plano atual.$b$,
  updated_at = now()
WHERE title = 'Privacidade dos registros';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Seu Relatório Semanal está disponível.

Ele organiza os principais pontos que apareceram nos seus registros da semana para ajudar você a acompanhar mudanças e padrões com mais clareza.

O conteúdo completo fica dentro da sua conta para preservar sua privacidade.

Acessar relatório:
{{link_relatorio}}

Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'weekly_report_available';
