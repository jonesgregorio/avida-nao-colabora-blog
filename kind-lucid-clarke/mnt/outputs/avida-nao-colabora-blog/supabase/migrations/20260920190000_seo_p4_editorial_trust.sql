-- P4: qualidade editorial, linguagem proporcional à evidência e integridade de datas.
-- Não marca reviewed_at: revisão profissional só pode ser registrada quando realmente ocorrer.

update public.articles
set published_at = created_at
where status = 'published' and published_at is null;

update public.articles
set
  title = 'O que pode ajudar durante uma crise de ansiedade',
  seo_title = 'Crise de ansiedade: o que pode ajudar no momento',
  seo_description = 'Veja estratégias de respiração lenta, atenção ao presente e busca de apoio que podem ajudar durante uma crise de ansiedade, sem promessas de efeito imediato.',
  content = $avnc$
# O que pode ajudar durante uma crise de ansiedade

Uma crise de ansiedade ou um ataque de pânico pode trazer medo intenso e sintomas físicos como palpitações, tremores, suor, tontura, falta de ar e sensação de perigo. Esses sintomas podem ser muito desconfortáveis. Ao mesmo tempo, sintomas novos, muito intensos ou diferentes do habitual merecem avaliação de saúde, porque nem todo desconforto no peito, falta de ar ou desmaio deve ser atribuído automaticamente à ansiedade.

Este material é educativo. Ele não diagnostica a causa dos sintomas e não substitui atendimento profissional.

## Primeiro: reduza a exigência de “parar a crise”

Quando o corpo está em alerta, tentar obrigá-lo a ficar calmo imediatamente pode aumentar a sensação de fracasso. Uma meta mais realista é atravessar aquele momento com segurança e diminuir estímulos enquanto a intensidade passa.

Se for possível, procure um lugar em que você se sinta fisicamente seguro. Apoie os pés no chão ou as costas em uma superfície estável. Observe alguns elementos ao redor — cores, formas, sons e pontos de contato do corpo — para trazer a atenção ao presente.

## Respiração lenta pode ser uma estratégia

A Organização Mundial da Saúde inclui técnicas de relaxamento, como respiração lenta, entre estratégias de manejo do estresse que podem ajudar pessoas com ansiedade. A recomendação não significa que uma técnica específica funcione para todas as pessoas nem que interrompa uma crise de forma garantida.

Uma opção simples é diminuir gradualmente o ritmo da respiração, sem forçar uma inspiração muito profunda:

1. solte o ar devagar;
2. inspire de maneira confortável pelo nariz;
3. expire um pouco mais lentamente do que inspirou;
4. repita por alguns ciclos, interrompendo se ficar desconfortável ou tonto.

Não é necessário prender a respiração nem atingir uma contagem perfeita. O objetivo é tornar a respiração menos apressada, não executar um exercício com precisão.

## Dê um nome ao que está acontecendo

Pode ajudar reconhecer mentalmente: “estou sentindo ansiedade e meu corpo está em alerta”. Isso não exige discutir com cada pensamento nem convencer-se de que tudo está bem. É apenas uma forma de separar a sensação intensa de uma conclusão automática de que algo terrível necessariamente está acontecendo.

Durante ataques de pânico, o NHS orienta, quando possível, respirar lenta e profundamente, lembrar que o ataque passa e direcionar a atenção para imagens ou referências tranquilizadoras.

## Reduza estímulos e adie decisões grandes

Se você estiver em um ambiente muito barulhento, cheio de notificações ou cobranças, reduzir estímulos pode facilitar a recuperação. Também pode ser útil adiar decisões importantes até que a intensidade diminua.

Se estiver acompanhado, uma frase simples pode ser suficiente: “estou muito ansioso agora e preciso de alguns minutos em um lugar mais tranquilo”.

## Depois que a intensidade diminuir

Quando estiver mais estável, registre apenas o que for útil: o que aconteceu antes, quais sensações apareceram, o que ajudou e quanto tempo levou para você se sentir melhor. O objetivo não é vigiar o corpo o tempo todo, mas perceber padrões que possam ser discutidos com um profissional.

Crises recorrentes, medo persistente de ter outra crise, mudanças importantes na rotina para evitar situações ou prejuízo no trabalho, sono e relações são motivos para buscar avaliação. Tratamentos eficazes para transtornos de ansiedade existem, incluindo intervenções psicológicas; a OMS destaca abordagens baseadas em terapia cognitivo-comportamental entre as opções com maior evidência.

## Quando procurar atendimento urgente

Procure atendimento de urgência diante de sintomas físicos intensos ou novos que possam indicar outro problema, especialmente dor forte no peito, desmaio, dificuldade importante para respirar ou qualquer situação em que você não consiga avaliar com segurança o que está acontecendo.

Se houver risco de você se machucar, pensamentos de suicídio ou impossibilidade de se manter em segurança, procure ajuda de emergência e apoio de uma pessoa de confiança imediatamente.

## Para levar ao diário

Se fizer sentido depois que o episódio passar, registre:

- O que eu percebi primeiro: pensamento, sensação física ou situação?
- O que tornou o momento um pouco mais tolerável?
- Existe algo que eu gostaria de conversar com um profissional ou pessoa de confiança?

## Fontes e limites

Este conteúdo foi ajustado com base em orientações públicas da Organização Mundial da Saúde sobre transtornos de ansiedade e manejo do estresse e nas orientações do NHS sobre ataques de pânico. As recomendações são gerais e não substituem avaliação individual.

Fontes: Organização Mundial da Saúde — Anxiety disorders; WHO mhGAP — Stress management techniques; NHS — Panic disorder.
$avnc$,
  updated_at = now()
where slug = 'como-se-acalmar-durante-uma-crise-de-ansiedade';

update public.articles
set
  title = 'Telas antes de dormir: o que sabemos sobre o impacto no sono',
  seo_title = 'Telas antes de dormir: impacto no sono',
  seo_description = 'Entenda o que as evidências dizem sobre telas antes de dormir, conteúdo, luz e hábitos noturnos, com mudanças práticas sem simplificar tudo à luz azul.',
  content = $avnc$
# Telas antes de dormir: o que sabemos sobre o impacto no sono

Usar celular, computador, tablet ou televisão perto da hora de dormir pode interferir no descanso de diferentes maneiras. Mas a explicação não se resume a “luz azul bloqueia melatonina e estraga o sono”.

Uma declaração de consenso da National Sleep Foundation publicada em 2024 revisou estudos sobre telas, conteúdo antes de dormir e luz emitida pelos dispositivos. O painel encontrou consenso mais claro para efeitos negativos gerais em crianças e adolescentes e para o papel do conteúdo usado antes de dormir nesse grupo. Para várias afirmações específicas sobre luz pré-sono e para todos os efeitos em adultos, a evidência não permitiu conclusões universais.

Isso muda a forma de pensar o hábito: vale observar não apenas a cor da luz, mas também o tempo que a tela ocupa, o tipo de conteúdo e o quanto o uso mantém você desperto.

## Quatro caminhos pelos quais a tela pode atrapalhar

### 1. Ela pode ocupar o tempo que seria destinado ao sono

“Só mais um vídeo” ou “só mais uma mensagem” pode empurrar o horário de dormir. Nesse caso, o problema não depende de um mecanismo biológico complexo: a tela simplesmente prolonga o período acordado.

### 2. O conteúdo pode aumentar a ativação

Trabalho, discussões, notícias, jogos competitivos ou vídeos muito estimulantes podem dificultar a transição para uma rotina mais calma. O efeito varia entre pessoas e entre tipos de conteúdo.

### 3. A luz pode influenciar o sistema circadiano

Luz à noite pode afetar sinais biológicos relacionados ao sono, mas o efeito depende de fatores como intensidade, duração, horário, distância e características individuais. Por isso, filtros noturnos podem ser úteis como parte de uma rotina, mas não devem ser tratados como solução garantida.

### 4. Notificações podem fragmentar o descanso

Sons, vibrações e o hábito de verificar o aparelho podem manter a atenção ligada ao telefone mesmo depois de deitar.

## Em vez de uma regra rígida, faça um experimento

Você não precisa transformar o sono em outra fonte de cobrança. Escolha uma mudança pequena por alguns dias e observe o resultado.

Algumas possibilidades:

- encerrar atividades de trabalho no celular antes de ir para a cama;
- deixar notificações não essenciais no modo silencioso;
- reduzir conteúdos que você percebe como muito estimulantes à noite;
- deixar o aparelho fora do alcance da cama, se isso for viável;
- trocar parte do tempo de tela por uma atividade tranquila que você goste;
- manter horários de sono mais regulares quando sua rotina permitir.

Não existe um número único de minutos sem tela que funcione para todas as pessoas. Se uma recomendação rígida não cabe na sua rotina, comece pelo comportamento que mais prolonga ou interrompe o seu descanso.

## Observe o que acontece, não apenas o relógio

Durante uma semana, você pode anotar três informações simples:

1. aproximadamente quando encerrou o uso mais estimulante de telas;
2. se demorou mais ou menos que o habitual para adormecer;
3. como se sentiu ao acordar.

Esse registro não serve para diagnosticar insônia. Ele ajuda a perceber se existe uma relação consistente na sua própria rotina.

## E a luz azul?

A luz emitida por telas é um dos fatores estudados, mas tratá-la como a única causa pode desviar a atenção de aspectos importantes, como adiar o horário de dormir, continuar trabalhando, receber notificações ou consumir conteúdo que aumenta o estado de alerta.

Por isso, ativar um filtro de luz pode ser uma escolha confortável, mas não substitui olhar para o conjunto do hábito.

## Quando procurar avaliação

Dificuldade persistente para dormir, despertares frequentes, sonolência importante durante o dia ou cansaço que prejudica a rotina merecem avaliação profissional. Problemas de sono podem ter diferentes causas e não devem ser atribuídos automaticamente ao celular.

## Para levar ao diário

Pergunte a si mesmo:

- Qual uso de tela mais costuma prolongar minha noite?
- O problema parece ser o horário, o conteúdo, as notificações ou uma combinação?
- Qual mudança pequena eu consigo testar sem transformar o descanso em cobrança?

## Fonte e limites

Este conteúdo usa como referência a declaração de consenso da National Sleep Foundation sobre uso de telas e saúde do sono, publicada em Sleep Health em 2024 (PMID 38806392). O próprio consenso registra áreas em que a evidência é insuficiente ou não é uniforme, especialmente para algumas afirmações sobre luz e para diferentes faixas etárias.

Este material é educativo e não substitui avaliação médica ou psicológica.
$avnc$,
  updated_at = now()
where slug = 'como-as-telas-atrapalham-o-sono-e-o-que-mudar-gxmen-y7n';

update public.articles
set
  title = 'Descansar ou adiar? Como perceber a diferença sem culpa',
  seo_title = 'Descansar ou adiar? Como perceber a diferença',
  seo_description = 'Aprenda a observar quando uma pausa está ajudando na recuperação e quando uma pendência continua sendo adiada, sem transformar descanso em culpa.',
  content = $avnc$
# Descansar ou adiar? Como perceber a diferença sem culpa

Nem toda pausa é fuga. Nem todo adiamento significa que você está evitando algo. Às vezes, descansar é exatamente o que permite voltar a uma situação com mais energia e clareza. Em outros momentos, uma tarefa ou conversa continua sendo empurrada porque parece difícil, desconfortável ou grande demais.

A diferença raramente aparece em uma regra simples. Ela costuma ficar mais clara quando você observa o que acontece antes, durante e depois da pausa.

## O que um descanso útil pode ter

Um período de descanso tende a cumprir uma função de recuperação. Você interrompe uma atividade, reduz exigências por algum tempo e depois percebe alguma mudança — mesmo pequena — na energia, atenção ou disposição.

Isso não significa que você precise voltar “100% renovado”. Descanso não é uma máquina de produtividade. A pausa pode ser válida mesmo quando você continua cansado.

Perguntas que podem ajudar:

- Eu escolhi esta pausa porque precisava reduzir o ritmo?
- Estou conseguindo descansar ou passei todo o tempo me culpando?
- Depois da pausa, consigo enxergar um próximo passo um pouco melhor?

## Quando vale observar o adiamento

Às vezes, a pausa termina, mas a mesma questão continua sendo evitada repetidamente. Isso pode acontecer porque a tarefa é confusa, porque existe medo de errar, porque uma conversa é desconfortável ou simplesmente porque você ainda não tem recursos para lidar com aquilo.

Em vez de chamar isso de “fuga”, tente identificar o obstáculo.

Pergunte:

- O que exatamente torna esse próximo passo difícil?
- A tarefa está grande demais?
- Estou com medo de uma consequência específica?
- Preciso de informação, ajuda ou companhia?
- É algo que realmente precisa ser feito agora?

Nomear o obstáculo costuma ser mais útil do que julgar o próprio comportamento.

## Um exemplo simples

Imagine que você precisa responder uma mensagem delicada. Você percebe que está esgotado e decide deixar a resposta para o dia seguinte. Dorme, acorda e consegue organizar melhor o que quer dizer. A pausa teve uma função clara.

Em outro cenário, você abre a conversa todos os dias, sente tensão e fecha o aplicativo sem decidir o que fazer. Talvez o problema não seja falta de descanso. Pode ser útil dividir a situação: escrever um rascunho, pedir opinião a alguém de confiança ou definir um horário para pensar nela por poucos minutos.

Os dois cenários pedem respostas diferentes — e nenhum precisa começar com culpa.

## Exercício: pausa, obstáculo e próximo passo

Pegue uma situação que você vem adiando e complete:

**Pausa:** do que eu preciso me recuperar agora?

**Obstáculo:** o que torna essa situação difícil de retomar?

**Próximo passo:** qual é a menor ação possível que não exige resolver tudo?

O próximo passo pode ser muito pequeno: abrir um documento, anotar três ideias, enviar uma pergunta, marcar uma conversa ou decidir conscientemente que aquilo ficará para outra data.

## Descanso não precisa ser merecido

É comum transformar a pausa em prêmio: “só posso descansar depois de terminar tudo”. O problema é que algumas rotinas nunca ficam completamente vazias.

Descansar faz parte da manutenção da vida. Você não precisa provar exaustão suficiente para justificar cada pausa.

Ao mesmo tempo, perceber um padrão de adiamento pode ser um convite para entender melhor suas necessidades — não uma acusação de preguiça.

## Para levar ao diário

- O que eu esperava que esta pausa me oferecesse?
- Depois dela, o que mudou no meu corpo ou na minha disposição?
- Se ainda estou adiando algo, qual é o obstáculo real?
- Qual próximo passo seria pequeno o bastante para ser possível?

## Quando buscar apoio

Se cansaço, ansiedade, desânimo ou dificuldade para realizar atividades estiverem persistentes e causando sofrimento ou prejuízo importante na rotina, conversar com um profissional de saúde pode ajudar a compreender o que está acontecendo.

Este conteúdo é educativo e não substitui avaliação individual.
$avnc$,
  updated_at = now()
where slug = 'a-diferenca-entre-descansar-e-fugir-de-tudo';
