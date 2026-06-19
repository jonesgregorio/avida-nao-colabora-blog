#!/usr/bin/env python3
"""
insert_missing_category_articles.py

Insere 4 novos artigos de 1200+ palavras no Supabase.
Faz GET para verificar se o slug existe; se sim faz PATCH, se não faz POST.
Usa apenas urllib (sem dependências externas).
"""

import json
import urllib.request
import urllib.error

SUPABASE_URL = "https://lejvvhzluggyxlfwfoxl.supabase.co"
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

ARTICLES = [
    {
        "slug": "quando-voce-esta-cansado-ate-de-tentar",
        "title": "Quando você está cansado até de tentar",
        "category": "Cansaço emocional",
        "summary": "Existe um tipo de cansaço que não passa com sono. É o cansaço de carregar, de tentar, de continuar. Este artigo é para você que chegou nesse ponto.",
        "read_time": 8,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1541199249251-f713e6145474?w=800&q=80",
        "image_alt": "Pessoa apoiada na janela com olhar distante, luz suave ao fundo",
        "content": """Existe um tipo de cansaço que não aparece nas análises de sangue. Não é falta de ferro, não é insônia, não é sedentarismo. É o cansaço de carregar. De tentar. De continuar fingindo que está tudo bem quando não está.

Se você está lendo isso, talvez tenha chegado nesse ponto. E se chegou, precisa saber de uma coisa primeiro: isso não é fraqueza. É o resultado de ter tentado durante muito tempo — às vezes sem perceber, às vezes sem ter escolha.

## O que é esse cansaço?

A exaustão emocional é diferente do cansaço físico. Você pode dormir oito horas e acordar igualmente pesado. Pode tirar um final de semana de folga e voltar na segunda ainda sentindo que não tem mais espaço dentro de você.

Ela acontece quando o volume de demandas emocionais — internas e externas — excede por muito tempo a sua capacidade de processamento. É como um celular que nunca descarrega completamente e vai perdendo a capacidade de segurar carga.

Alguns sinais que talvez você reconheça:

- Acordar cansado mesmo tendo dormido
- Sentir que qualquer tarefa pequena parece um obstáculo enorme
- Dificuldade de sentir prazer em coisas que antes você gostava
- Irritabilidade sem motivo claro
- Vontade constante de sumir, se isolar, desaparecer por um tempo
- Sensação de estar no limite — mas não saber o limite de quê, exatamente
- Dificuldade de tomar decisões simples
- Choro que vem do nada, ou incapacidade de chorar mesmo quando sente que precisaria

Esses não são sinais de que você está quebrando. São sinais de que você chegou em um ponto que precisa de atenção — e que raramente chegamos aqui de uma hora para outra.

## A diferença entre preguiça, pausa e sobrecarga

É importante separar essas três coisas, porque a confusão entre elas costuma gerar ainda mais autocobrança:

**Preguiça** é quando você tem energia disponível e escolhe não usá-la. É uma decisão, não um estado.

**Pausa** é quando você conscientemente decide descansar para recuperar energia. É saudável, necessária e planejada.

**Sobrecarga emocional** é quando você não tem mais energia para repor — e mesmo assim continua tentando, porque não sabe (ou não consegue) parar.

A maioria das pessoas que chegam ao ponto de exaustão emocional não estão com preguiça. Estão com o tanque completamente vazio e ainda assim tentando abastecer o carro enquanto ele está rodando.

## Por que a autocobrança piora tudo

Quando estamos exaustos, o cérebro muitas vezes entra num modo de autocrítica intensa: "eu deveria conseguir lidar com isso", "outras pessoas têm problemas maiores", "eu já tive piores e superei", "estou sendo fraco(a)."

Esse diálogo interno não ajuda a sair do estado de exaustão. Ele adiciona uma camada de sofrimento por cima de outra. É como colocar mais peso nas costas de alguém que já está curvado pelo que carrega.

A autocobrança consome energia. E exatamente quando você não tem energia sobrando, a última coisa que precisa é gastar o que resta se punindo por estar exausto.

## O que fazer quando você está nesse ponto

Não vou te dizer para "fazer uma lista de gratidão" ou "pensar positivo". Quando o cansaço é profundo, essas sugestões chegam como zoeira.

O que realmente pode ajudar:

**Parar de tentar resolver tudo agora.** O estado de exaustão não se resolve com mais esforço. Ele se resolve com menos demanda — pelo menos temporariamente. O que pode esperar? Quais expectativas (suas ou dos outros) podem ser adiadas?

**Identificar o mínimo possível.** Nos dias mais difíceis, qual é o mínimo necessário para você passar o dia? Não o ideal, não o que você "deveria" fazer. O mínimo. Às vezes é só existir. Às vezes é comer alguma coisa e tomar banho. E isso pode ser suficiente por um dia.

**Falar com alguém.** Não precisa ser um psicólogo agora (embora seja a opção mais indicada se esse estado persiste). Pode ser uma pessoa de confiança. Dizer em voz alta "estou muito cansado(a)" já é um alívio diferente de carregar sozinho.

**Criar uma pausa real.** Não pausa de "vou assistir série enquanto fico pensando em tudo que preciso fazer". Uma pausa de verdade — onde você para de exigir de si mesmo(a) por um período determinado. Pode ser 10 minutos, pode ser uma tarde, pode ser um dia.

**Não tomar decisões grandes agora.** Quando estamos exaustos, o julgamento fica comprometido. Não é o momento ideal para decisões importantes sobre relacionamentos, trabalho, moradia. Decida o necessário. O resto pode esperar.

## Rotina mínima para dias difíceis

Nos dias em que você não tem energia para nada, uma rotina mínima pode ser uma âncora:

- Acordar e beber água antes de olhar o celular
- Comer alguma coisa — qualquer coisa
- Sair do ambiente pelo menos uma vez (mesmo que seja só abrir a janela ou dar uma volta no quarteirão)
- Dormir no horário razoável

Isso não é pouco. Nos dias mais difíceis, é tudo.

## Quando procurar ajuda profissional

Se o cansaço emocional está persistindo por semanas, se está afetando seu trabalho, seus relacionamentos, sua saúde, ou se você está tendo pensamentos de que não quer mais estar aqui — esse é o sinal mais claro de que você precisa de apoio profissional.

Psicólogos existem exatamente para esse tipo de situação. Não apenas para "casos graves". Para qualquer pessoa que está sofrendo e precisa de ajuda para processar isso.

Se você está em crise agora, o CVV atende 24h pelo número **188** ou pelo site cvv.org.br.

## Perguntas para o diário

- O que eu tenho carregado que talvez não seja meu para carregar?
- Qual é o mínimo que eu preciso para passar hoje com um pouco mais de leveza?
- O que eu precisaria ouvir agora — de mim mesmo(a) ou de alguém?
- Que parte de mim está mais cansada? (o corpo, os pensamentos, as emoções, os relacionamentos?)
- O que eu deixaria de fazer hoje se soubesse que isso seria cuidar de mim?

## Aviso importante

Este artigo é um conteúdo de apoio ao autoconhecimento. Não substitui acompanhamento psicológico, psiquiátrico ou médico. Se você está passando por exaustão emocional severa ou pensamentos de autolesão, procure ajuda profissional.""",
    },
    {
        "slug": "como-criar-uma-rotina-emocional-sem-pressao",
        "title": "Como criar uma rotina emocional sem pressão",
        "category": "Rotina e hábitos",
        "summary": "Uma rotina emocional não precisa ser rígida, extensa ou perfeita. Ela só precisa ser possível para você — hoje, com a vida que você tem.",
        "read_time": 7,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80",
        "image_alt": "Mesa organizada com caderno, caneta e xícara de café, luz natural",
        "content": """Quando a gente fala em "criar uma rotina", a imagem que vem à cabeça costuma ser a de acordar cedo, fazer exercício, meditar, escrever no diário, tomar café saudável e começar o dia produtivo antes das 8h.

Essa imagem pode funcionar para algumas pessoas. Para a maioria, ela gera mais culpa do que cuidado.

Uma rotina emocional real é diferente. Ela existe para te apoiar — não para te cobrar.

## O que é uma rotina emocional?

É um conjunto de práticas simples e intencionais que ajudam você a se manter conectado(a) com o que está sentindo ao longo do dia. Ela não precisa ser longa. Não precisa ser todo dia. Não precisa ser igual à de ninguém.

O que ela precisa ser: possível para você, na vida que você tem agora.

Não a vida ideal, não a versão mais organizada de você — a vida atual, com os compromissos que existem, com o cansaço real, com os dias bons e ruins que vêm sem avisar.

## Por que a maioria das rotinas falha?

Porque foi criada para a versão motivada de você — e não sobrevive ao contato com a realidade.

Você cria um plano incrível num domingo à tarde: acordar às 6h, fazer 30 minutos de exercício, escrever 3 páginas no diário, meditar, tomar café com calma. Na segunda-feira, o despertador toca, você está exausto(a), e nenhuma dessas coisas acontece.

Conclusão imediata: "Falhei. Não tenho disciplina. Sou péssimo(a) nisso."

Mas o problema não é você. É a distância entre o plano e o que era realmente possível.

## Como criar uma rotina que sobrevive aos dias ruins

**Comece pelo menor passo possível.**

Se você quer começar a escrever no diário, não comece com "escreverei 1 página por dia". Comece com "escreverei 1 frase por dia". Isso parece insuficiente — e é exatamente por isso que funciona. É tão pequeno que você consegue fazer mesmo nos piores dias.

**Use âncoras.**

Âncoras são momentos do dia que já existem na sua vida. O café da manhã. O banho. O momento de deitar. Nesses momentos, adicione uma coisa pequena.

Por exemplo: toda vez que você tomar café, vai respirar fundo três vezes antes de começar. Toda vez que você for dormir, vai escrever uma palavra descrevendo como foi o dia.

A âncora faz com que o novo hábito "pegue carona" em algo já estabelecido — e isso aumenta muito a chance de acontecer.

**Aceite a imperfeição como parte da rotina.**

Uma rotina não é um compromisso de 100% de cumprimento. É uma direção. Se você consegue fazer 3 de 5 dias, isso é muito melhor do que 0.

Quando você erra um dia (e vai errar), a pergunta não é "por que não consegui?", é "o que me impediu e como posso tornar isso mais fácil amanhã?"

## Exemplos de rotina emocional leve

Aqui estão três formatos diferentes, do mais simples ao um pouco mais estruturado:

**Versão mínima (5 minutos por dia):**
- Manhã: antes de pegar o celular, perguntar a si mesmo(a): "como estou agora?"
- Noite: escrever uma palavra no diário descrevendo o dia

**Versão básica (15 minutos por dia):**
- Manhã: beber água, respirar 3 vezes, checar como você está (2 min)
- Tarde: uma pausa de 5 minutos longe da tela
- Noite: escrever 3 coisas que aconteceram hoje (boas ou ruins) + como você está se sentindo

**Versão mais completa (30 minutos por dia, para dias com mais espaço):**
- Manhã: 10 minutos de movimento (caminhada, alongamento, o que couber)
- Tarde: uma refeição sem tela
- Noite: 10 minutos de diário com perguntas guiadas + checar o que precisa para o próximo dia

Nenhum desses formatos é melhor que o outro. O melhor é o que você consegue manter.

## O check-in diário emocional

Um elemento que faz toda a diferença na rotina emocional é o check-in — um momento simples de verificar como você está.

Pode ser só uma pergunta: "como estou hoje?" E uma resposta honesta — mesmo que seja "não sei", "pesado(a)" ou "bem, surpreendentemente".

Com o tempo, esse check-in cria consciência emocional. Você começa a notar padrões: "toda segunda de manhã estou mais ansioso(a)", "quando durmo bem, me sinto muito diferente", "reuniões seguidas me deixam mais irritado(a) do que percebo na hora."

Essa consciência é o ponto de partida para qualquer mudança real.

## Autocuidado sem cobrança

Um dos maiores erros é transformar o autocuidado em mais uma tarefa a cumprir. Quando a rotina emocional começa a parecer obrigação, ela perdeu o sentido.

Se você estiver sentindo que sua rotina está te cobrando mais do que te apoiando, é hora de simplificar. Isso não é fracasso — é ajuste.

A pergunta que guia uma boa rotina emocional não é "o que eu deveria fazer?" É "o que me faz bem com a energia que tenho agora?"

## Como organizar pensamentos com a rotina

Um benefício secundário de ter uma rotina emocional é que ela ajuda a organizar os pensamentos. Quando você cria espaços regulares para checar como está, os pensamentos têm um lugar para "pousar" — em vez de ficarem circulando sem parar.

Escrever, mesmo que brevemente, é especialmente útil para isso. Quando você coloca em palavras o que está na cabeça, o cérebro para de tentar "guardar" aquele pensamento em loop — porque ele já está registrado em algum lugar.

## Perguntas para o diário

- Como tem sido minha relação com rotina? Ela me apoia ou me cobra?
- Qual seria o menor hábito possível que me ajudaria a me sentir um pouco mais conectado(a) comigo mesmo(a)?
- O que me impede de manter uma rotina emocional?
- Quais momentos do meu dia já existem que poderiam virar âncoras para pequenas práticas?
- Como eu quero me sentir ao final do dia? O que contribui para isso?

## Aviso importante

Este conteúdo é de apoio ao bem-estar emocional e autoconhecimento. Não substitui acompanhamento psicológico, médico ou psiquiátrico. Se você está passando por dificuldades significativas, considere buscar apoio profissional.""",
    },
    {
        "slug": "o-que-fazer-quando-a-cabeca-nao-desliga",
        "title": "O que fazer quando a cabeça não desliga",
        "category": "Pensamentos difíceis",
        "summary": "Aquela sensação de mente cheia, pensamentos acelerados e preocupação constante tem nome e tem explicação. E também tem formas de lidar — que você pode começar hoje.",
        "read_time": 8,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=800&q=80",
        "image_alt": "Pessoa olhando para a janela com expressão contemplativa, luz suave",
        "content": """São 23h. Você deveria estar dormindo. Mas a cabeça não para.

Aquela conversa de ontem. A reunião de amanhã. A conta que está atrasada. O que você deveria ter dito. O que vai acontecer se aquilo der errado. E enquanto você tenta desligar, mais pensamentos aparecem — como se o silêncio da noite fosse um convite para que eles tomassem conta.

Isso tem nome: pensamentos acelerados, ruminação, mente hiperativa. E é muito mais comum do que parece.

## O que acontece no cérebro quando os pensamentos não param

O cérebro tem um modo padrão — ativado quando você não está focado em nenhuma tarefa específica — chamado de "modo default". É nesse modo que a mente vagueia, faz conexões, processa memórias.

O problema é que, para muitas pessoas, especialmente sob estresse, esse modo default vai direto para os problemas não resolvidos, as preocupações futuras e os arrependimentos passados. É como se o cérebro tentasse resolver tudo de uma vez — e não consegue.

A ruminação é o padrão de ficar repetindo os mesmos pensamentos sem chegar a uma conclusão. É diferente de refletir ou planejar, que têm começo e fim. A ruminação gira em círculo — e quanto mais você tenta parar, mais ela se intensifica.

## Sinais de que sua cabeça está "cheia demais"

- Dificuldade de dormir porque os pensamentos não param
- Sensação de que sua mente está sempre em segundo plano, mesmo quando você está fazendo outra coisa
- Revisar repetidamente conversas, situações ou decisões
- Preocupação constante com o que pode dar errado
- Dificuldade de estar presente em momentos que deveriam ser agradáveis
- Sensação de estar exausto(a) sem ter feito muita coisa
- Pensamentos que chegam em cadeia: um puxa o outro, que puxa outro

## Por que tentar "parar de pensar" não funciona

A instrução "não pensa nisso" é uma das mais contraproducentes que existem.

Existe um experimento clássico na psicologia: se alguém te diz para não pensar num urso polar branco, o que acontece? Você pensa num urso polar branco.

Tentar suprimir um pensamento faz com que o cérebro o monitore mais — para verificar se você está evitando. O resultado é o oposto do desejado.

O que funciona não é lutar contra o pensamento. É mudar a relação com ele.

## O que realmente ajuda

### 1. Escrever para "esvaziar"

Colocar os pensamentos no papel — mesmo que de forma desorganizada — remove a pressão de "guardar" tudo na cabeça.

Tente isso: por 10 minutos, escreva tudo o que está passando pela sua mente. Sem filtro, sem correção, sem tentar organizar. O objetivo é esvaziar, não estruturar.

Depois de escrever, muitas pessoas relatam uma sensação de leveza — como se o peso de carregar aqueles pensamentos tivesse diminuído.

### 2. Nomear o que você está sentindo

Pesquisas em neurociência mostram que nomear uma emoção reduz sua intensidade. Em vez de só "estar" com o pensamento ansioso, dizer internamente "eu estou preocupado(a) com X" cria uma pequena distância entre você e o pensamento.

Esse distanciamento não elimina a preocupação — mas ajuda a não ser tomado(a) completamente por ela.

### 3. Mudar o canal sensorial

Quando você está em loop de pensamentos, trazer a atenção para algo físico e concreto pode interromper o ciclo — pelo menos temporariamente.

Exemplos:
- Segurar algo frio ou quente e prestar atenção na sensação
- Notar 5 coisas que você consegue ver ao redor
- Caminhar prestando atenção no contato dos pés com o chão
- Ouvir uma música com atenção, identificando cada instrumento

Isso não resolve o problema, mas dá um respiro ao sistema.

### 4. Definir um "horário de preocupação"

Parece estranho, mas funciona para muitas pessoas: escolha um horário fixo de 15-20 minutos por dia para se preocupar "oficialmente". Durante esse tempo, pense nos problemas, anote, planeje.

Fora desse horário, quando um pensamento preocupante aparecer, diga a si mesmo(a): "vou guardar isso para o horário de preocupação." Com o tempo, o cérebro aprende que tem um "lugar" para esse processamento — e fica um pouco mais fácil adiar fora do horário.

### 5. A pausa de respiração

Respiração lenta e consciente ativa o sistema nervoso parassimpático — o modo "descanso e digestão", oposto ao "luta ou fuga" onde os pensamentos acelerados vivem.

Uma técnica simples: inspire contando até 4, segure contando até 4, expire contando até 6. Faça 3 a 5 ciclos. Não elimina a preocupação, mas reduz a intensidade fisiológica do estado.

## Quando os pensamentos são sobre coisas que você não pode controlar

Uma grande parte dos pensamentos acelerados é sobre situações que estão fora do nosso controle. O que vai acontecer no futuro. O que outra pessoa vai pensar. Como uma situação vai se resolver.

Uma pergunta que pode ajudar: "Isso é algo que eu posso fazer alguma coisa a respeito agora?"

Se sim: o que é o menor passo possível?
Se não: o pensamento está consumindo energia sem possibilidade de resolução.

Isso não resolve a preocupação automaticamente. Mas reconhecer que um pensamento está fora da sua área de ação pode ajudar a soltar um pouco.

## Pensamentos noturnos: o caso específico de não conseguir dormir

O momento de deitar é especialmente vulnerável porque é quando as distrações do dia acabam e o cérebro fica "livre" para processar.

Algumas estratégias específicas para pensamentos noturnos:
- Escreva tudo no papel antes de dormir — esvazie a cabeça
- Crie uma "lista de pendências" do que você vai resolver amanhã (tirar da cabeça o peso de lembrar)
- Mantenha a temperatura do quarto mais fresca
- Evite telas por pelo menos 30 minutos antes de dormir
- Se depois de 20-30 minutos você ainda não conseguiu dormir, levante, faça algo calmo e volte quando sentir sono

## Quando buscar ajuda

Se os pensamentos acelerados estão afetando seu sono de forma consistente, sua capacidade de trabalhar ou de estar presente nos relacionamentos, isso vai além do que estratégias individuais conseguem resolver.

Ansiedade generalizada, TOC, depressão e outros quadros têm pensamentos acelerados como sintoma — e respondem bem ao tratamento com acompanhamento profissional.

## Perguntas para o diário

- Quais pensamentos aparecem com mais frequência quando minha cabeça "não desliga"?
- Esses pensamentos são sobre o passado, o presente ou o futuro?
- O que eles têm em comum? Há um tema central?
- Existe algo que eu poderia fazer concretamente sobre algum deles?
- O que minha cabeça parece estar tentando resolver — mesmo que não consiga?

## Aviso importante

Este conteúdo é informativo e de apoio ao autoconhecimento emocional. Não substitui avaliação ou acompanhamento de psicólogo, psiquiatra ou médico. Se você está sofrendo com pensamentos intrusivos frequentes, procure apoio profissional.""",
    },
    {
        "slug": "o-que-escrever-no-diario-quando-voce-nao-sabe-por-onde-comecar",
        "title": "O que escrever no diário quando você não sabe por onde começar",
        "category": "Diário emocional",
        "summary": "A página em branco pode paralisar. Mas você não precisa de inspiração nem de clareza para começar a escrever. Precisa só de uma pergunta simples.",
        "read_time": 7,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&q=80",
        "image_alt": "Caderno aberto com caneta sobre mesa de madeira, ambiente aconchegante",
        "content": """Você abre o diário. Olha para a página em branco. E... nada vem.

Ou vem muita coisa ao mesmo tempo — tão misturada que você não sabe por onde começar. Então fecha e vai fazer outra coisa.

Esse bloqueio acontece com a maioria das pessoas, especialmente no início. E também nos dias em que você mais precisaria escrever — mas está tão no automático, tão cansado(a) ou tão confuso(a) que não consegue nem começar.

A boa notícia: você não precisa de inspiração para escrever no diário. Não precisa de clareza, de eloquência ou de nada elaborado. Precisa só de uma entrada. Qualquer entrada.

## Por que a página em branco trava a gente

A maioria das pessoas carrega uma ideia (não muito consciente) de que o diário precisa ser literário, profundo, bem escrito ou revelador.

Essa expectativa é o maior obstáculo.

Se você acha que precisa produzir algo significativo, qualquer coisa que surgir vai parecer insuficiente. Aí não sai nada.

A verdade é que o diário emocional não é sobre o que você escreve. É sobre o ato de escrever — e o que esse ato faz com o que está dentro de você.

Pesquisas mostram que escrever sobre emoções — mesmo de forma desorganizada — ajuda o cérebro a processar e criar distância emocional de situações difíceis. O diário funciona independentemente de qualidade literária.

## Por onde começar quando não sabe por onde começar

### Método 1: Escreva o caos

Em vez de tentar organizar o que você está sentindo, escreva exatamente como está: "Não sei por onde começar. Estou com muita coisa na cabeça e nada saindo direito. Acho que estou [cansado(a) / confuso(a) / ansioso(a) / sem energia]."

Isso já é começar. E muitas vezes, depois de escrever o caos, algo mais específico começa a aparecer.

### Método 2: Comece com o corpo

Antes de tentar nomear uma emoção, descreva o que sente fisicamente: "Tenho um aperto no peito. Meus ombros estão travados. Estou respirando de forma superficial."

O corpo frequentemente sabe o que a mente ainda não conseguiu nomear. Descrever o corpo é uma porta de entrada para o emocional.

### Método 3: Complete uma frase simples

Escolha uma dessas e escreva o que vier:

- "Hoje eu estou..."
- "O que mais me ocupou hoje foi..."
- "Estou com dificuldade de..."
- "Eu precisaria de..."
- "Se pudesse mudar uma coisa sobre hoje..."
- "O que estou evitando pensar é..."

Não existe resposta certa. O que vier, veio.

### Método 4: Use fragmentos

O diário não precisa de frases completas. Pode ser uma lista de palavras: "trabalho / cansaço / aquela conversa / não sei / pesado / quero sumir / mas também tem o café da manhã que foi bom."

Fragmentos são válidos. Às vezes eles capturam melhor o estado emocional do que frases bem construídas.

### Método 5: Defina um tempo curto

Coloque um timer de 5 minutos e escreva sem parar — sem corrigir, sem reler, sem julgar. O que sair, sai. Quando o timer tocar, pode parar.

Esse formato remove a pressão de "quantidade" e dá um limite definido, que é mais fácil de aceitar.

## Exemplos práticos de entradas de diário

Aqui estão exemplos reais do tipo de entrada que funciona — sem ser elaborada:

**Exemplo 1 (dia difícil, pouca energia):**
"Hoje foi pesado. Não sei bem por quê. Acordei já cansada e o dia foi indo. Não fiz metade do que precisava. Fiquei me cobrando o dia todo. Agora à noite me sinto culpada e também aliviada que acabou."

**Exemplo 2 (confusão emocional):**
"Não sei o que estou sentindo. É como se tivesse tudo misturado. Um pouco de raiva, um pouco de tristeza, um pouco de saudade de algo que não sei bem o quê. Talvez de mim mesma em outro momento?"

**Exemplo 3 (entrada muito curta):**
"6/10 no humor. Cansada. Reunião foi ok. Queria ter mais tempo. Amanhã tô mais animada pra escrever."

**Exemplo 4 (entrada de um dia bom):**
"Hoje foi surpreendentemente bom. Não sei dizer por quê especificamente. Só senti que respirei mais fundo. Quero lembrar disso nos dias ruins."

Perceba: nenhuma dessas entradas é literária. Todas são válidas. Todas capturam algo real.

## O que fazer com o que você escreveu

Não precisa fazer nada com o que escreveu. Só existir no papel já é suficiente.

Se quiser ir além: depois de alguns dias de escrita, releia e observe se aparecem palavras ou temas recorrentes. Isso cria consciência emocional de forma gradual e não forçada.

## Tipos de diário que funcionam para pessoas diferentes

**Diário de uma linha:** uma frase por dia, nada mais. Consistência mínima com máxima viabilidade.

**Diário de humor:** só um número de 1 a 10 e uma palavra. "6 - cansaço." Ao longo do tempo, cria um mapa emocional surpreendentemente útil.

**Diário de perguntas:** você escolhe uma pergunta (do artigo, do app, da sua cabeça) e responde. Sem pressão de escrever espontaneamente.

**Diário de voz:** gravar um áudio para si mesmo(a) contando como foi o dia. Alguns acham mais fácil falar do que escrever.

**Diário digital vs. papel:** não existe certo e errado. O melhor formato é o que você vai realmente usar.

## O que o diário não é

- Não é um relatório de produtividade
- Não é um espaço para você se julgar
- Não é obrigação de escrever todo dia
- Não precisa ser lido por ninguém (incluindo você, no futuro, se não quiser)
- Não precisa ter início, meio e fim

É só um espaço para você e o que você está sentindo. Sem audiência. Sem julgamento.

## Perguntas para o diário (para começar agora)

- Como estou me sentindo neste exato momento?
- O que passou pela minha cabeça hoje que ficou sem lugar?
- Qual foi o momento mais difícil do dia? E o mais leve?
- O que eu precisaria amanhã que hoje não tive?
- Se eu fosse escrever uma frase sobre como estou, qual seria?

## Aviso importante

O diário é uma ferramenta de autoconhecimento e organização emocional. Não substitui acompanhamento psicológico ou psiquiátrico. Se o que você escreve revelar sofrimento intenso e persistente, considere buscar apoio profissional.""",
    },
]


def check_exists(slug: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}&select=id"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return len(data) > 0
    except urllib.error.HTTPError as e:
        print(f"  Erro ao verificar {slug}: {e.code} {e.read().decode()}")
        return False


def insert_article(article: dict):
    url = f"{SUPABASE_URL}/rest/v1/articles"
    body = json.dumps(article).encode("utf-8")
    headers = {**HEADERS, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  INSERIDO: {article['slug']} (status {resp.status})")
    except urllib.error.HTTPError as e:
        print(f"  ERRO ao inserir {article['slug']}: {e.code} {e.read().decode()}")


def patch_article(slug: str, article: dict):
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}"
    body = json.dumps(article).encode("utf-8")
    headers = {**HEADERS, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  ATUALIZADO: {slug} (status {resp.status})")
    except urllib.error.HTTPError as e:
        print(f"  ERRO ao atualizar {slug}: {e.code} {e.read().decode()}")


def main():
    print("=== Inserindo/atualizando artigos de categorias ausentes ===\n")
    for article in ARTICLES:
        slug = article["slug"]
        print(f"Processando: {slug}")
        if check_exists(slug):
            print(f"  Slug já existe — fazendo PATCH...")
            patch_article(slug, article)
        else:
            print(f"  Slug não existe — fazendo INSERT...")
            insert_article(article)
    print("\n=== Concluído ===")


if __name__ == "__main__":
    main()
