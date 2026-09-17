-- Primeiro pacote editorial do cluster Emoções e autoconhecimento.
-- Preenche uma lacuna prática de intenção e diferencia páginas públicas já existentes.
-- Não altera permissões, RLS, planos, preços, Stripe, Diário, Check-in ou Jardim.

INSERT INTO public.articles (
  title, slug, excerpt, summary, content, author, category,
  image_url, cover_image_url, og_image, image_alt,
  status, published, published_at, plan_required,
  read_time, reading_time_minutes, seo_title, seo_description,
  keyword, secondary_keywords, tags, keywords, emotional_themes,
  related_slugs, diary_question, cta_mode, is_guided_content, is_recommendable,
  content_type, intent, audience
)
VALUES (
  'Emoção, pensamento ou necessidade: como perceber a diferença',
  'emocao-pensamento-ou-necessidade-como-perceber-a-diferenca',
  'Nem tudo que passa pela cabeça é uma emoção. Veja como separar emoção, pensamento e necessidade em situações do dia a dia sem buscar respostas perfeitas.',
  'Um guia prático para diferenciar o que você sente, o que pensa sobre a situação e do que talvez precise agora.',
  $article$
## Emoção, pensamento e necessidade não são a mesma coisa

Quando alguém pergunta “como você está?”, é comum responder com frases como **“acho que não vou dar conta”**, **“ninguém me entende”** ou **“preciso que isso acabe logo”**. Essas frases dizem algo importante sobre o momento, mas não são necessariamente emoções.

Separar **emoção, pensamento e necessidade** pode ajudar a enxergar melhor o que está acontecendo sem exigir uma análise perfeita. A proposta aqui não é criar uma regra rígida, e sim oferecer três perguntas simples para organizar a experiência.

## 1. Emoção: o que eu percebo que estou sentindo?

Emoções costumam aparecer como palavras como tristeza, irritação, medo, alívio, alegria, frustração, vergonha, culpa, entusiasmo ou insegurança.

Você não precisa encontrar uma palavra exata. Pode começar por aproximações:

- “estou mais irritado do que triste”;
- “parece uma mistura de medo e expectativa”;
- “não sei o nome, mas sinto desconforto”;
- “estou mais leve depois dessa conversa”.

Se nomear ainda parecer difícil, tudo bem. O artigo **Como nomear uma emoção sem se cobrar** aprofunda justamente esse ponto.

## 2. Pensamento: o que minha cabeça está dizendo sobre isso?

Pensamento é a interpretação, previsão ou frase mental que aparece junto da situação.

Exemplos:

- “vou decepcionar todo mundo”;
- “isso sempre acontece comigo”;
- “talvez eu tenha entendido errado”;
- “acho que essa conversa pode dar certo”.

Um pensamento pode influenciar como o momento é vivido, mas não precisa ser tratado como uma descrição completa da realidade. Aqui, basta registrá-lo como **algo que passou pela sua cabeça**.

## 3. Necessidade: o que parece faltar ou fazer diferença agora?

Necessidade não precisa ser uma grande resposta. Pode ser algo concreto e imediato:

- tempo antes de responder;
- descanso;
- informação;
- espaço;
- ajuda prática;
- companhia;
- silêncio;
- clareza sobre um prazo;
- limite em uma conversa.

Às vezes você sabe o que sente, mas não sabe o que precisa. Em outros momentos acontece o contrário. Não é obrigatório preencher as três partes.

## Um exemplo simples

**Situação:** recebi uma mensagem cobrando uma resposta que eu ainda não tinha conseguido preparar.

**Emoção:** fiquei ansioso e irritado.

**Pensamento:** “vão achar que eu sou desorganizado”.

**Necessidade:** preciso de alguns minutos para organizar a resposta e confirmar um prazo realista.

Perceba que “vão achar que eu sou desorganizado” não foi colocado como emoção. É um pensamento ligado à situação. Essa separação pode tornar o registro mais claro sem invalidar o que você sentiu.

## E quando tudo vem misturado?

Na prática, quase sempre vem.

Você pode escrever primeiro do jeito que sair e separar depois, se quiser:

> “Estou péssimo porque ninguém me escuta e queria sumir dessa conversa.”

Depois, com calma, isso poderia virar:

**Emoção:** frustração e cansaço.  
**Pensamento:** “ninguém me escuta”.  
**Necessidade:** interromper a conversa por enquanto e retomá-la em outro momento.

Não existe obrigação de fazer essa divisão toda vez. Ela é apenas uma lente para quando você quer entender melhor um registro confuso.

## Uma quarta pergunta que pode ajudar: o que aconteceu?

Antes de tentar interpretar, vale registrar a situação de forma simples:

**O que aconteceu que ficou comigo?**

Separar o acontecimento da interpretação também ajuda. “A pessoa demorou três horas para responder” descreve algo observável. “Ela não se importa comigo” já é uma interpretação possível sobre esse acontecimento.

Essa diferença não serve para dizer que sua leitura está errada. Serve para mostrar quais partes do registro são fatos observados e quais são conclusões que surgiram depois.

## Um check-in de quatro linhas

Quando quiser experimentar, use apenas estas quatro linhas:

**O que aconteceu?**  
**O que eu sinto ou percebo no corpo?**  
**O que estou pensando sobre isso?**  
**Do que talvez eu precise agora?**

Se uma resposta não vier, escreva “não sei ainda”. Isso também é informação.

## Como isso se conecta ao check-in emocional

O check-in não precisa exigir uma explicação completa sobre você. Ele pode começar com uma fotografia do momento: uma emoção aproximada, um pensamento que está ocupando espaço ou uma necessidade que ficou mais visível.

No **A Vida Não Colabora**, o check-in rápido pode servir como ponto de entrada para registrar como você está agora. Depois, se quiser aprofundar, você pode usar o Diário ou observar recorrências no Mapa Emocional.

## Para levar com você

Uma forma simples de organizar um momento confuso é perguntar:

**O que aconteceu? O que eu sinto? O que estou pensando? Do que talvez eu precise?**

Você não precisa chegar a uma resposta perfeita. A utilidade está em separar partes diferentes da experiência para que tudo não pareça uma única massa difícil de explicar.
$article$,
  'Equipe editorial A Vida Não Colabora', 'Emoções e autoconhecimento',
  'https://images.pexels.com/photos/8133129/pexels-photo-8133129.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/8133129/pexels-photo-8133129.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'https://images.pexels.com/photos/8133129/pexels-photo-8133129.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
  'Pessoa escrevendo em um caderno durante um momento de reflexão.',
  'published', true, now(), 'free', 7, 7,
  'Emoção, Pensamento ou Necessidade: Como Diferenciar',
  'Aprenda a diferenciar emoção, pensamento e necessidade em situações do dia a dia com um roteiro simples e sem buscar respostas perfeitas.',
  'diferença entre emoção pensamento e necessidade',
  'como identificar emoções, emoção ou pensamento, reconhecer necessidades emocionais, entender o que estou sentindo',
  ARRAY['emoções','autoconhecimento','check-in emocional','pensamentos','necessidades'],
  ARRAY['diferença entre emoção pensamento e necessidade','como identificar emoções','emoção ou pensamento','necessidades emocionais'],
  ARRAY['autoconhecimento','emocao','clareza'],
  ARRAY['faca-seu-primeiro-check-in-emocional','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'],
  'O que aconteceu, o que eu sinto, o que estou pensando e do que talvez eu precise agora?',
  'auto', true, true, 'article',
  'Ajudar a diferenciar emoção, pensamento e necessidade em registros cotidianos sem transformar a prática em diagnóstico ou regra rígida.',
  'Pessoas que percebem desconforto ou confusão emocional e querem uma estrutura simples para entender melhor o que está acontecendo.'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
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

UPDATE public.articles SET
  excerpt = 'Faça um check-in emocional simples para perceber como você está agora, sem precisar explicar tudo de uma vez.',
  summary = 'Um primeiro passo curto para observar emoção, energia, pensamentos e necessidades do momento.',
  seo_title = 'Check-in Emocional: Como Fazer Passo a Passo',
  seo_description = 'Veja como fazer um check-in emocional simples para perceber como você está agora e registrar o momento sem transformar a prática em cobrança.',
  keyword = 'como fazer check-in emocional',
  secondary_keywords = 'check-in emocional passo a passo, primeiro check-in emocional, como perceber o que estou sentindo, autoconhecimento no dia a dia',
  related_slugs = ARRAY['emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'],
  updated_at = now()
WHERE slug = 'faca-seu-primeiro-check-in-emocional';

UPDATE public.articles SET
  excerpt = 'Você não precisa encontrar a palavra perfeita para começar. Veja como aproximar o nome de uma emoção usando contexto, intensidade e sensações do momento.',
  summary = 'Um caminho para nomear emoções com aproximação, sem transformar a palavra escolhida em prova ou diagnóstico.',
  seo_title = 'Como Nomear uma Emoção sem Encontrar a Palavra Perfeita',
  seo_description = 'Veja como nomear uma emoção usando contexto, intensidade e aproximações, sem exigir clareza imediata sobre tudo o que você sente.',
  keyword = 'como nomear emoções',
  secondary_keywords = 'como identificar uma emoção, nomes de sentimentos, não sei nomear o que sinto, reconhecer emoções',
  related_slugs = ARRAY['faca-seu-primeiro-check-in-emocional','emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente'],
  updated_at = now()
WHERE slug = 'como-nomear-uma-emocao-sem-se-cobrar';

UPDATE public.articles SET
  excerpt = 'Nem sempre você consegue explicar o que sente. Comece pelo que está mais visível: sensações, pensamentos, vontade de se afastar, aproximações e necessidades do momento.',
  summary = 'Um roteiro para quando faltam palavras e você precisa começar pela experiência, não por um rótulo perfeito.',
  seo_title = 'Não Sei o Que Estou Sentindo: Por Onde Começar?',
  seo_description = 'Não sabe explicar o que sente? Veja por onde começar observando sensações, pensamentos e necessidades sem exigir uma resposta imediata.',
  keyword = 'não sei o que estou sentindo',
  secondary_keywords = 'não consigo explicar o que sinto, confusão emocional, como entender o que sinto, sentimentos difíceis de explicar',
  related_slugs = ARRAY['faca-seu-primeiro-check-in-emocional','emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per','como-nomear-uma-emocao-sem-se-cobrar'],
  updated_at = now()
WHERE slug = 'o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente';

UPDATE public.articles SET
  excerpt = 'Entender o que você sente pode começar por aproximações: o que aconteceu, o que mudou no corpo, quais pensamentos apareceram e o que parece importante agora.',
  summary = 'Uma visão mais ampla para perceber emoções sem transformar autoconhecimento em busca por uma resposta perfeita.',
  seo_title = 'Como Entender o Que Você Sente sem Buscar uma Resposta Perfeita',
  seo_description = 'Veja como perceber o que você sente observando contexto, corpo, pensamentos e necessidades sem exigir um rótulo emocional perfeito.',
  keyword = 'como entender o que estou sentindo',
  secondary_keywords = 'como perceber emoções, entender sentimentos, autoconhecimento emocional, não sei o que sinto',
  related_slugs = ARRAY['faca-seu-primeiro-check-in-emocional','emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente'],
  updated_at = now()
WHERE slug = 'como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per';

UPDATE public.articles SET
  related_slugs = ARRAY['faca-seu-primeiro-check-in-emocional','emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-nomear-uma-emocao-sem-se-cobrar','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per'],
  updated_at = now()
WHERE slug = 'perguntas-simples-para-entender-como-voce-esta-hoje';
