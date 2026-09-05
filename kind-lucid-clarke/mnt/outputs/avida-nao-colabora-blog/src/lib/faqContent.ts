export interface FaqContentItem {
  category: string
  question: string
  answer: string
}

/**
 * Fallback canônico do FAQ público.
 *
 * O CMS (faq_items) continua tendo prioridade em runtime, mas esta lista deve
 * permanecer alinhada ao conteúdo publicado para que falhas/ausência do CMS
 * nunca façam a página voltar a nomenclaturas ou regras antigas.
 */
export const FAQ_FALLBACK: FaqContentItem[] = [
  // Conta e acesso
  {
    category: 'Conta e acesso',
    question: 'Como crio minha conta?',
    answer: 'Na página inicial, escolha a opção de criar uma conta gratuita, informe seu nome, e-mail e crie uma senha. Depois do cadastro, enviamos um link de confirmação para o endereço informado. O acesso à área logada é liberado após confirmar o e-mail. Se a mensagem não chegar, verifique a caixa de spam ou use a opção de reenviar na tela de confirmação.',
  },
  {
    category: 'Conta e acesso',
    question: 'Preciso confirmar meu e-mail para entrar?',
    answer: 'Sim. Novos cadastros precisam confirmar o endereço de e-mail antes do primeiro acesso. Depois de criar a conta, enviamos um link de confirmação. Se ele não chegar, verifique a caixa de spam ou solicite um novo envio na própria tela de confirmação.',
  },
  {
    category: 'Conta e acesso',
    question: 'Esqueci minha senha. O que faço?',
    answer: 'Na tela de login, escolha a opção de recuperação de senha e informe o e-mail cadastrado. Você receberá uma mensagem com o link para definir uma nova senha. Por segurança, use o link recebido assim que possível; se ele não funcionar mais, solicite um novo.',
  },
  {
    category: 'Conta e acesso',
    question: 'Posso usar no celular?',
    answer: 'Sim. A plataforma é responsiva e pode ser usada em navegadores modernos no celular, tablet ou computador. Não é necessário instalar um aplicativo para acessar a versão web.',
  },
  {
    category: 'Conta e acesso',
    question: 'Posso excluir minha conta?',
    answer: 'Sim. Em Meu perfil > Privacidade e seus dados, você pode excluir a conta por autoatendimento. Para sua segurança, é necessário informar a senha atual e digitar EXCLUIR. A conta e os dados pessoais vinculados ao aplicativo são removidos ao concluir o processo; se houver cadastro de cobrança no Stripe, ele é encerrado antes da exclusão para impedir novas cobranças. Registros que prestadores precisem conservar por obrigação legal, segurança ou auditoria seguem os prazos aplicáveis desses prestadores.',
  },

  // Planos e pagamento
  {
    category: 'Planos e pagamento',
    question: 'O plano Gratuito tem prazo de validade?',
    answer: 'Não. O plano Gratuito não tem prazo de validade e pode ser usado sem inserir cartão de crédito. Os limites e recursos disponíveis seguem a matriz atual do plano.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Qual a diferença entre os planos?',
    answer: 'Gratuito — começar a se observar: Check-in diário (1 por dia), Diário emocional em até 5 dias por mês, Diário por voz, questionários disponíveis para o Gratuito, Artigos e conteúdos, uma seleção de Conteúdos Guiados e visão inicial da Minha História. Essencial — entender seus padrões: inclui os recursos do Gratuito e amplia a experiência com Diário sem limite mensal, questionários do Essencial, Conteúdos Guiados completos, Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal e Meu Jardim. Plus — transformar entendimento em cuidado: inclui os recursos do Essencial e acrescenta Aprofundamentos do Diário (até 3 por dia), questionários do Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Posso mudar de plano depois?',
    answer: 'Sim. Você pode fazer upgrade ou downgrade pela área Meu Plano. A mudança respeita as regras de cobrança do ciclo atual e mantém seus dados e históricos já registrados.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona o upgrade de Essencial para Plus?',
    answer: 'O upgrade é processado na assinatura existente. O Stripe calcula a diferença proporcional referente ao período restante do ciclo e, após a confirmação do pagamento, o acesso ao Plus é liberado. A data normal de renovação da assinatura é mantida.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona o downgrade?',
    answer: 'O downgrade é programado para o fim do ciclo já pago. Até a data da próxima renovação, você continua com os recursos do plano atual. Na renovação seguinte, passa a valer o plano inferior escolhido, sem apagar seus dados históricos.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona o pagamento?',
    answer: 'Os planos Essencial e Plus são cobrados mensalmente por cartão de crédito, com processamento pelo Stripe. O aplicativo não armazena os dados completos do seu cartão.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim, sem multa. Ao cancelar, seu acesso ao plano pago continua até o final do período já pago. Depois dessa data, a conta volta ao plano Gratuito e seus dados permanecem preservados.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Existe reembolso?',
    answer: 'Pedidos de reembolso podem ser analisados conforme as condições da contratação e a legislação aplicável. Se precisar solicitar ou esclarecer um reembolso, entre em contato pelo suporte para que a situação seja analisada. Não há promessa automática de reembolso proporcional por um prazo fixo nesta página.',
  },

  // Diário e registros
  {
    category: 'Diário e registros',
    question: 'Qual a diferença entre Check-in e Diário emocional?',
    answer: 'O Check-in é um registro rápido de como você está naquele dia e pode ser feito uma vez por dia. O Diário emocional é um registro mais reflexivo, para escrever ou falar sobre pensamentos, sentimentos e acontecimentos. Eles são recursos diferentes: fazer o Check-in não consome um dia do limite mensal do Diário no plano Gratuito.',
  },
  {
    category: 'Diário e registros',
    question: 'Quantos Check-ins posso fazer por dia?',
    answer: 'Um Check-in por dia, em todos os planos. Depois de concluir o Check-in daquele dia, a plataforma não cria um segundo Check-in para a mesma data.',
  },
  {
    category: 'Diário e registros',
    question: 'Como funciona o limite do Diário no plano Gratuito?',
    answer: 'No Gratuito, você pode ter registros do Diário emocional em até 5 dias por mês. O limite considera dias com registro do Diário, e não a quantidade de Check-ins. No Essencial e no Plus, o Diário não tem limite mensal.',
  },
  {
    category: 'Diário e registros',
    question: 'Como funciona o Diário por voz?',
    answer: 'O Diário por voz permite falar no seu ritmo e transformar a fala em um registro do Diário. Ele está disponível nos três planos e segue as mesmas regras de acesso do Diário emocional de cada plano.',
  },
  {
    category: 'Diário e registros',
    question: 'O que são Aprofundamentos do Diário?',
    answer: 'Aprofundamentos são extensões do Diário daquele dia. Eles servem para acrescentar novos momentos, pensamentos ou sentimentos depois do registro principal, sem criar um novo Check-in. Estão disponíveis no Plus, com até 3 aprofundamentos por dia.',
  },

  // Recursos e funcionalidades
  {
    category: 'Recursos e funcionalidades',
    question: 'Como funcionam os Questionários de autoconhecimento?',
    answer: 'Os questionários ajudam você a refletir sobre diferentes aspectos do seu momento. A disponibilidade é configurada por plano: o Gratuito tem uma seleção, o Essencial amplia o acesso e o Plus inclui os questionários definidos para o nível mais completo. As respostas servem para autoconhecimento e não representam diagnóstico clínico.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Os Conteúdos Guiados são iguais em todos os planos?',
    answer: 'Não. O Gratuito recebe uma seleção para começar. Essencial e Plus têm acesso completo aos Conteúdos Guiados disponíveis para esses planos, com exercícios, reflexões e práticas para diferentes momentos.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é o Mapa Emocional?',
    answer: 'O Mapa Emocional ajuda a visualizar como seus registros se distribuíram ao longo do tempo. Ele organiza emoções, contextos, sintomas, evolução e conexões presentes nos seus próprios registros. Está disponível no Essencial e no Plus e não faz diagnóstico nem afirma relações de causa e efeito.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que são Descobertas?',
    answer: 'Descobertas ajudam a perceber temas, repetições e conexões que podem passar despercebidos no dia a dia. Elas organizam sinais presentes nos seus registros e podem ser salvas ou ocultadas. Estão disponíveis no Essencial e no Plus. As relações mostradas são observações dos registros, não diagnósticos nem conclusões de causa e efeito.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Qual a diferença entre Mapa Emocional, Descobertas e Minha História?',
    answer: 'O Mapa Emocional responde principalmente “como meus registros se distribuíram?”, com visualizações de emoções, contextos, sintomas e evolução. Descobertas responde “o que está se repetindo?”, destacando padrões e conexões observáveis. Minha História responde “como minha trajetória foi mudando ao longo do tempo?”, organizando períodos, marcos e temas da sua jornada.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é Minha História?',
    answer: 'Minha História organiza sua trajetória ao longo do tempo, reunindo períodos, marcos, mudanças e temas importantes. O Gratuito possui uma visão inicial; Essencial e Plus têm a experiência completa.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Quando o Relatório Semanal fica disponível?',
    answer: 'O Relatório Semanal acompanha o ciclo de domingo a sábado. Ele fecha no sábado e fica disponível no domingo seguinte. Na primeira ativação no meio de um ciclo, o primeiro relatório considera o período a partir da data em que o recurso foi ativado. Está disponível no Essencial e no Plus.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Quando o Relatório Mensal Aprofundado fica disponível?',
    answer: 'O Relatório Mensal Aprofundado acompanha o período do dia 1 até o último dia do mês. Ele fecha no último dia e fica disponível no primeiro dia do mês seguinte. Na primeira ativação no meio do mês, o primeiro relatório considera o período a partir da ativação. É um recurso do Plus.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é Meu Jardim?',
    answer: 'Meu Jardim é uma representação visual da sua jornada de cuidado. Ele cresce com usos significativos da plataforma, como dias de Diário, relatórios e marcos pessoais. Não usa streaks, não pune pausas, nada morre por ausência e não existe competição. Está disponível no Essencial e no Plus.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Como funciona o Plano de Autocuidado Mensal?',
    answer: 'O Plano de Autocuidado Mensal transforma pontos observados nos seus registros e relatórios em poucas possibilidades práticas de cuidado para o próximo período. Ele pode reunir um foco do mês, pequenas ações, uma ação principal, perguntas para observar e revisão do plano anterior. É um recurso do Plus e não substitui orientação clínica.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Como funciona a Orientação Mensal?',
    answer: 'A Orientação Mensal é um recurso do Plus para enviar uma questão específica sobre o seu momento e receber uma resposta organizada a partir da solicitação e do contexto que você escolheu compartilhar. É possível enviar 1 orientação por mês até o dia 23, e o prazo de resposta é de até 7 dias corridos após o envio. Não é psicoterapia nem acompanhamento profissional continuado.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Os conteúdos do blog são para todos?',
    answer: 'Há diferentes níveis de acesso. Conteúdos marcados como Público podem ser lidos por qualquer pessoa. Alguns conteúdos exigem apenas uma conta Gratuita, e outros são destinados aos planos Essencial ou Plus. Planos superiores também acessam os conteúdos dos níveis anteriores.',
  },

  // Privacidade e dados
  {
    category: 'Privacidade e dados',
    question: 'Meus registros do Diário são privados?',
    answer: 'Sim. Seus registros não são públicos nem ficam disponíveis para leitura livre pela equipe. Eles são protegidos por controles de acesso e podem ser processados automaticamente para gerar recursos da sua própria conta. Na Orientação Mensal do Plus, apenas o contexto necessário para responder à solicitação entra no fluxo de preparação e revisão da resposta, conforme o que você escolheu compartilhar.',
  },
  {
    category: 'Privacidade e dados',
    question: 'Posso exportar meus dados?',
    answer: 'Sim. Em Meu perfil > Privacidade e seus dados, escolha “Baixar pacote dos meus dados”. A plataforma prepara um arquivo ZIP com o JSON completo dos dados, tabelas CSV para abrir em planilhas, um PDF-resumo e instruções de leitura.',
  },
  {
    category: 'Privacidade e dados',
    question: 'Como meus dados são usados para gerar recursos personalizados?',
    answer: 'A plataforma pode usar registros, check-ins, respostas de questionários, preferências e outros dados da sua própria conta para gerar mapas, relatórios, planos, recomendações e conteúdos personalizados. Quando há processamento por inteligência artificial, o objetivo é enviar apenas o contexto necessário para aquela funcionalidade. Esses recursos são de autoconhecimento e não produzem diagnóstico clínico.',
  },

  // Saúde e segurança
  {
    category: 'Saúde e segurança',
    question: 'Vocês fazem diagnósticos?',
    answer: 'Não. A plataforma é uma ferramenta de autoconhecimento e organização emocional. Não realizamos diagnósticos, não prescrevemos tratamentos e não substituímos avaliação de profissionais de saúde habilitados.',
  },
  {
    category: 'Saúde e segurança',
    question: 'O Plano Plus substitui o acompanhamento com psicólogo?',
    answer: 'Não. O Plus reúne recursos adicionais de autoconhecimento — Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal. A Orientação Mensal parte de uma solicitação específica e não representa psicoterapia, avaliação clínica ou acompanhamento profissional continuado.',
  },
  {
    category: 'Saúde e segurança',
    question: 'E se eu estiver em crise?',
    answer: 'Se você estiver em crise, pensando em se machucar ou em situação de emergência, procure ajuda imediatamente. No Brasil, ligue para o CVV 188 (gratuito, 24h) ou para o SAMU 192. A Vida Não Colabora não é um serviço de emergência.',
  },
]
