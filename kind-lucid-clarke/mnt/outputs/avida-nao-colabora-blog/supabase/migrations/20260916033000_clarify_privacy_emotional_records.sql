-- Clarifica a política de privacidade sem reduzir a transparência exigida sobre
-- categorias de dados tratadas. O objetivo é deixar explícito que registros
-- emocionais são privados da conta e não viram conteúdo público.

update public.site_pages
set
  title = 'Política de Privacidade',
  body_md = $md$**Última atualização: Setembro de 2026**

Sua privacidade é fundamental para nós. Os registros pessoais que você cria no **A Vida Não Colabora** ficam vinculados à sua conta para que as funcionalidades escolhidas por você possam funcionar. **Eles não são publicados no site nem ficam disponíveis para outros usuários.** Esta política explica, com transparência, quando o sistema precisa armazenar ou processar informações e quais proteções se aplicam a elas.

## 1. Dados vinculados à sua conta

- **Dados de conta:** nome, e-mail, preferências e informações de perfil. A autenticação e a senha são gerenciadas pelo Supabase Auth; o aplicativo não recebe sua senha em texto legível para armazenamento.
- **Registros que você decide criar:** conteúdo do diário, check-ins e respostas inseridas por você. Esses registros permanecem associados à sua conta e não se tornam conteúdo público.
- **Informações geradas para você:** resultados de questionários, mapa emocional, relatórios, planos de autocuidado e orientações, quando disponíveis no seu plano.
- **Dados de uso e comunicação necessários à operação:** funcionalidades utilizadas, notificações, preferências de e-mail, tickets de suporte e histórico relacionado ao funcionamento do serviço.
- **Dados de assinatura e cobrança:** informações necessárias para identificar o plano e acompanhar pagamentos. Os dados completos do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.

## 2. Por que tratamos esses dados

- Para autenticar sua conta, manter o serviço seguro e disponibilizar as funcionalidades do seu plano.
- Para salvar e exibir a você os registros e históricos que você escolheu criar.
- Para gerar recursos privados da sua conta, como visualizações, relatórios, recomendações e planos, conforme a funcionalidade e o plano.
- Para responder solicitações de suporte, administrar preferências de comunicação e melhorar a operação do serviço.
- Para processar e acompanhar assinaturas e pagamentos de forma segura.

## 3. Como os dados são usados

Usamos seus dados para operar, proteger e entregar as funcionalidades que você utiliza. **Não vendemos ou alugamos seus dados pessoais a anunciantes e seus desabafos não são publicados como artigos ou conteúdo público.**

Alguns recursos de inteligência artificial podem processar o contexto necessário para produzir funcionalidades privadas da sua conta, como relatórios, planos e recomendações. O processamento é limitado à finalidade do recurso acionado e segue os controles definidos no backend.

O comentário individual de um profissional sobre o relatório mensal foi **descontinuado como recurso ativo do produto**. Comentários enviados no passado continuam preservados para consulta e exportação, sem que isso represente acesso livre ou rotineiro da equipe ao seu diário completo.

## 4. Armazenamento, segurança e retenção

O aplicativo utiliza Supabase para autenticação, banco de dados e armazenamento e Vercel para hospedagem da aplicação web. As conexões de produção utilizam HTTPS. Pagamentos são processados pelo Stripe, e o aplicativo não armazena os dados completos do seu cartão.

Enquanto sua conta estiver ativa, conservamos os dados necessários para prestar o serviço e manter os históricos que você utiliza. Ao concluir a exclusão por autoatendimento, removemos a conta e os dados pessoais vinculados ao aplicativo. Prestadores externos podem conservar registros próprios quando isso for necessário para segurança, prevenção a fraude, auditoria ou cumprimento de obrigação legal, conforme as políticas e prazos aplicáveis a cada prestador.

## 5. Prestadores e compartilhamento necessário

Para operar o serviço, podemos utilizar os seguintes prestadores conforme a funcionalidade:

- **Supabase:** autenticação, banco de dados, armazenamento e funções de backend.
- **Vercel:** hospedagem e entrega da aplicação web.
- **Stripe:** processamento e gestão de assinaturas e pagamentos.
- **Resend e infraestrutura de e-mail configurada:** envio de comunicações transacionais e outras mensagens permitidas pelas suas preferências.
- **Provedores de inteligência artificial configurados no backend**, como Google Gemini, Groq e, quando habilitado, OpenAI: processamento do contexto necessário para funcionalidades de IA.
- **Autoridades ou terceiros legitimados:** quando houver obrigação legal ou ordem válida aplicável.

O uso de prestadores não transforma seus registros em conteúdo público. O acesso técnico é limitado ao necessário para operar, proteger e entregar as funcionalidades da plataforma.

## 6. Seus direitos e controles de privacidade

Nos termos da legislação aplicável, você pode exercer direitos relacionados aos seus dados, incluindo:

- Acessar os dados vinculados à sua conta e obter uma cópia em formato legível.
- Corrigir informações incompletas, inexatas ou desatualizadas.
- Solicitar eliminação, anonimização ou outras medidas quando aplicáveis.
- Revogar consentimentos e ajustar preferências de comunicação quando o tratamento depender dessa escolha.
- Solicitar informações sobre o tratamento e a portabilidade nos casos previstos em lei.

Usuários autenticados podem usar **Meu perfil → Privacidade e seus dados** para baixar uma cópia dos dados da conta ou iniciar a exclusão definitiva. A exclusão exige confirmação adicional com a senha atual.

## 7. Registros emocionais — confidencialidade

**O que você escreve é tratado como informação privada da sua conta.**

Diário, check-ins e demais registros emocionais não são áreas públicas nem caixas de leitura livre para a equipe. Eles são protegidos por controles de acesso e podem ser processados automaticamente quando isso é necessário para entregar uma funcionalidade da sua própria conta.

## 8. Como falar sobre privacidade

Para dúvidas, solicitações adicionais ou exercício de direitos que não estejam disponíveis no autoatendimento, utilize a página de contato ou o formulário de suporte da plataforma. Assim sua solicitação fica registrada e pode ser acompanhada pela equipe.$md$,
  updated_at = now()
where slug = 'privacidade';
