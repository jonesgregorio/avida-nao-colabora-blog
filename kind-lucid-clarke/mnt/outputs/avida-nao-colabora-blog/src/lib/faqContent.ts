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
    answer: 'Sim. Em Meu perfil > Privacidade e seus dados, você pode excluir a conta por autoatendimento. Para sua segurança, é necessário informar a senha atual e digitar EXCLUIR. A conta e os dados pessoais vinculados à plataforma são removidos ao concluir o processo; se houver cadastro de cobrança no Stripe, ele é encerrado antes da exclusão para impedir novas cobranças. Registros que prestadores precisem conservar por obrigação legal, segurança ou auditoria seguem os prazos aplicáveis desses prestadores.',
  },

  // Planos e pagamento
  {
    category: 'Planos e pagamento',
    question: 'O plano Gratuito tem prazo de validade?',
    answer: 'Não. O plano Gratuito não tem prazo de validade e pode ser usado sem cadastrar cartão de crédito. Ele inclui Check-in diário, Diário emocional em até 5 dias por mês, Diário por voz, uma seleção de questionários, Artigos e conteúdos, uma seleção de Conteúdos Guiados e uma visão inicial da Minha História.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Qual a diferença entre os planos?',
    answer: 'Gratuito: Check-in diário (1 por dia), Diário emocional em até 5 dias por mês, Diário por voz, seleção de Questionários de autoconhecimento, Artigos e conteúdos, seleção de Conteúdos Guiados e visão inicial da Minha História. Essencial: inclui tudo do Gratuito e acrescenta Diário sem limite mensal, catálogo de questionários e Conteúdos Guiados do Essencial, Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal e Meu Jardim. Plus: inclui tudo do Essencial e acrescenta Aprofundamentos do Diário (até 3 por dia), questionários do Plus, catálogo completo de Conteúdos Guiados com conteúdos exclusivos do Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Posso mudar de plano depois?',
    answer: 'Sim. Na área Meu Plano, você pode escolher outro plano sempre que essa opção estiver disponível para sua assinatura. Ao mudar para um plano com mais recursos, a diferença proporcional do período restante pode ser cobrada. Ao mudar para um plano com menos recursos, a alteração fica programada para o fim do ciclo já pago. Seus dados e registros continuam preservados.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona a mudança do Essencial para o Plus?',
    answer: 'A mudança é feita na sua assinatura atual. O Stripe, empresa que processa o pagamento com segurança, calcula a diferença proporcional referente ao período restante do ciclo. Depois da confirmação do pagamento, os recursos do Plus são liberados e a data normal de renovação é mantida.',
  },
  {
    category: 'Planos e pagamento',
    question: 'O que acontece se eu escolher um plano com menos recursos?',
    answer: 'A mudança fica programada para o fim do ciclo que já foi pago. Até a data da próxima renovação, você continua usando normalmente os recursos do plano atual. Depois dessa data, passa a valer o plano escolhido. Seus dados e registros não são apagados; apenas a disponibilidade de alguns recursos passa a seguir as regras do novo plano.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Como funciona o pagamento?',
    answer: 'Os planos Essencial e Plus são cobrados mensalmente por cartão de crédito. O pagamento é processado com segurança pelo Stripe, e a plataforma não armazena os dados completos do seu cartão.',
  },
  {
    category: 'Planos e pagamento',
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim, sem multa. Em Meu Plano, você envia o pedido de cancelamento para análise. Até a confirmação, nada muda. Quando o cancelamento é confirmado, o plano continua ativo até o fim do ciclo que já foi pago. Depois, a conta volta ao Gratuito e seus dados permanecem preservados.',
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
    answer: 'Os questionários ajudam você a refletir sobre diferentes aspectos do seu momento. A disponibilidade varia conforme o plano: o Gratuito tem uma seleção, o Essencial amplia o catálogo e o Plus inclui o nível mais completo. As respostas servem para autoconhecimento e não representam diagnóstico clínico.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Os Conteúdos Guiados são iguais em todos os planos?',
    answer: 'Não. O Gratuito recebe uma seleção para começar. O Essencial acessa essa seleção e o catálogo do Essencial. O Plus acessa todo esse conteúdo e também os Conteúdos Guiados exclusivos do Plus. Cada nível reúne exercícios, reflexões e práticas compatíveis com o plano.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é o Mapa Emocional?',
    answer: 'O Mapa Emocional ajuda a visualizar como seus registros se distribuíram ao longo do tempo, reunindo informações como emoções, contextos, faixas de humor, evolução e conexões presentes nos seus próprios registros. Está disponível no Essencial e no Plus. Ele não faz diagnóstico nem afirma relações de causa e efeito.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que são Descobertas?',
    answer: 'Descobertas ajudam a perceber temas, repetições e conexões que podem passar despercebidos no dia a dia. Elas organizam sinais presentes nos seus registros e podem ser salvas ou ocultadas. Estão disponíveis no Essencial e no Plus. As relações mostradas são observações dos registros, não diagnósticos nem conclusões de causa e efeito.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Qual a diferença entre Mapa Emocional, Descobertas e Minha História?',
    answer: 'O Mapa Emocional mostra como seus registros se distribuíram, com visualizações de emoções, contextos e evolução. Descobertas destaca temas e padrões que aparecem ao longo do uso. Minha História organiza sua trajetória ao longo do tempo. O Mapa Emocional e Descobertas estão no Essencial e no Plus. Minha História tem uma visão inicial no Gratuito e a experiência completa no Essencial e no Plus.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Como cada análise personalizada se diferencia?',
    answer: 'Cada recurso tem um papel diferente. No Essencial e no Plus, o Mapa Emocional mostra distribuições, Descobertas ajuda a perceber repetições, o Relatório Semanal resume um período fechado, Minha História organiza sua trajetória e Meu Jardim representa momentos de cuidado. No Plus, o Relatório Mensal aprofunda o mês, o Plano de Autocuidado transforma o histórico do ciclo em possibilidades práticas de cuidado e a Orientação Mensal responde a uma questão específica com resposta preparada por profissional habilitado.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é Minha História?',
    answer: 'Minha História organiza sua trajetória ao longo do tempo, reunindo períodos, marcos, mudanças e temas importantes. O Gratuito possui uma visão inicial. No Essencial e no Plus, a experiência é completa.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Quando o Relatório Semanal fica disponível?',
    answer: 'O Relatório Semanal está disponível no Essencial e no Plus. Ele acompanha o ciclo de domingo a sábado, fecha no sábado e fica disponível no domingo seguinte. Na primeira ativação no meio de um ciclo, o primeiro relatório considera o período a partir da data em que o recurso foi ativado.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Quando o Relatório Mensal Aprofundado fica disponível?',
    answer: 'O Relatório Mensal Aprofundado é um recurso do Plus. Ele acompanha o período do dia 1 até o último dia do mês, fecha no último dia e fica disponível no primeiro dia do mês seguinte. Na primeira ativação no meio do mês, o primeiro relatório considera o período a partir da ativação.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'O que é Meu Jardim?',
    answer: 'Meu Jardim é uma representação visual da sua jornada de cuidado. Ele cresce com usos significativos da plataforma, como dias de Diário, relatórios e marcos pessoais. Não exige sequência diária, não pune pausas, nada morre por ausência e não existe competição. Está disponível no Essencial e no Plus.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Como funciona o Plano de Autocuidado Mensal?',
    answer: 'O Plano de Autocuidado Mensal é um recurso do Plus e considera o mês que acabou de fechar. Para evitar um plano genérico, ele só é preparado quando existe contexto suficiente no período: atualmente, pelo menos 12 sinais de uso distribuídos em 8 dias do ciclo. Podem entrar nessa contagem atividades como Check-ins, registros do Diário, questionários concluídos e interações com conteúdos da plataforma. Quando elegível, o plano é organizado a partir desses dados, passa por revisão humana e deve ser liberado até o dia 5 do mês seguinte. Ele reúne possibilidades práticas de cuidado e não substitui orientação clínica.',
  },
  {
    category: 'Recursos e funcionalidades',
    question: 'Como funciona a Orientação Mensal?',
    answer: 'A Orientação Mensal é um recurso do Plus referente ao mês que acabou de fechar. Entre os dias 1 e 10 do mês seguinte, você pode enviar 1 solicitação sobre o período anterior. A resposta é preparada cuidadosamente por profissional habilitado e enviada em até 7 dias corridos após a solicitação. Se você entrou no Plus nos últimos dias do mês, mantém o direito à orientação daquele mês no mês seguinte. É uma orientação pontual: não é psicoterapia, consulta, diagnóstico ou acompanhamento continuado.',
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
    answer: 'A plataforma usa os dados gerados pelo seu uso — como registros, Check-ins, respostas estruturadas e preferências — para organizar recursos da sua própria conta, como mapas, descobertas, relatórios, planos e recomendações. Quando há processamento automatizado, é usado apenas o contexto necessário para a funcionalidade. A exceção é a Orientação Mensal: a resposta final é preparada por profissional habilitado a partir da sua solicitação e do contexto escolhido. Nenhum desses recursos produz diagnóstico clínico.',
  },

  // Saúde e segurança
  {
    category: 'Saúde e segurança',
    question: 'Vocês fazem diagnósticos?',
    answer: 'Não. A plataforma é uma ferramenta de autoconhecimento e organização emocional. Não realizamos diagnósticos, não prescrevemos tratamentos e não substituímos avaliação de profissionais de saúde habilitados.',
  },
  {
    category: 'Saúde e segurança',
    question: 'O plano Plus substitui o acompanhamento com psicólogo?',
    answer: 'Não. O Plus reúne tudo do Essencial e acrescenta recursos como Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal. A Orientação Mensal é preparada por profissional habilitado, mas responde a uma solicitação pontual e não representa psicoterapia, consulta, avaliação clínica ou acompanhamento continuado.',
  },
  {
    category: 'Saúde e segurança',
    question: 'E se eu estiver em crise?',
    answer: 'Se você estiver em crise, pensando em se machucar ou em situação de emergência, procure ajuda imediatamente. No Brasil, ligue para o CVV 188 (gratuito, 24h) ou para o SAMU 192. A Vida Não Colabora não é um serviço de emergência.',
  },
]
