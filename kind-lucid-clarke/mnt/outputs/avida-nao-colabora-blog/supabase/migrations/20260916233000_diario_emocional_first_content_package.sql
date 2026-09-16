-- Primeiro pacote editorial do cluster Diário Emocional.
-- Objetivos: preencher lacunas reais de intenção, reforçar o artigo-pilar e
-- organizar a jornada interna sem criar duplicatas de conteúdos já existentes.
-- Não altera permissões, RLS, planos, preços, Stripe, Diário ou Check-in.

INSERT INTO public.articles (
  title, slug, excerpt, summary, content, author, category,
  image_url, cover_image_url, og_image, image_alt,
  status, published, published_at, plan_required,
  read_time, reading_time_minutes, seo_title, seo_description,
  keyword, secondary_keywords, tags, keywords, emotional_themes,
  related_slugs, diary_question, cta_mode, is_guided_content, is_recommendable,
  content_type, intent, audience
)
VALUES
(
  'Diário emocional: exemplo preenchido passo a passo',
  'diario-emocional-exemplo-preenchido-passo-a-passo',
  'Veja exemplos realistas de registros emocionais preenchidos e entenda como transformar situação, emoção, pensamentos e necessidades em um registro simples, sem buscar a escrita perfeita.',
  'Um exemplo prático de diário emocional para quem quer sair da página em branco e entender o que pode registrar no dia a dia.',
  $article$
## Como é um diário emocional preenchido na vida real?

Entender a ideia de um diário emocional é uma coisa. Sentar diante de uma página vazia e decidir **o que realmente escrever** é outra. Às vezes, a dúvida não é falta de vontade: você só gostaria de ver um exemplo concreto antes de encontrar o seu próprio jeito de registrar o dia.

Um registro emocional não precisa parecer uma redação, ter começo, meio e fim ou chegar a uma grande conclusão. Ele pode ser curto, incompleto e até contraditório. O objetivo é criar um retrato honesto daquele momento: **o que aconteceu, como isso chegou até você e do que talvez você esteja precisando agora**.

A seguir, você verá exemplos fictícios. Eles não são modelos obrigatórios. Use apenas o que fizer sentido e deixe de lado o que não combinar com você.

## Uma estrutura simples para começar

Quando você quiser um pouco mais de direção, experimente cinco pontos:

1. **Situação:** o que aconteceu, sem precisar contar cada detalhe.
2. **Emoção:** o que você percebe que sentiu — mesmo que seja mais de uma coisa.
3. **Pensamentos:** o que passou pela sua cabeça naquele momento.
4. **Reação:** o que você fez, evitou ou sentiu vontade de fazer.
5. **Necessidade ou próximo cuidado:** o que parece importante depois de observar tudo isso.

Você não precisa preencher os cinco itens todos os dias. A estrutura serve para ajudar quando a página em branco trava; não para transformar o diário em formulário.

## Exemplo 1: um dia difícil no trabalho

**Situação**  
Hoje recebi uma mensagem cobrando uma tarefa que eu ainda não tinha terminado. Eu já estava tentando resolver outras coisas ao mesmo tempo.

**Emoção**  
Fiquei irritado e ansioso. Depois veio uma sensação de culpa, como se eu estivesse atrasando tudo.

**Pensamentos**  
Na hora pensei: “eu nunca consigo organizar as coisas direito” e “vão achar que eu não dou conta”.

**Reação**  
Comecei a responder a mensagem imediatamente, mas apaguei várias vezes. Fiquei pulando entre tarefas e terminei o período ainda mais cansado.

**O que percebo agora**  
Talvez a cobrança tenha pesado mais porque eu já estava sobrecarregado antes dela. Amanhã quero escolher primeiro qual tarefa realmente precisa de atenção, em vez de tentar resolver todas ao mesmo tempo.

Perceba que esse registro não tenta decidir se a cobrança foi justa ou injusta. Ele ajuda a separar o acontecimento da reação e cria espaço para observar o que tornou aquele momento tão pesado.

## Exemplo 2: um dia comum que não teve nenhuma grande crise

**Situação**  
O dia foi relativamente tranquilo. Trabalhei, resolvi algumas coisas em casa e conversei com uma pessoa de quem gosto.

**Emoção**  
Senti calma em alguns momentos, mas também um cansaço que apareceu no fim da tarde.

**O que chamou minha atenção**  
Percebi que fiquei melhor depois que saí um pouco da frente da tela e fiz as coisas sem tanta pressa.

**Quero lembrar**  
Nem todo registro precisa nascer de um dia ruim. Hoje eu só quero guardar que houve um pouco de tranquilidade no meio da rotina.

Esse tipo de entrada é importante porque um diário não precisa se transformar em um arquivo apenas das dificuldades. Registrar momentos neutros, agradáveis ou simplesmente comuns ajuda a construir uma visão mais completa dos seus dias.

## Exemplo 3: quando você não sabe explicar o que sente

**Hoje eu não sei explicar direito.**

Estou cansado, um pouco irritado e com vontade de ficar quieto. Não aconteceu nada específico que eu consiga apontar. Talvez tenham sido várias coisas pequenas. Minha cabeça parece cheia, mas eu não quero tentar organizar tudo agora.

Por enquanto, vou registrar só isso. Amanhã posso entender melhor — ou não. Hoje já é suficiente perceber que preciso de menos barulho e um pouco de espaço.

Esse também é um registro válido. Você não precisa encontrar a palavra exata, descobrir a causa de tudo ou terminar a escrita com uma solução. Às vezes, **“não sei ainda” é a informação mais verdadeira disponível**.

## Exemplo 4: quando duas emoções aparecem juntas

**O que aconteceu**  
Recebi uma oportunidade que eu queria há algum tempo.

**O que senti**  
Fiquei feliz e animado, mas quase imediatamente comecei a sentir medo de não conseguir acompanhar.

**O que pensei**  
Uma parte de mim queria comemorar. Outra começou a listar tudo que poderia dar errado.

**O que quero observar**  
Eu não preciso escolher entre estar feliz e estar com medo. As duas coisas podem estar acontecendo ao mesmo tempo. Quero esperar a ansiedade diminuir um pouco antes de tomar decisões sobre os próximos passos.

O diário pode ser especialmente útil quando sentimentos diferentes coexistem. Você não precisa reduzir uma experiência complexa a uma única emoção.

## E se eu preferir escrever livremente?

Ótimo. A estrutura acima é apenas um apoio. Um registro livre poderia ser assim:

> Hoje eu cheguei em casa querendo silêncio. Passei o dia inteiro respondendo coisas e parece que continuei conversando mentalmente mesmo depois que tudo acabou. Não estou exatamente triste. Acho que estou saturado. Quero tomar banho, deixar o celular longe por um tempo e não decidir mais nada hoje.

Não há campos, tópicos ou análise formal. Ainda assim, existem pistas sobre situação, estado emocional e necessidade. O formato pode acompanhar o seu jeito de pensar.

## Quanto preciso escrever?

O suficiente para que o registro seja útil para você. Em alguns dias, isso pode significar algumas linhas. Em outros, uma frase. Quando houver vontade, pode ser uma página inteira.

A frequência também não precisa virar uma prova de disciplina. Um diário emocional pode funcionar como um lugar ao qual você retorna quando quer registrar, compreender ou simplesmente colocar algo para fora.

Se começar parece difícil, o artigo **Como começar um diário emocional sem saber o que escrever** apresenta um caminho mais gradual. E, nos dias em que escrever muito não cabe, **Como registrar seu dia em uma frase** mostra uma alternativa mínima.

## Um modelo que você pode adaptar

Se quiser experimentar agora, copie apenas estas perguntas:

**O que aconteceu hoje que ficou comigo?**  
**O que eu percebo que estou sentindo?**  
**Que pensamento apareceu junto?**  
**Como eu reagi?**  
**Do que eu talvez precise agora?**

Você pode responder todas, escolher uma ou escrever outra coisa completamente diferente.

## Quando reler — e quando não reler

Você não precisa analisar cada entrada assim que termina. Às vezes, escrever já cumpre a função daquele momento. Se decidir reler depois, tente fazê-lo com curiosidade em vez de procurar erros: o que costuma aparecer nos dias mais pesados? O que ajuda? Quais necessidades se repetem?

Quando houver vários registros, essa observação pode ajudar a perceber padrões. O conteúdo **Como identificar padrões nos seus registros emocionais** aprofunda essa etapa para quem já acumulou algum histórico.

## Experimente no seu ritmo

O Diário do **A Vida Não Colabora** existe para oferecer um espaço de registro dentro da sua rotina. Você pode começar pequeno e escrever do seu jeito, sem precisar reproduzir os exemplos desta página.

Se preferir papel, também está tudo bem. O formato é menos importante do que encontrar um espaço que você consiga usar com conforto, privacidade e continuidade.

## Para levar com você

Um diário emocional preenchido não precisa parecer organizado por fora para ser útil por dentro. O registro pode começar com uma situação, uma emoção, uma frase solta ou simplesmente com “não sei explicar hoje”.

A melhor estrutura é aquela que ajuda você a ser honesto consigo sem transformar a escrita em mais uma cobrança.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Diário emocional',
  'https://images.pexels.com/photos/3832034/pexels-photo-3832034.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/3832034/pexels-photo-3832034.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/3832034/pexels-photo-3832034.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'Pessoa escrevendo em um diário aberto em um momento tranquilo de reflexão.',
  'published', true, now(), 'free', 8, 8,
  'Diário Emocional: Exemplo Preenchido Passo a Passo',
  'Veja exemplos preenchidos de diário emocional e aprenda o que registrar sobre situações, emoções, pensamentos e necessidades sem buscar perfeição.',
  'diário emocional exemplo',
  'exemplo de diário emocional, como preencher diário emocional, registro emocional exemplo, o que escrever no diário',
  ARRAY['diário emocional','exemplo de diário','registro emocional','autoconhecimento','escrita pessoal'],
  ARRAY['diário emocional exemplo','como preencher diário emocional','registro emocional','o que escrever no diário'],
  ARRAY['autoconhecimento','emocao','rotina'],
  ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','como-registrar-seu-dia-em-uma-frase','perguntas-simples-para-entender-como-voce-esta-hoje','como-identificar-padroes-nos-seus-registros-emocionais'],
  'Se eu registrasse apenas uma situação de hoje, o que aconteceu e como isso chegou até mim?',
  'auto', true, true, 'article',
  'Mostrar, com exemplos concretos e não clínicos, como um registro emocional pode ser preenchido na vida real e reduzir a barreira da página em branco.',
  'Pessoas que querem começar um diário emocional, mas ainda não sabem como transformar acontecimentos, pensamentos e sentimentos em um registro simples.'
),
(
  'Diário emocional no celular ou no papel: qual escolher?',
  'diario-emocional-no-celular-ou-no-papel',
  'Celular e papel podem funcionar para um diário emocional. Compare privacidade, praticidade, distrações, organização e constância para escolher o formato que combina com sua rotina.',
  'Uma comparação prática entre diário emocional digital e diário em papel, sem tratar uma opção como universalmente melhor.',
  $article$
## Diário emocional digital ou no papel: existe uma escolha melhor?

Você decidiu registrar o que sente, mas aparece uma dúvida muito prática: **é melhor escrever no celular ou manter um caderno?**

Não existe uma resposta única. O formato mais útil costuma ser aquele que combina três coisas: você consegue acessá-lo quando precisa, sente segurança para escrever com sinceridade e consegue voltar a ele sem transformar o hábito em obrigação.

Papel e digital oferecem experiências diferentes. Compará-los ajuda a escolher pelo que realmente importa para a sua rotina — e não pela imagem de como um diário “deveria” ser.

## Diário no papel: por que tanta gente prefere escrever à mão

Um caderno cria um espaço fisicamente separado das notificações, aplicativos e abas que disputam atenção. Para algumas pessoas, o simples gesto de abrir o diário, pegar uma caneta e escrever já funciona como um pequeno ritual de desaceleração.

No papel, você também tem liberdade total de formato. Pode escrever atravessado, desenhar, circular palavras, colar algo, fazer setas ou deixar metade da página vazia. Não existe interface dizendo onde cada coisa deve entrar.

### Pontos fortes do papel

- menos interrupções digitais durante a escrita;
- liberdade visual para escrever e rabiscar;
- sensação de ritual e pausa;
- não depende de bateria ou conexão;
- pode ser confortável para quem pensa melhor escrevendo à mão.

### O que vale considerar

Um caderno ocupa espaço físico e precisa ser guardado em um lugar em que você se sinta confortável. Encontrar um registro antigo específico pode levar mais tempo, e carregar o diário nem sempre é prático.

Se a privacidade é uma preocupação, pense também em **onde o caderno ficará e quem tem acesso ao ambiente**. Papel não é automaticamente mais privado; a segurança depende de como ele é armazenado.

## Diário no celular: quando praticidade faz diferença

O celular normalmente já está por perto. Isso reduz a distância entre sentir vontade de registrar e conseguir realmente escrever. Um pensamento que apareceu no ônibus, no intervalo ou antes de dormir pode ser anotado sem precisar esperar até chegar ao caderno.

O formato digital também facilita organizar histórico e manter registros em um mesmo lugar. Dependendo da ferramenta, navegar entre datas e consultar entradas anteriores pode ser mais simples.

### Pontos fortes do digital

- acesso rápido em diferentes momentos do dia;
- não exige carregar um objeto adicional;
- digitação pode ser mais rápida para algumas pessoas;
- histórico tende a ser mais fácil de organizar e consultar;
- combina com quem já usa o celular para estruturar a rotina.

### O que vale considerar

O mesmo aparelho que abre seu diário também recebe mensagens, vídeos, e-mails e notificações. Se isso costuma quebrar sua concentração, vale silenciar interrupções durante alguns minutos ou criar um pequeno ritual antes de escrever.

Também é importante escolher uma ferramenta cuja proposta de privacidade faça sentido para você e proteger o próprio aparelho com os recursos de segurança disponíveis.

## Privacidade: a pergunta não é apenas “papel ou digital”

Um diário pode guardar pensamentos muito particulares. Por isso, a comparação precisa incluir uma pergunta concreta: **em qual formato eu me sinto mais seguro para escrever de verdade?**

No papel, considere armazenamento físico. No digital, considere proteção do dispositivo, conta e funcionamento do serviço utilizado.

No **A Vida Não Colabora**, Diário e Check-ins são espaços particulares da experiência do usuário e a Política de Privacidade explica como esses registros são tratados. Antes de escolher qualquer serviço digital, vale conhecer a política correspondente e decidir se ela atende ao nível de confiança que você procura.

## E a sensação de escrever: muda alguma coisa?

Pode mudar — principalmente porque as pessoas têm preferências diferentes. Há quem desacelere quando escreve à mão e quem se irrite porque os pensamentos chegam mais rápido do que a caneta acompanha. Há quem se concentre melhor diante do caderno e quem só consiga manter constância quando pode digitar em qualquer lugar.

Você não precisa escolher o formato que parece mais bonito. Escolha o que reduz atrito.

Uma pergunta útil é: **quando eu tiver um dia cansativo, qual opção ainda parece possível?**

## Quando o papel pode combinar mais com você

Considere experimentar papel se você:

- quer alguns minutos longe das telas;
- gosta de escrever à mão;
- valoriza um ritual físico de começo e fim;
- prefere páginas livres, desenhos ou organização visual própria;
- tem um local adequado para guardar o caderno.

Isso não significa que você precise escrever páginas inteiras. Um caderno também pode receber apenas uma frase por dia.

## Quando o digital pode combinar mais com você

O digital pode ser mais conveniente se você:

- quer registrar algo assim que percebe;
- passa boa parte do dia fora de casa;
- prefere digitar;
- quer manter registros organizados por data;
- costuma abandonar hábitos quando eles exigem lembrar de levar algo separado.

Se o problema forem as distrações, experimente abrir o espaço de escrita e ativar alguns minutos sem notificações.

## Posso usar os dois?

Sim. Não existe obrigação de fidelidade ao formato.

Você pode usar o celular para registros rápidos durante a semana e escrever à mão quando quiser mais tempo. Pode manter um caderno para textos livres e usar um diário digital para acompanhar o cotidiano. Ou alternar conforme a fase da vida.

O único cuidado é não criar um sistema tão complexo que você passe mais tempo administrando o diário do que escrevendo nele.

## Faça um teste de sete dias sem transformar isso em meta

Se ainda estiver em dúvida, experimente observar os formatos em vez de decidir no abstrato.

Durante alguns dias, faça registros curtos no formato que parecer mais acessível. Depois pergunte:

- Em qual deles eu comecei com menos resistência?
- Em qual me senti mais à vontade para ser sincero?
- O que mais me distraiu?
- Eu gostaria de encontrar esses registros novamente daqui a algumas semanas?
- O formato cabe na minha rotina quando o dia está cheio?

Não precisa contabilizar dias perfeitos nem manter sequência. O teste serve apenas para perceber preferências.

## Se você escolher o celular

O Diário do **A Vida Não Colabora** é uma opção para manter registros emocionais dentro da experiência do AVNC. Você pode começar com pouco, escrever no seu ritmo e usar os conteúdos do cluster Diário Emocional como apoio quando não souber por onde seguir.

Se a página em branco ainda trava, comece por **Como começar um diário emocional sem saber o que escrever**. Se quiser visualizar um registro pronto antes de fazer o seu, veja **Diário emocional: exemplo preenchido passo a passo**.

## Se você escolher papel

Você continua podendo usar as mesmas perguntas e estruturas. Um caderno simples já basta. Não é necessário comprar um diário específico, decorar páginas ou seguir um método fechado.

O registro pertence a você, e a ferramenta deve se adaptar à sua vida — não o contrário.

## Para levar com você

Papel pode oferecer ritual e distância das telas. O celular pode oferecer disponibilidade e organização. Nenhuma dessas vantagens importa se o formato escolhido faz você evitar a escrita.

Entre o diário “ideal” e o diário que você realmente consegue usar, prefira o segundo.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Diário emocional',
  'https://images.pexels.com/photos/8132513/pexels-photo-8132513.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/8132513/pexels-photo-8132513.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/8132513/pexels-photo-8132513.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'Pessoa usando um smartphone enquanto escreve em um caderno, representando as opções digital e papel para registros pessoais.',
  'published', true, now(), 'free', 8, 8,
  'Diário Emocional no Celular ou Papel: Qual Escolher?',
  'Compare diário emocional no celular e no papel: privacidade, praticidade, distrações e organização para escolher o formato que combina com você.',
  'diário emocional no celular ou papel',
  'diário digital ou papel, diário emocional digital, diário no celular, escrever diário no caderno',
  ARRAY['diário emocional','diário digital','diário no papel','escrita pessoal','autoconhecimento'],
  ARRAY['diário emocional celular','diário digital ou papel','diário no caderno','registro emocional digital'],
  ARRAY['autoconhecimento','rotina','privacidade'],
  ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','como-registrar-seu-dia-em-uma-frase','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca'],
  'Qual formato me deixa mais à vontade para escrever com sinceridade e voltar quando eu precisar?',
  'auto', true, true, 'article',
  'Comparar papel e digital de forma prática, ajudando o leitor a escolher um formato sustentável sem declarar uma opção universalmente superior.',
  'Pessoas interessadas em começar ou manter um diário emocional e que estão decidindo entre escrever no celular ou em um caderno.'
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
  content_type = EXCLUDED.content_type,
  intent = EXCLUDED.intent,
  audience = EXCLUDED.audience,
  updated_at = now();

-- Reforça o artigo principal para a intenção "como começar" sem mudar sua voz editorial.
UPDATE public.articles
SET
  excerpt = 'Quer começar um diário emocional, mas trava diante da página em branco? Veja um caminho simples para registrar sentimentos e pensamentos sem transformar a escrita em cobrança.',
  summary = 'Um guia acolhedor e prático para começar um diário emocional mesmo quando você não sabe o que escrever.',
  seo_title = 'Como Começar um Diário Emocional: Guia Prático',
  seo_description = 'Aprenda como começar um diário emocional, o que escrever nos primeiros registros e como criar uma prática simples, privada e sem cobrança.',
  keyword = 'como começar um diário emocional',
  secondary_keywords = 'o que escrever no diário emocional, primeiro registro emocional, diário de sentimentos, exemplo de diário emocional',
  related_slugs = ARRAY['diario-emocional-exemplo-preenchido-passo-a-passo','comece-pequeno-um-guia-para-o-primeiro-registro','como-registrar-seu-dia-em-uma-frase','perguntas-simples-para-entender-como-voce-esta-hoje'],
  updated_at = now()
WHERE slug = 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever';

-- Diferencia claramente a intenção do primeiro registro da página-pilar.
UPDATE public.articles
SET
  seo_title = 'Primeiro Registro no Diário Emocional: Como Fazer',
  seo_description = 'Vai fazer seu primeiro registro emocional? Veja um passo a passo simples para começar com poucas linhas e sem exigir uma escrita perfeita.',
  keyword = 'primeiro registro no diário emocional',
  secondary_keywords = 'primeira página do diário, como fazer primeiro registro, começar diário de sentimentos, registro emocional simples',
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','como-registrar-seu-dia-em-uma-frase','faca-seu-primeiro-check-in-emocional'],
  updated_at = now()
WHERE slug = 'comece-pequeno-um-guia-para-o-primeiro-registro';

-- Mantém a intenção minimalista própria do conteúdo de uma frase.
UPDATE public.articles
SET
  seo_title = 'Diário de Uma Frase: Como Registrar Seu Dia',
  seo_description = 'Sem tempo para escrever muito? Aprenda a registrar seu dia em uma frase e criar um diário emocional simples, rápido e sustentável.',
  keyword = 'diário de uma frase',
  secondary_keywords = 'registro diário em uma frase, diário emocional simples, diário rápido, escrever pouco no diário',
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca','por-que-escrever-sobre-o-dia-pode-ajudar-a-organizar-a-mente'],
  updated_at = now()
WHERE slug = 'como-registrar-seu-dia-em-uma-frase';

-- Reposiciona o conteúdo de perguntas como apoio direto à escrita no diário.
UPDATE public.articles
SET
  seo_title = 'Perguntas para Diário Emocional: Ideias para Escrever',
  seo_description = 'Não sabe o que escrever no diário? Use perguntas simples para perceber emoções, organizar pensamentos e começar seu registro de hoje.',
  keyword = 'perguntas para diário emocional',
  secondary_keywords = 'perguntas para escrever no diário, perguntas de autoconhecimento, o que escrever no diário emocional, reflexão diária',
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','como-nomear-uma-emocao-sem-se-cobrar','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'],
  updated_at = now()
WHERE slug = 'perguntas-simples-para-entender-como-voce-esta-hoje';

UPDATE public.articles
SET
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','como-registrar-seu-dia-em-uma-frase','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca'],
  updated_at = now()
WHERE slug = 'por-que-escrever-sobre-o-dia-pode-ajudar-a-organizar-a-mente';

UPDATE public.articles
SET
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','diario-emocional-exemplo-preenchido-passo-a-passo','perguntas-simples-para-entender-como-voce-esta-hoje','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'],
  updated_at = now()
WHERE slug = 'como-nomear-uma-emocao-sem-se-cobrar';

UPDATE public.articles
SET
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','perguntas-simples-para-entender-como-voce-esta-hoje','como-nomear-uma-emocao-sem-se-cobrar','diario-emocional-exemplo-preenchido-passo-a-passo'],
  updated_at = now()
WHERE slug = 'como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per';

UPDATE public.articles
SET
  related_slugs = ARRAY['como-comecar-um-diario-emocional-sem-saber-o-que-escrever','como-registrar-seu-dia-em-uma-frase','diario-emocional-no-celular-ou-no-papel','diario-emocional-exemplo-preenchido-passo-a-passo'],
  updated_at = now()
WHERE slug = 'como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca';
