-- Três artigos editoriais públicos: conteúdo educativo, sem promessas clínicas,
-- com estruturas de leitura, perguntas de diário e ligações internas úteis.

INSERT INTO public.articles (
  title, slug, excerpt, summary, content, author, category,
  image_url, cover_image_url, og_image, image_alt,
  status, published, published_at, plan_required,
  read_time, reading_time_minutes, seo_title, seo_description,
  keyword, secondary_keywords, tags, keywords, emotional_themes,
  related_slugs, diary_question, cta_mode, is_guided_content, is_recommendable
)
VALUES
(
  'Como recomeçar depois de uma semana emocionalmente difícil',
  'como-recomecar-depois-de-uma-semana-emocionalmente-dificil',
  'Um jeito gentil e prático de retomar a rotina depois de uma semana pesada, sem transformar o recomeço em mais uma cobrança.',
  'Quando a semana foi difícil, recomeçar não exige compensar tudo. Exige escolher um ponto de apoio possível para hoje.',
  $article$
## Quando a semana não saiu como você esperava

Há semanas que deixam a sensação de que a vida passou por cima da gente: tarefas acumuladas, conversas pendentes, sono bagunçado, pouca energia para responder mensagens ou cuidar do básico. Depois delas, é comum surgir a vontade de “colocar tudo em ordem” de uma vez. Só que essa pressa costuma transformar o recomeço em mais uma fonte de pressão.

Recomeçar não é apagar o que aconteceu nem provar que você voltou a produzir no mesmo ritmo. É recuperar um pouco de direção. Às vezes, o primeiro passo é só reconhecer: **esta semana foi difícil e eu preciso de uma retomada que caiba no meu momento.**

## Antes de reorganizar, faça uma leitura simples da semana

Em vez de perguntar “por que eu não dei conta?”, experimente observar o que ocupou espaço. Um registro curto pode ajudar:

- O que mais consumiu minha energia?
- O que eu consegui sustentar, mesmo que tenha sido pequeno?
- O que ficou pendente porque realmente não coube?
- Do que eu senti falta para atravessar os dias com mais cuidado?

Essa leitura não serve para encontrar culpados. Ela serve para diferenciar uma pendência comum de um limite real. Nem toda lista atrasada é sinal de desorganização; às vezes, ela só mostra que a semana teve mais demanda do que recursos disponíveis.

## Escolha um ponto de apoio, não uma reforma completa

Uma retomada sustentável costuma começar por uma área concreta. Pode ser tomar banho com calma, responder uma mensagem importante, separar roupa para amanhã, preparar uma refeição simples ou abrir a agenda por cinco minutos. O critério não é escolher a tarefa mais “impressionante”; é escolher uma que devolva um pouco de previsibilidade.

Tente completar a frase: **“Hoje, eu vou facilitar o meu amanhã fazendo apenas…”**. Depois, mantenha a resposta pequena o suficiente para caber mesmo num dia sem muita energia.

## Faça uma lista em três partes

Se há muitas coisas pendentes, coloque tudo no papel e separe em três grupos:

1. **Precisa de atenção agora:** algo com prazo próximo ou impacto real.
2. **Pode esperar:** importante, mas não urgente nesta semana.
3. **Pode ser reduzido, pedido a alguém ou deixado de lado:** tarefas que não precisam carregar só você.

Essa divisão diminui o ruído mental. Uma lista única faz tudo parecer igualmente urgente; quando você prioriza, consegue enxergar que nem tudo precisa ser resolvido hoje.

## Diminua a meta antes de desistir dela

Se a ideia era voltar a caminhar, talvez hoje seja vestir uma roupa confortável e dar uma volta curta. Se era organizar a casa, talvez seja liberar uma superfície. Se era retomar um projeto, talvez seja abrir o arquivo e anotar o próximo passo.

Diminuir a meta não é fazer de conta que ela não importa. É criar uma versão possível dela. Quando o corpo e a mente estão cansados, metas menores ajudam a reconstruir confiança sem exigir uma energia que ainda não voltou.

## Monte um “mínimo viável” para os próximos dois dias

Você não precisa planejar a semana inteira para retomar o eixo. Escolha apenas dois dias e defina:

- uma prioridade prática;
- uma necessidade básica que merece atenção;
- um intervalo de pausa realista;
- uma coisa que você não vai se cobrar de resolver agora.

Exemplo: “Amanhã eu resolvo a conta que vence, almoço sem pular a refeição, fico dez minutos longe das notificações e não decido o resto do mês.” O plano não precisa ser bonito. Precisa ser utilizável.

## Observe o jeito como você fala consigo

Depois de uma semana difícil, a autocrítica pode aparecer disfarçada de motivação: “agora você tem que compensar”, “não pode perder mais tempo”, “todo mundo consegue”. Vale interromper esse tom e perguntar: **eu falaria assim com alguém de quem gosto que estivesse cansado?**

Uma linguagem mais honesta pode ser: “eu queria que tivesse sido diferente, mas posso escolher o próximo passo.” Isso não elimina a frustração. Só impede que ela vire uma punição contínua.

## Quando é hora de procurar apoio

Se as semanas difíceis estão se repetindo, se o sofrimento está muito intenso ou se você percebe que a segurança está em risco, conversar com alguém de confiança e buscar apoio profissional pode ser importante. Em situação de urgência ou risco imediato, procure o serviço de emergência da sua região.

Este texto é educativo e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.

## Perguntas para o diário

- O que tornou esta semana mais pesada do que eu esperava?
- Qual é a menor ação que pode deixar amanhã um pouco mais simples?
- O que eu preciso parar de exigir de mim por enquanto?

## Para levar com você

Uma semana difícil não define sua capacidade nem invalida o que você já construiu. Retomar pode ser silencioso: uma tarefa menor, uma conversa mais honesta, uma pausa feita antes do limite. O objetivo não é voltar “ao normal” rapidamente; é encontrar um próximo passo que respeite a pessoa que você é hoje.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Pausas e rotina',
  '/images/blog-recomecar-apos-semana-dificil.webp', '/images/blog-recomecar-apos-semana-dificil.webp', '/images/blog-recomecar-apos-semana-dificil.webp',
  'Pessoa escrevendo um plano simples em um caderno, com chá e plantas em uma manhã tranquila.',
  'published', true, now(), 'free', 6, 6,
  'Como recomeçar depois de uma semana emocionalmente difícil | AVNC',
  'Retome a rotina depois de uma semana difícil com passos pequenos, prioridades reais e menos cobrança.',
  'como recomeçar depois de uma semana difícil', 'retomar rotina, cansaço emocional, organização gentil',
  ARRAY['rotina','recomeço','cansaço emocional','autocuidado'], ARRAY['recomeçar','semana difícil','rotina','energia'], ARRAY['cansaco','sobrecarga','autocuidado'],
  ARRAY['como-perceber-se-hoje-foi-um-dia-de-sobrecarga','a-diferenca-entre-descansar-e-fugir-de-tudo','5-sinais-de-que-voce-precisa-desacelerar'],
  'Qual é a menor ação que pode deixar o meu amanhã um pouco mais simples?', 'auto', true, true
),
(
  'Como fazer uma pausa quando a mente não desacelera',
  'como-fazer-uma-pausa-quando-a-mente-nao-desacelera',
  'Uma pausa possível não precisa ser perfeita nem longa: ela pode ajudar você a sair do automático e perceber do que precisa agora.',
  'Pausar não é desaparecer das responsabilidades. É criar alguns minutos de presença para escolher o próximo passo com mais clareza.',
  $article$
## Uma pausa não precisa parecer um retiro

Quando a mente está cheia, a ideia de “parar” pode soar impossível. Há mensagens, tarefas, pensamentos repetitivos e a sensação de que se você diminuir o ritmo, tudo vai atrasar. Por isso, uma pausa útil não começa exigindo silêncio absoluto ou uma hora livre. Ela começa abrindo um intervalo pequeno entre o que aconteceu e o que você fará em seguida.

Pausar é uma forma de perceber o próprio estado antes de responder no impulso. Não resolve todos os problemas, mas pode impedir que o cansaço vire o único guia do seu dia.

## Reconheça os sinais de que você entrou no automático

Cada pessoa percebe a sobrecarga de um jeito. Alguns sinais comuns são reler a mesma mensagem várias vezes, pular refeições sem notar, se irritar com interrupções pequenas, abrir muitas abas e não concluir nenhuma ou sentir que o corpo está tenso sem saber exatamente por quê.

O sinal não é um diagnóstico. É um convite à observação: **o que está acontecendo comigo neste momento?** Nomear o estado — cansado, acelerado, disperso, irritado, preocupado — já pode diminuir a sensação de confusão.

## Use o método “parar, notar, escolher”

Você pode praticar em dois ou cinco minutos:

1. **Parar:** interrompa uma ação por um instante. Afaste-se da tela, solte os ombros ou apoie os pés no chão.
2. **Notar:** observe uma coisa no corpo, uma emoção e uma necessidade. Por exemplo: “meu maxilar está tenso, estou impaciente e preciso de menos estímulo.”
3. **Escolher:** faça uma ação pequena compatível com isso. Pode ser beber água, ir até a janela, respirar mais devagar por algumas voltas, anotar uma preocupação ou adiar uma resposta que não precisa ser imediata.

O valor está em escolher, não em executar o ritual “certo”.

## Crie uma pausa que caiba na sua rotina

Em vez de esperar a exaustão, amarre a pausa a momentos que já existem: depois de uma reunião, antes de abrir redes sociais, ao chegar em casa, antes de começar uma tarefa que você vem evitando. Um lembrete discreto pode ser uma pergunta no papel: **“como eu estou chegando aqui?”**

Você também pode ter uma lista curta de pausas preferidas. Três opções costumam bastar: ficar um minuto sem telas, tomar algo devagar, ouvir uma música inteira sentado, caminhar até outro cômodo, lavar o rosto, escrever três linhas. Ter alternativas evita que a pausa vire mais uma decisão cansativa.

## Diferencie pausa de fuga

Uma pausa cuida do intervalo e ajuda você a voltar com mais presença. A fuga costuma deixar a questão ainda mais pesada porque você se desconecta sem combinar um retorno. Não há culpa em precisar se distrair; a diferença está em dar nome ao que você está fazendo.

Experimente dizer: “vou ficar dez minutos longe disso e depois vou decidir qual é o próximo passo.” Essa frase coloca limite no intervalo sem transformar descanso em cobrança.

## Se o tempo é curto, reduza o estímulo

Nem sempre será possível sair do ambiente ou cumprir uma rotina completa. Nesses momentos, tente reduzir uma camada de estímulo: feche uma aba, silencie uma notificação, deixe o celular fora do alcance enquanto termina uma tarefa, escolha uma música sem letra ou faça apenas uma coisa por vez durante cinco minutos.

Pequenas reduções não consertam uma agenda impossível, mas dão ao seu sistema um pouco menos para processar de uma vez.

## Faça um registro de uma linha

Depois da pausa, anote apenas: “Antes eu estava ___; agora eu percebo ___; meu próximo passo é ___.” Esse tipo de registro cria memória sobre o que ajuda você. Com o tempo, é possível perceber horários, situações e formas de cuidado que fazem diferença na sua rotina.

## Quando a pausa não é suficiente

Se a aceleração, a angústia ou o esgotamento se mantêm intensos, se afetam sua segurança ou tornam difícil sustentar o básico, procure apoio de alguém de confiança e de um profissional habilitado. Em risco imediato, busque o serviço de emergência da sua região.

Este conteúdo é educativo e não substitui cuidado psicológico, psiquiátrico, médico ou atendimento de emergência.

## Perguntas para o diário

- Em que momento do dia eu mais entro no automático?
- Qual sinal o meu corpo costuma dar antes de eu perceber que estou no limite?
- Que pausa pequena realmente cabe na minha rotina de hoje?

## Para levar com você

Uma pausa não é um prêmio por ter feito tudo. É uma forma de não precisar atravessar tudo sem se notar. Dois minutos de presença podem não mudar o dia inteiro, mas podem mudar o jeito como você encontra o próximo momento.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Autocuidado',
  '/images/blog-pausa-para-mente-sobrecarregada.webp', '/images/blog-pausa-para-mente-sobrecarregada.webp', '/images/blog-pausa-para-mente-sobrecarregada.webp',
  'Pessoa sentada em uma poltrona tranquila, fazendo uma pausa ao lado de uma mesa com chá e plantas.',
  'published', true, now(), 'free', 6, 6,
  'Como fazer uma pausa quando a mente não desacelera | AVNC',
  'Aprenda uma pausa breve e realista para perceber a sobrecarga e escolher o próximo passo com mais clareza.',
  'como fazer uma pausa mental', 'mente acelerada, pausa curta, sobrecarga, autocuidado',
  ARRAY['pausa','sobrecarga','presença','autocuidado'], ARRAY['pausa','mente acelerada','descanso','rotina'], ARRAY['sobrecarga','ansiedade','cansaco'],
  ARRAY['um-exercicio-de-pausa-para-dias-pesados','o-que-observar-quando-a-cabeca-esta-cheia','como-perceber-se-hoje-foi-um-dia-de-sobrecarga'],
  'Que pausa pequena realmente cabe na minha rotina de hoje?', 'auto', true, true
),
(
  'Como conversar sobre os seus limites sem transformar tudo em conflito',
  'como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito',
  'Um guia prático para comunicar limites com clareza, respeito e espaço para a conversa — sem prometer que toda reação será fácil.',
  'Falar de limites não é controlar o outro. É explicar o que você consegue sustentar e o que precisa para continuar em uma relação com respeito.',
  $article$
## Limite não é uma ameaça

Muita gente adia conversas sobre limites porque imagina que dizer “não” vai soar agressivo, egoísta ou frio. Mas um limite bem comunicado não é uma punição nem uma tentativa de controlar o comportamento de outra pessoa. É uma informação clara sobre o que você consegue oferecer, o que precisa preservar e o que fará quando algo ultrapassar esse ponto.

Você não controla se alguém vai gostar de ouvir. Pode, porém, escolher falar com honestidade e respeito.

## Comece pelo que você observa

Conversas difíceis ficam mais claras quando saem de acusações amplas e chegam a fatos concretos. Em vez de “você sempre exige demais”, tente nomear uma situação: “quando recebo mensagens de trabalho à noite e sinto que preciso responder na hora, fico sem espaço para descansar.”

Falar do efeito em você não elimina a responsabilidade do outro, mas reduz a chance de a conversa virar uma disputa sobre intenções.

## Use uma estrutura simples

Uma frase de limite pode ter quatro partes:

1. **Situação:** o que está acontecendo.
2. **Efeito:** como isso impacta você.
3. **Necessidade:** o que precisa mudar.
4. **Ação concreta:** o que você fará para respeitar esse limite.

Exemplo: “Quando os planos mudam em cima da hora, eu fico muito sobrecarregado. Preciso saber com mais antecedência. Se não der para combinar antes, vou preferir não confirmar.”

Essa estrutura evita explicações longas demais e deixa claro que um limite não precisa virar um julgamento sobre a outra pessoa.

## Fale do seu limite, não da personalidade do outro

Há diferença entre “você é invasivo” e “eu não consigo conversar sobre isso agora”. A primeira frase define a pessoa; a segunda informa uma condição. Você pode ser firme sem diagnosticar, humilhar ou tentar vencer a conversa.

Se a relação permitir, também vale abrir espaço para a perspectiva do outro: “quero entender como isso chega para você”. Escutar não obriga você a abandonar o limite. Só torna a conversa mais completa.

## Evite justificar até não sobrar limite

Uma justificativa breve pode ajudar, mas explicar demais às vezes vira um pedido de autorização. Você não precisa apresentar um dossiê para recusar um convite, pedir silêncio, mudar um horário ou dizer que não pode assumir mais uma tarefa.

Frases simples são suficientes:

- “Eu não consigo assumir isso esta semana.”
- “Prefiro conversar quando eu estiver com mais disponibilidade.”
- “Hoje eu preciso ir embora no horário combinado.”
- “Não vou conseguir responder agora; volto a isso amanhã.”

## Prepare-se para a reação sem se abandonar

Algumas pessoas entendem de primeira. Outras se frustram, insistem ou tentam negociar. A reação delas pode ser desconfortável, mas não prova que o seu limite foi errado. Você pode repetir a mensagem com calma: “eu entendo que isso seja chato, e ainda assim não consigo fazer diferente hoje.”

Se a conversa escalar, uma pausa também pode ser limite: “não quero continuar nesse tom. Vou retomar quando for possível conversar com respeito.”

## Comece pelos limites menores

Nem toda conversa precisa começar pelo assunto mais sensível. Praticar em situações menores ajuda a encontrar palavras e observar o que funciona: recusar uma demanda extra, pedir um horário melhor para conversar, avisar que você ficará offline ou escolher não entrar em uma discussão no cansaço.

Limites ganham consistência quando são repetidos no cotidiano, não apenas anunciados em grandes momentos.

## Segurança e apoio

Se comunicar um limite coloca você em risco, envolve ameaça, violência, controle ou medo intenso, priorize sua segurança e procure apoio de pessoas e serviços de confiança. Você não precisa conduzir uma conversa difícil sozinho em uma situação insegura.

Este artigo é educativo e não substitui apoio psicológico, jurídico, social ou de emergência quando necessário.

## Perguntas para o diário

- Em que situações eu digo “sim” quando queria dizer “não”?
- Qual limite pequeno eu consigo comunicar com mais clareza nesta semana?
- O que eu preciso para me sentir seguro ao conversar sobre isso?

## Para levar com você

Um limite não garante que a conversa será confortável. Ele ajuda a tornar visível o que você pode e não pode sustentar. Falar com respeito inclui respeitar também a sua própria disponibilidade.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Relações e limites',
  '/images/blog-conversar-sobre-limites.webp', '/images/blog-conversar-sobre-limites.webp', '/images/blog-conversar-sobre-limites.webp',
  'Duas pessoas conversando com atenção em uma mesa de cozinha acolhedora, com chá e plantas.',
  'published', true, now(), 'free', 7, 7,
  'Como conversar sobre limites sem transformar tudo em conflito | AVNC',
  'Comunique seus limites com clareza e respeito, sem se explicar demais nem transformar a conversa em uma disputa.',
  'como conversar sobre limites', 'dizer não, comunicação assertiva, relações, preservar energia',
  ARRAY['limites','relações','comunicação','autocuidado'], ARRAY['limites','dizer não','conversa difícil','energia'], ARRAY['relacionamentos','sobrecarga','autocuidado'],
  ARRAY['como-perceber-se-hoje-foi-um-dia-de-sobrecarga','o-que-e-autocuidado-emocional-na-vida-real','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigacao'],
  'Qual limite pequeno eu consigo comunicar com mais clareza nesta semana?', 'auto', true, true
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  author = EXCLUDED.author,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  cover_image_url = EXCLUDED.cover_image_url,
  og_image = EXCLUDED.og_image,
  image_alt = EXCLUDED.image_alt,
  status = EXCLUDED.status,
  published = EXCLUDED.published,
  published_at = EXCLUDED.published_at,
  plan_required = EXCLUDED.plan_required,
  read_time = EXCLUDED.read_time,
  reading_time_minutes = EXCLUDED.reading_time_minutes,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  keyword = EXCLUDED.keyword,
  secondary_keywords = EXCLUDED.secondary_keywords,
  tags = EXCLUDED.tags,
  keywords = EXCLUDED.keywords,
  emotional_themes = EXCLUDED.emotional_themes,
  related_slugs = EXCLUDED.related_slugs,
  diary_question = EXCLUDED.diary_question,
  cta_mode = EXCLUDED.cta_mode,
  is_guided_content = EXCLUDED.is_guided_content,
  is_recommendable = EXCLUDED.is_recommendable,
  updated_at = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM public.articles
      WHERE slug IN (
        'como-recomecar-depois-de-uma-semana-emocionalmente-dificil',
        'como-fazer-uma-pausa-quando-a-mente-nao-desacelera',
        'como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito'
      )
        AND status = 'published'
        AND published = true
        AND plan_required = 'free') <> 3 THEN
    RAISE EXCEPTION 'The three public editorial articles were not published correctly';
  END IF;
END;
$$;
