-- ============================================================================
-- Respostas prontas do Suporte — voz humana, leve e coerente com a marca
-- ============================================================================
-- Objetivos:
--   • revisar os modelos ativos mais usados pelo Admin;
--   • evitar respostas frias, clínicas, culpabilizantes ou excessivamente técnicas;
--   • deixar cada resposta completa o bastante para resolver a dúvida sem exigir
--     várias mensagens adicionais quando a informação já é conhecida;
--   • manter o tom da marca: acolhedor, claro, sem pressão e sem promessas clínicas;
--   • criar modelos para lacunas operacionais comuns do suporte.
--
-- Esta migration altera apenas textos/metadados de support_reply_templates.
-- Não lê nem altera Diário, Check-ins, questionários, relatórios ou dados pessoais.
-- ============================================================================

-- Normaliza contexto dos modelos usados dentro do ticket.
UPDATE support_reply_templates
SET usage_context = COALESCE(usage_context, 'support'), updated_at = now()
WHERE usage_context IS NULL;

-- ── ABERTURA E CONTINUIDADE ──────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Outro',
  body = $b$Olá! Obrigado por contar o que aconteceu.

Sua solicitação já ficou registrada por aqui e vou olhar as informações com atenção antes de te responder. Se eu precisar de algum detalhe a mais, peço nesta mesma conversa para você não precisar começar tudo de novo.

Você pode acompanhar o atendimento por aqui. Assim que houver uma atualização, ela aparece nesta conversa.

Até já — vamos cuidar disso com você.$b$,
  updated_at = now()
WHERE title = 'Recebemos sua solicitação';

UPDATE support_reply_templates SET
  category = 'Problema técnico',
  body = $b$Obrigado por avisar. Para eu entender exatamente o que aconteceu e evitar te pedir informação aos poucos, você pode me mandar, se tiver:

• em qual tela ou recurso aconteceu;
• o que você estava tentando fazer;
• o que aconteceu no lugar do esperado;
• a mensagem de erro, se apareceu alguma;
• se estava no celular ou computador e qual navegador usou;
• um print da tela, quando for possível.

Não precisa se preocupar em usar termos técnicos. Pode explicar do seu jeito — com esses detalhes eu consigo investigar melhor.$b$,
  updated_at = now()
WHERE title = 'Precisamos de mais informações';

UPDATE support_reply_templates SET
  category = 'Problema técnico',
  body = $b$Obrigado por trazer isso pra gente.

Já estou tratando o caso como uma possível falha técnica. Vou verificar o comportamento e comparar com o que deveria acontecer nessa parte do site.

Por enquanto, você não precisa repetir tentativas nem refazer seus registros só para testar. Se eu precisar que você faça algum passo específico, te aviso por aqui.

Assim que eu tiver uma atualização, continuo nesta mesma conversa.$b$,
  updated_at = now()
WHERE title = 'Problema técnico em análise';

UPDATE support_reply_templates SET
  category = 'Problema técnico',
  body = $b$Fiz algumas verificações, mas ainda não consegui reproduzir o mesmo comportamento que apareceu pra você.

Isso não significa que o problema não aconteceu — às vezes ele depende do aparelho, navegador, momento da sessão ou de uma sequência específica de passos.

Se puder, me envie:

• um print ou gravação curta da tela;
• o passo a passo até o problema acontecer;
• aparelho e navegador usados;
• horário aproximado da última ocorrência.

Com isso eu consigo aproximar o teste do seu cenário e continuar a investigação.$b$,
  updated_at = now()
WHERE title = 'Não consegui reproduzir o erro';

UPDATE support_reply_templates SET
  category = 'Problema técnico',
  body = $b$Ajustamos o problema que estava relacionado ao seu atendimento.

Quando puder, tente novamente pelo mesmo caminho que usou antes. Não precisa fazer nada diferente só por causa da correção.

Se ainda encontrar algo estranho, responda por aqui dizendo o que apareceu. A conversa continua aberta para eu acompanhar com você.$b$,
  updated_at = now()
WHERE title = 'Problema resolvido';

UPDATE support_reply_templates SET
  category = 'Outro',
  body = $b$Como não tivemos novas mensagens e, pelo que vimos até aqui, a solicitação ficou resolvida, vou encerrar este atendimento para manter sua área de suporte organizada.

Se o problema voltar ou surgir qualquer outra dúvida, você pode abrir uma nova solicitação quando quiser. Não tem problema retomar o assunto depois.

Obrigado por conversar com a gente.$b$,
  updated_at = now()
WHERE title = 'Encerramento cordial';

-- ── COMO O AVNC FUNCIONA ────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$O A Vida Não Colabora foi criado para ser um espaço de registro, reflexão e autocuidado sem pressão para “dar conta de tudo”.

Você pode fazer um Check-in rápido do dia, escrever no Diário quando quiser colocar algo em palavras, responder questionários, explorar artigos e Conteúdos Guiados e, conforme o seu plano, acompanhar recursos como Mapa Emocional, Descobertas, Minha História, Relatórios, Meu Jardim e Plano de Autocuidado.

Você não precisa usar tudo, nem seguir uma ordem obrigatória. A ideia é que o site acompanhe o que fizer sentido pra você em cada momento.

O AVNC é uma ferramenta de autoconhecimento e organização pessoal. Ele não faz diagnóstico e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.$b$,
  updated_at = now()
WHERE title IN ('Como o blog funciona', 'Objetivo do site');

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$A proposta do A Vida Não Colabora é falar sobre vida emocional de um jeito mais próximo da vida real: sem perfeição, sem cobrança e sem transformar autocuidado em mais uma obrigação.

Queremos oferecer ferramentas para você registrar o que está vivendo, perceber mudanças ao longo do tempo, encontrar informações confiáveis e experimentar formas possíveis de cuidado no seu próprio ritmo.

Nem todo dia precisa render uma grande reflexão. Às vezes um Check-in já basta. Em outros momentos, escrever, ler ou simplesmente observar o histórico pode fazer mais sentido.$b$,
  updated_at = now()
WHERE title = 'Missão do blog';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Se você acabou de chegar, não precisa conhecer o site inteiro de uma vez.

Um caminho simples é:

1. Faça seu primeiro Check-in para registrar como o dia está sendo.
2. Quando quiser escrever com mais liberdade, conheça o Diário.
3. Explore artigos, questionários e Conteúdos Guiados no seu ritmo.
4. Na área “Meu Plano”, veja com calma os recursos disponíveis para você.

Conforme você usa o espaço, recursos como Mapa Emocional, Descobertas, Minha História e Relatórios começam a fazer mais sentido porque passam a ter um histórico real para organizar.

Não existe sequência obrigatória. Comece pela parte que parecer mais útil hoje.$b$,
  updated_at = now()
WHERE title = 'Como começar a usar';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Check-in e Diário trabalham juntos, mas têm propostas diferentes.

O Check-in é um registro rápido do dia. Ele serve para marcar como aquele momento está sendo sem precisar escrever muito e pode ser feito uma vez por dia.

O Diário é o espaço de escrita. Nele, você pode registrar pensamentos, acontecimentos e o que quiser guardar com mais contexto. No Gratuito, o Diário pode ser usado em até 5 dias com registros por mês; no Essencial e no Plus, não há esse limite mensal.

No Plus, o Diário também permite Aprofundamentos: até 3 complementos no mesmo dia para acrescentar algo ao registro principal.

Você não precisa escolher um ou outro para sempre. Em um dia um Check-in pode ser suficiente; em outro, talvez faça sentido escrever.$b$,
  updated_at = now()
WHERE title = 'Check-in e Diário: qual a diferença?';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Os Aprofundamentos são uma possibilidade extra do Diário no plano Plus.

Depois de criar o registro principal do dia, você pode voltar e acrescentar até 3 Aprofundamentos. Eles servem para incluir algo que aconteceu depois, uma nova percepção ou um detalhe que você queira registrar sem precisar criar outro Diário principal.

Eles não são tarefas obrigatórias e não precisam ser usados todos os dias. São apenas uma forma de continuar o mesmo registro quando fizer sentido.$b$,
  updated_at = now()
WHERE title = 'Aprofundamentos do Diário';

-- ── PLANOS ──────────────────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Hoje o A Vida Não Colabora tem três planos: Gratuito, Essencial e Plus.

• Gratuito: para começar. Inclui Check-in diário, Diário em até 5 dias com registros por mês, Diário por voz, parte dos questionários e Conteúdos Guiados, visão inicial da Minha História e conteúdos liberados para esse plano.

• Essencial: para quem quer acompanhar a própria trajetória com mais continuidade. Acrescenta Diário sem limite mensal, Mapa Emocional completo, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e Conteúdos Guiados completos.

• Plus: inclui tudo do Essencial e acrescenta Aprofundamentos do Diário, questionários do Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.

Os preços e condições atuais aparecem sempre na página “Meu Plano”, porque podem ser atualizados sem que você precise depender de uma mensagem antiga do suporte.

Se quiser, me diga quais recursos você mais pretende usar e eu explico as diferenças de forma mais direta.$b$,
  updated_at = now()
WHERE title = 'Diferença entre os planos';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$O Gratuito é o ponto de partida do A Vida Não Colabora e pode ser usado sem assinatura paga.

Ele já permite fazer Check-in diariamente, usar o Diário em até 5 dias com registros por mês, escrever por voz, acessar uma seleção de questionários e Conteúdos Guiados, consultar uma visão inicial da Minha História e ler os conteúdos liberados para esse plano.

É uma boa forma de conhecer o espaço com calma antes de decidir se os recursos dos planos pagos fariam diferença pra você.

Os recursos e condições atuais do Gratuito ficam sempre visíveis em “Meu Plano”.$b$,
  updated_at = now()
WHERE title = 'Plano Gratuito';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$O Essencial foi pensado para quem quer ir além dos registros isolados e começar a visualizar a própria trajetória ao longo do tempo.

Além do que já existe no Gratuito, ele libera Diário sem limite mensal, Mapa Emocional completo, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e o catálogo completo de Conteúdos Guiados do plano.

É o plano que concentra os principais recursos de acompanhamento e visualização, sem incluir as funcionalidades mensais mais aprofundadas do Plus.

Você pode conferir preço e condições atuais em “Meu Plano”.$b$,
  updated_at = now()
WHERE title = 'Plano Essencial';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$O Plus reúne tudo que está disponível no Essencial e acrescenta recursos para quem quer aprofundar a experiência ao longo do mês.

Ele inclui Aprofundamentos do Diário, questionários disponíveis para o Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.

Alguns desses recursos dependem do histórico de uso e do fechamento do período. Por isso, assinar o Plus não significa que todos os resultados mensais aparecem imediatamente no primeiro dia — eles vão sendo formados conforme existem registros suficientes e o ciclo correspondente é concluído.

Preço, cobrança e condições atuais ficam sempre disponíveis em “Meu Plano”.$b$,
  updated_at = now()
WHERE title = 'Plano Plus';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Não existe um plano “certo” para todo mundo. O melhor ponto de partida depende do que você quer usar agora.

Se você quer conhecer o espaço, fazer Check-ins e registrar alguns dias no Diário, o Gratuito já permite começar.

Se você quer acompanhar padrões e trajetória com mais continuidade, o Essencial é o plano que libera Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal e Meu Jardim.

Se, além disso, você quer recursos mensais mais aprofundados — como Relatório Mensal, Plano de Autocuidado e Orientação Mensal — eles fazem parte do Plus.

Você pode mudar de plano depois. Não precisa escolher pensando em usar tudo desde o primeiro dia.$b$,
  updated_at = now()
WHERE title = 'Qual plano escolher';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Esse recurso não está incluído no seu plano atual, mas sua conta e os recursos que você já usa continuam normalmente.

Se quiser acessar essa funcionalidade, você pode conferir em “Meu Plano” qual plano a inclui, além do preço e das condições atuais antes de decidir.

Não é necessário fazer upgrade para continuar usando o A Vida Não Colabora. A mudança só faz sentido se os recursos adicionais forem úteis pra você.$b$,
  updated_at = now()
WHERE title = 'Recurso disponível em outro plano';

-- Legados comerciais antigos não devem voltar ao seletor ativo.
UPDATE support_reply_templates SET is_active = false, updated_at = now()
WHERE title IN ('Plano Terapêutico', 'Plano Terapêutico Plus', 'Sessão mensal Plus', 'Comentário sobre relatório do mês');

-- ── FUNCIONALIDADES ─────────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$O Mapa Emocional é uma forma visual de observar como seus registros foram se distribuindo ao longo do tempo.

Em vez de dizer “o que você tem” ou tirar conclusões automáticas, ele organiza sinais que você mesmo registrou — como emoções, contextos e outros marcadores — para facilitar a comparação entre períodos.

O Mapa completo faz parte do Essencial e do Plus. Quanto mais histórico real existe, mais contexto ele consegue mostrar; com poucos registros, a leitura naturalmente fica mais limitada.$b$,
  updated_at = now()
WHERE title = 'Mapa Emocional';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Descobertas reúne repetições e relações que começam a aparecer nos seus registros ao longo do tempo.

Ela não diagnostica, não afirma que uma coisa causou outra e não transforma um dia isolado em “padrão”. A proposta é mostrar observações que podem ser interessantes para você olhar com mais calma.

Você também pode dizer quando uma descoberta fez sentido, fez mais ou menos sentido ou quando prefere não acompanhá-la. O recurso está disponível no Essencial e no Plus.$b$,
  updated_at = now()
WHERE title = 'Descobertas';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Minha História organiza sua trajetória em uma linha do tempo, usando acontecimentos e sinais que já existem na sua conta.

No Gratuito, você vê uma visão inicial. No Essencial e no Plus, a experiência completa permite olhar períodos, marcos e mudanças com mais contexto.

A proposta não é criar uma pontuação de progresso nem cobrar constância. Pausas fazem parte da vida e não apagam sua história.$b$,
  updated_at = now()
WHERE title = 'Minha História';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Meu Jardim é uma representação visual da jornada que você vem construindo no A Vida Não Colabora.

Ele muda conforme diferentes momentos de uso e marcos reais da plataforma vão acontecendo, mas não funciona como ranking, sequência obrigatória ou meta diária. Se você passar um tempo sem entrar, o Jardim não “pune” sua ausência nem apaga o que já foi construído.

O recurso está disponível no Essencial e no Plus e foi pensado como uma forma mais leve de visualizar continuidade, não como uma cobrança para usar o site todos os dias.$b$,
  updated_at = now()
WHERE title = 'Meu Jardim';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Os dois relatórios olham para períodos diferentes e têm papéis diferentes.

O Relatório Semanal, disponível no Essencial e no Plus, fecha a semana e organiza uma retrospectiva curta do período. Ele ajuda a revisitar o que apareceu nos registros sem transformar isso em uma lista de tarefas.

O Relatório Mensal Aprofundado, disponível no Plus, olha para o mês fechado e reúne uma leitura mais ampla das informações estruturadas daquele período.

Como eles dependem do período e dos registros disponíveis, um relatório novo pode ainda não existir logo após a assinatura. Quando estiver pronto, ele aparece na sua conta.$b$,
  updated_at = now()
WHERE title = 'Relatório Semanal e Relatório Mensal';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$O Plano de Autocuidado Mensal é um recurso do Plus que transforma sinais do período em possibilidades práticas de cuidado para o próximo ciclo.

Ele não é uma prescrição nem uma lista de obrigações. A ideia é oferecer um foco e pequenas possibilidades para você escolher, experimentar, adaptar ou simplesmente deixar de lado quando não fizerem sentido.

Para que o plano tenha base suficiente, ele depende de um mínimo de registros válidos no período. Quando ainda não houver contexto suficiente, a própria página informa isso em vez de gerar um plano genérico.$b$,
  updated_at = now()
WHERE title = 'Plano de Autocuidado Mensal';

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$A Orientação Mensal é um recurso do plano Plus para você trazer uma questão específica do seu momento e receber uma resposta organizada dentro da própria conta.

A solicitação é feita uma vez por mês, dentro da janela informada na página da Orientação. Depois do envio, você consegue acompanhar o status por lá e a resposta é disponibilizada dentro do prazo mostrado no próprio recurso.

Ela não funciona como chat em tempo real, terapia ou atendimento de urgência. É uma orientação pontual de apoio ao autoconhecimento e à organização de próximos passos.$b$,
  updated_at = now()
WHERE title IN ('Orientação mensal por mensagem', 'Orientação Mensal: prazos e funcionamento');

UPDATE support_reply_templates SET
  category = 'Uso do site',
  body = $b$Esse recurso ainda não está disponível para uso, embora possa aparecer no planejamento ou em alguma área administrativa do projeto.

Preferimos não liberar uma funcionalidade antes de ela estar integrada, testada e com regras claras para o usuário. Quando estiver realmente disponível, ela aparecerá no site com a explicação de quem pode usar e como funciona.

Se você me disser qual recurso está procurando, posso verificar se existe hoje alguma alternativa dentro da plataforma.$b$,
  updated_at = now()
WHERE title = 'Recurso em implantação';

-- ── CONTA E ACESSO ──────────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Conta e acesso',
  body = $b$Olá, {{nome}}.

Para concluir um novo cadastro, é preciso confirmar o endereço de e-mail usado na conta.

Procure a mensagem de confirmação na caixa de entrada e também em Spam, Lixo eletrônico ou abas como Promoções. Se o link não chegar ou estiver expirado, você pode voltar à tela de acesso e pedir um novo envio.

Se continuar sem receber, responda por aqui. A gente verifica o que pode estar impedindo a confirmação sem pedir sua senha — sua senha é pessoal e nunca precisa ser enviada ao suporte.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE title = 'Confirmação de e-mail';

-- ── ASSINATURA E PAGAMENTO ─────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Recebi seu pedido de cancelamento.

Antes de qualquer orientação, vou conferir o estado atual da assinatura e a data do ciclo para te informar exatamente quando a mudança passa a valer.

O cancelamento de uma assinatura não apaga automaticamente seus registros. O que muda, depois do fim do acesso pago, são as funcionalidades disponíveis conforme o plano que permanecer ativo.

Se você já informou o motivo no fluxo de cancelamento, não precisa explicar de novo. Se houver alguma dúvida sobre cobrança ou data final de acesso, pode deixar aqui que eu verifico junto com o pedido.$b$,
  updated_at = now()
WHERE title = 'Solicitação de cancelamento';

UPDATE support_reply_templates SET
  category = 'Pagamento',
  body = $b$Claro, vamos olhar isso com cuidado.

Me diga qual situação aconteceu com a sua assinatura:

• pagamento recusado;
• cobrança que você não reconheceu ou acredita estar duplicada;
• pagamento aprovado, mas plano ainda não liberado;
• dúvida sobre renovação;
• alteração de plano;
• cancelamento;
• outra situação de cobrança.

Se houver uma cobrança específica, envie a data e o valor que aparecem para você. Não envie número completo do cartão, código de segurança, senha ou qualquer dado bancário sensível.

Com essas informações eu consigo direcionar a verificação correta.$b$,
  updated_at = now()
WHERE title = 'Pagamento ou assinatura';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Ao trocar ou encerrar um plano, seus registros pessoais não são apagados automaticamente.

O que muda é o acesso às funcionalidades de acordo com o plano que ficar ativo. Por exemplo: uma área que exige Essencial ou Plus pode deixar de ficar disponível depois que o ciclo pago terminar, mas isso não significa que seu histórico foi apagado.

Se no futuro você voltar a um plano que dê acesso àquela funcionalidade, os dados compatíveis continuam vinculados à sua conta, respeitando as regras de retenção e privacidade do serviço.$b$,
  updated_at = now()
WHERE title = 'Dados preservados após downgrade ou cancelamento';

UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Olá, {{nome}}.

Se você estiver fazendo upgrade para um plano com mais recursos, a alteração segue as condições mostradas durante o processo de mudança.

Quando a mudança for para um plano com menos recursos, ela normalmente é programada para o próximo ciclo, para que você continue usando o plano atual até o fim do período já contratado.

Você pode conferir o plano atual, a próxima renovação e as opções disponíveis em “Meu Plano”. Se alguma informação dali não bater com o que você esperava, responda por aqui que a gente verifica.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE title = 'Mudança de plano';

-- ── PRIVACIDADE ─────────────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Privacidade e dados',
  body = $b$Entendo essa preocupação. Os registros que você cria no A Vida Não Colabora fazem parte da sua experiência pessoal e são tratados como dados privados da sua conta.

Diário, Check-ins, questionários e outros sinais podem alimentar funcionalidades do próprio site quando isso faz parte do recurso e das suas preferências, como histórico, visualizações e relatórios. Isso não significa que o texto íntimo do seu Diário fica exposto no painel administrativo.

Nas áreas administrativas de acompanhamento, priorizamos informações operacionais e sinais estruturados necessários para o funcionamento do serviço, evitando exibir texto livre do Diário quando ele não é necessário.

Você também pode consultar a Política de Privacidade para entender com mais detalhe como os dados são tratados. Se sua dúvida for sobre um dado específico, me diga qual e eu explico de forma mais direta.$b$,
  updated_at = now()
WHERE title = 'Privacidade dos registros';

-- ── PLUS ────────────────────────────────────────────────────────────────────
UPDATE support_reply_templates SET
  category = 'Planos e assinatura',
  body = $b$Vi que sua conta está no Plus. Vou considerar os recursos e regras desse plano para não te passar uma orientação genérica.

Se a sua dúvida for sobre Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado ou Orientação Mensal, pode me dizer o que você esperava encontrar e o que está aparecendo pra você agora.

Alguns recursos do Plus dependem do fechamento do período ou de uma quantidade mínima de registros, então também vou conferir se é uma questão de elegibilidade, prazo ou funcionamento.$b$,
  updated_at = now()
WHERE title = 'Atendimento ao assinante Plus';

-- ── NOVOS MODELOS PARA LACUNAS COMUNS ───────────────────────────────────────
INSERT INTO support_reply_templates (title, category, subject, body, usage_context, is_active, is_favorite)
SELECT v.title, v.category, NULL, v.body, 'support', true, v.favorite
FROM (VALUES
  ('Não consigo entrar na minha conta', 'Conta e acesso', $b$Vamos tentar resolver seu acesso sem complicar.

Primeiro, confirme se você está usando o mesmo e-mail com que fez o cadastro. Se esqueceu a senha, use “Esqueci minha senha” na tela de login para receber o link de redefinição.

Se a conta for nova, confira também se o e-mail foi confirmado. Sem essa confirmação, o acesso pode não ser concluído.

Se ainda assim não entrar, me diga qual mensagem aparece na tela. Não envie sua senha — o suporte nunca precisa dela.$b$, true),

  ('Não recebi o e-mail de redefinição de senha', 'Conta e acesso', $b$Se o e-mail de redefinição ainda não apareceu, confira primeiro Spam, Lixo eletrônico e outras abas da caixa de entrada.

Depois, espere alguns minutos antes de pedir um novo link, porque vários pedidos seguidos podem fazer você abrir uma mensagem antiga em vez da mais recente.

Se continuar sem receber, me informe o e-mail usado na conta e o horário aproximado da última tentativa. Não envie sua senha atual ou nova.$b$, false),

  ('E-mail ou dados da conta precisam ser alterados', 'Conta e acesso', $b$Posso te orientar nessa alteração.

Me diga qual informação da conta você precisa atualizar. Dependendo do dado, pode ser necessário confirmar sua identidade ou concluir uma etapa de segurança antes da mudança.

Por segurança, não envie senha, código de autenticação, número completo de cartão ou documentos sem que o próprio fluxo seguro do site peça isso.$b$, false),

  ('Plano pago ainda não apareceu', 'Planos e assinatura', $b$Entendo a preocupação, principalmente quando o pagamento já parece concluído.

Vou verificar se a confirmação da cobrança chegou corretamente e se o plano foi sincronizado com a sua conta.

Me envie, por favor, a data aproximada da compra e qual plano você assinou. Se tiver um comprovante, pode mandar um print com dados sensíveis ocultos. Não envie número completo do cartão ou código de segurança.

Enquanto verificamos, evite fazer uma segunda assinatura para não correr o risco de duplicar a cobrança.$b$, true),

  ('Cobrança duplicada ou desconhecida', 'Pagamento', $b$Vamos verificar isso com prioridade.

Me envie a data e o valor das cobranças que aparecem para você e diga se elas estão como aprovadas, pendentes ou estornadas. Se mandar um print, esconda número do cartão e outros dados bancários.

Não faça uma nova tentativa de pagamento só para testar enquanto a gente confere o histórico. Assim evitamos criar outra cobrança sem necessidade.$b$, true),

  ('Pagamento recusado', 'Pagamento', $b$Uma recusa de pagamento pode acontecer por vários motivos e nem sempre significa que há algo errado com sua conta no A Vida Não Colabora.

Confira se os dados informados estão corretos e se o meio de pagamento está liberado para compras online/recorrentes. O banco ou emissor também pode recusar por critérios próprios de segurança.

Se quiser tentar novamente, faça isso apenas uma vez depois de conferir os dados. Se continuar recusando, vale verificar com o emissor do pagamento ou usar outra opção disponível no checkout.$b$, false),

  ('Como funciona o limite do Diário no Gratuito', 'Uso do site', $b$No plano Gratuito, o limite do Diário é contado por dias em que houve registro, e não pelo tamanho do texto.

Você pode usar o Diário em até 5 dias com registros dentro do mês. O Check-in diário é separado desse limite e continua disponível uma vez por dia.

Se o limite do Diário for atingido, seus registros anteriores continuam guardados. No mês seguinte, a contagem recomeça. Essencial e Plus não têm esse limite mensal do Diário.$b$, true),

  ('Relatório ainda não apareceu', 'Uso do site', $b$Nem sempre um relatório aparece imediatamente depois que você começa a usar o plano.

Os relatórios dependem do fechamento do período correspondente e dos registros disponíveis naquele ciclo. Por isso, se a assinatura começou no meio da semana ou do mês, o primeiro período também pode ser menor.

Se você me disser se está esperando o Relatório Semanal ou o Relatório Mensal Aprofundado e quando o plano foi ativado, eu consigo te orientar sobre o que deveria estar disponível agora.$b$, true),

  ('Plano de Autocuidado ainda não está disponível', 'Uso do site', $b$O Plano de Autocuidado precisa de uma base mínima de registros para não gerar sugestões genéricas só para preencher a tela.

Se ainda não houver contexto suficiente no período, a página mantém o plano em formação e informa que precisa de mais evidências antes da geração.

Você não precisa criar registros artificiais nem preencher tudo de uma vez. Continue usando Check-ins, Diário, questionários e conteúdos quando eles realmente fizerem sentido; as fontes válidas vão formando essa base ao longo do tempo.$b$, true),

  ('Orientação Mensal ainda não está disponível', 'Uso do site', $b$A Orientação Mensal segue um ciclo próprio dentro do Plus e depende da janela de envio e das regras de elegibilidade mostradas na página.

Se o botão ainda não estiver disponível, isso pode acontecer porque o período ainda não abriu, porque a solicitação daquele ciclo já foi usada ou porque a conta ainda não está elegível para aquela competência.

Me diga qual mensagem aparece na tela e eu verifico com você qual dessas situações se aplica.$b$, false),

  ('Excluir minha conta', 'Privacidade e dados', $b$Posso te orientar sobre a exclusão da conta.

Esse é um processo diferente de cancelar uma assinatura: o cancelamento interrompe a renovação do plano, enquanto a exclusão da conta envolve seus dados e acesso ao serviço.

Antes de excluir, se você quiser guardar uma cópia das suas informações, vale fazer a exportação dos dados disponíveis na conta. Depois de confirmar a exclusão pelo fluxo próprio, algumas etapas podem ser irreversíveis conforme explicado na tela.

Se sua intenção for apenas parar a cobrança, me avise — nesse caso talvez você esteja procurando o cancelamento da assinatura, e não a exclusão da conta.$b$, true),

  ('Exportar meus dados', 'Privacidade e dados', $b$Você pode solicitar uma cópia dos dados disponíveis na sua conta pelo recurso de exportação.

A exportação serve para você guardar suas próprias informações fora do A Vida Não Colabora e é diferente de excluir a conta.

Se estiver pensando em excluir a conta, recomendamos exportar antes o que quiser preservar. Se aparecer algum erro durante a geração do arquivo, me diga em qual etapa parou para eu verificar.$b$, false),

  ('Envio de anexo no suporte', 'Problema técnico', $b$Você pode enviar anexos quando eles ajudarem a mostrar o problema, como prints de tela ou um PDF relacionado ao atendimento.

Antes de enviar, confira se a imagem não mostra senha, dados completos de cartão, códigos de autenticação ou outras informações que não sejam necessárias para resolver o caso.

Se o arquivo não carregar, me diga o tipo de arquivo e o tamanho aproximado para eu verificar o limite ou formato aceito.$b$, false),

  ('Sugestão recebida', 'Sugestão de melhoria', $b$Obrigado por dividir essa ideia com a gente.

Sugestões ajudam bastante a entender onde a experiência pode ficar mais simples, útil ou coerente com a proposta do A Vida Não Colabora.

Vou deixar sua sugestão registrada para avaliação. Isso não significa que ela será implementada imediatamente, porque precisamos considerar impacto, segurança e como ela se encaixa no restante do produto — mas o retorno fica guardado como parte dessa análise.

Se quiser, pode explicar também qual problema essa mudança resolveria pra você. Esse contexto costuma ser tão útil quanto a sugestão em si.$b$, false),

  ('Não substitui atendimento de emergência', 'Outro', $b$O A Vida Não Colabora é um espaço de registro, reflexão e autocuidado, mas não oferece atendimento de emergência e não substitui acompanhamento médico ou de saúde mental.

Se a situação exigir ajuda imediata ou envolver risco à sua segurança ou à de outra pessoa, procure um serviço de emergência da sua região ou uma pessoa/profissional que possa oferecer suporte presencial agora.

Se sua dúvida for sobre como usar algum recurso do site, eu continuo por aqui e posso te ajudar com essa parte.$b$, false)
) AS v(title, category, body, favorite)
WHERE NOT EXISTS (
  SELECT 1 FROM support_reply_templates s WHERE lower(s.title) = lower(v.title)
);

-- Mantém modelos novos visíveis no suporte, sem duplicar e-mail administrativo.
UPDATE support_reply_templates
SET usage_context = 'both', updated_at = now()
WHERE title IN (
  'Check-in e Diário: qual a diferença?',
  'Aprofundamentos do Diário',
  'Mapa Emocional',
  'Descobertas',
  'Minha História',
  'Meu Jardim',
  'Relatório Semanal e Relatório Mensal',
  'Plano de Autocuidado Mensal',
  'Orientação Mensal: prazos e funcionamento',
  'Dados preservados após downgrade ou cancelamento'
);
