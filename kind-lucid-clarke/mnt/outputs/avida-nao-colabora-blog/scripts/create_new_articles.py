"""
Script para criar 5 novos artigos via Supabase REST API (POST).
"""
import json
import urllib.request

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
    "image_url": "https://images.unsplash.com/photo-1483354483454-4cd359948304?w=800&q=80",
    "image_alt": "Pessoa descansando no sofá com expressão cansada",
    "read_time": 8,
    "published": True,
    "summary": "Existe um cansaço que vai além do sono. É o cansaço de tentar, de esperar, de acreditar. Este artigo é para quando você está nesse lugar.",
    "content": """RESUMO RÁPIDO
---
[Se você está sem energia para ler tudo, aqui está o resumo:]
• Este artigo fala sobre o cansaço emocional profundo — quando nem tentar parece valer a pena
• Ideia principal: esse cansaço é real e tem razões. Você não está sendo fraco(a)
• Uma ação pequena para hoje: permita-se parar. Só parar. Sem culpa
• Pergunta para diário: O que eu carregueí hoje que não precisava ser meu?
---

## Quando o cansaço vai além do corpo

Tem dias em que acordar já é demais. Em que você olha para as tarefas do dia e sente um peso que não vem dos músculos. Não é falta de sono. Não é preguiça. É um tipo de exaustão que se instala bem mais fundo — dentro de você.

Esse cansaço tem um nome. Pode se chamar esgotamento emocional, burnout, fadiga da vida. Mas acima de qualquer rótulo, ele tem uma característica que o torna especialmente difícil: a sensação de que tentar não adianta mais.

Se você chegou neste artigo carregando isso, saiba que não está sozinho(a). E que isso que você está sentindo é reconhecível. Muitas pessoas passam por esse lugar.

## O que é o cansaço de tentar?

É diferente do cansaço físico. Você pode dormir oito horas e ainda acordar exausto(a). É diferente da tristeza comum — é mais opaco, mais pesado, mais silencioso.

O cansaço de tentar aparece quando:

- Você investiu muito em algo e não viu retorno
- Você se esforçou para mudar e os padrões voltaram
- Você tentou se comunicar e não foi compreendido(a)
- Você esperou que as coisas melhorassem e elas não melhoraram
- Você cuidou de tantas pessoas que esqueceu de se cuidar

Não é fraqueza. É o resultado de muito esforço sem o suporte que você precisava.

## O que acontece no seu sistema nervoso

Quando ficamos sob estresse crônico — aquele que não tem fim, que não dá descanso — nosso sistema nervoso entra em um estado de alerta constante. Com o tempo, ele começa a se "apagar". É um mecanismo de proteção.

Seu corpo não está sendo traiçoeiro. Ele está tentando sobreviver.

O problema é que esse estado de "apagamento" pode parecer indiferença, preguiça, ou falta de vontade. E quando você acredita nessa narrativa, fica ainda mais pesado carregar.

## O que NÃO ajuda quando você está assim

Às vezes as pessoas ao redor tentam ajudar dizendo coisas como:
- "Você precisa ter foco"
- "Todo mundo tem dias ruins"
- "Pensa positivo"
- "Se force um pouco mais"

Essas frases, mesmo com boa intenção, podem doer. Porque o que você está sentindo não é falta de força de vontade. É o resultado de ter usado toda a sua força de vontade por muito tempo.

PAUSA DE REFLEXÃO

Antes de continuar, respira fundo. Coloque a mão no peito se quiser. Você não precisa resolver tudo agora. Este texto não pede nada de você — só acompanha.

## O que pode ajudar (de verdade)

Não existe solução mágica. Mas existem pequenas âncoras.

**Parar de tentar tanto por um tempo**
Isso parece contraditório, mas é real. Às vezes a melhor coisa que você pode fazer é reduzir drasticamente o que está tentando fazer. Não para sempre — só por agora.

**Nomear o que está sentindo**
"Estou exausto(a)." "Estou sem esperança hoje." "Não estou conseguindo." Essas frases não são derrotas. São honestidade. E a honestidade é o primeiro passo.

**Não exigir que você esteja bem**
Você não precisa estar bem. Não precisa estar produtivo(a). Não precisa estar motivado(a). Você pode simplesmente estar — sem performance.

**Buscar um ponto de apoio**
Uma pessoa. Um profissional. Um espaço seguro. Não para resolver tudo — só para não estar sozinho(a) nesse peso.

## O que fazer com os pensamentos que dizem "para que?"

Quando o cansaço é profundo, a mente começa a questionar tudo. "Para que eu tento?" "Para que eu continuo?" "Isso vai mudar algum dia?"

Esses pensamentos são sinais de que você precisa de descanso e apoio — não provas de que as coisas nunca vão mudar.

Se esses pensamentos chegarem acompanhados de ideias de se machucar ou de desaparecer, por favor, busque ajuda agora. O CVV atende 24h pelo número 188 ou pelo chat em cvv.org.br.

## Uma coisa pequena

Se você não consegue fazer nada hoje, tudo bem. Mas se quiser fazer uma coisa só, que seja esta:

Coloca a mão no peito. Sente seu coração. Ele está aqui. Você está aqui.

Isso, por hoje, já é suficiente.

PERGUNTAS PARA O DIÁRIO
• O que eu carregueí hoje que não precisava ser meu?
• Em que momento eu parei de acreditar que as coisas poderiam mudar?
• O que eu precisaria receber — de mim ou de alguém — para me sentir um pouco menos só nesse cansaço?
• Se eu pudesse dar a mim mesmo(a) uma coisa amanhã, o que seria?
• O que me ajudaria a descansar de verdade — não só o corpo, mas a mente?

---
*Este conteúdo é para fins de apoio emocional e autoconhecimento. Não substitui acompanhamento profissional de saúde mental. Se você está em sofrimento intenso, procure um psicólogo, médico ou ligue para o CVV: 188.*"""
  },
  {
    "slug": "como-impor-limites-sem-se-sentir-uma-pessoa-ruim",
    "title": "Como impor limites sem se sentir uma pessoa ruim",
    "category": "Relações e limites",
    "image_url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&q=80",
    "image_alt": "Pessoa em posição de escuta e diálogo",
    "read_time": 8,
    "published": True,
    "summary": "Dizer não ainda parece errado para você? Este artigo explora por que limites não são egoísmo — são cuidado, com você e com os outros.",
    "content": """RESUMO RÁPIDO
---
[Se você está sem energia para ler tudo, aqui está o resumo:]
• Este artigo é sobre colocar limites sem carregar culpa ou medo de magoar
• Ideia principal: limite não é rejeição — é uma forma de se preservar para continuar presente
• Uma ação pequena para hoje: identifique uma situação onde você disse "sim" mas queria dizer "não"
• Pergunta para diário: O que eu temo que aconteça quando digo não?
---

## Você já disse sim quando queria dizer não?

Essa sensação é conhecida por muita gente. Alguém pede algo, você sente que não quer ou não pode fazer, mas uma voz interna diz: "Se eu negar, vou parecer egoísta. Vão me julgar. Vão ficar magoados."

Então você diz sim. E carrega o sim com ressentimento, cansaço e, às vezes, uma raiva silenciosa que vai crescendo.

Isso acontece porque, para muitas pessoas, dizer não foi ensinado como algo errado. Algo rude. Algo que pessoas "boas" não fazem.

Mas e se esse ensinamento estivesse equivocado?

## O que é um limite, de verdade?

Limite não é uma parede. Não é frieza. Não é indiferença.

Limite é a linha que separa o que você pode oferecer — com genuinidade e sem se esvaziar — do que vai além do que você tem a dar no momento.

Quando você age dentro dos seus limites, você está presente de verdade. Quando age fora deles, você pode estar físicamente lá, mas emocionalmente drenado(a), ressentido(a) e vazio(a).

Paradoxalmente: impor limites é uma das formas mais honestas de cuidar das suas relações.

## Por que fica tão difícil dizer não?

Existem algumas razões comuns — e nenhuma delas é fraqueza:

**Medo de abandono:** Se eu decepcionar as pessoas, elas vão embora.

**Identidade construída no cuidado:** Ser prestativo(a) virou parte de quem você é. Dizer não parece trair essa identidade.

**Experiências antigas:** Pessoas que aprenderam cedo que suas necessidades não importavam tendem a ter dificuldade em colocar limites.

**Confusão entre limite e rejeição:** Dizer "não posso agora" é interpretado internamente (e às vezes externamente) como "não me importo com você".

**Responsabilidade excessiva pelo emocional dos outros:** Você sente que é sua obrigação garantir que as pessoas ao redor estejam bem.

Nenhum desses padrões é defeito de caráter. São aprendizados que foram úteis em algum momento — e que agora podem estar te pesando.

PAUSA DE REFLEXÃO

Pensa em uma pessoa na sua vida para quem você dificilmente diz não. O que você sente quando imagina colocar um limite com ela? Anota isso mentalmente — vamos usar essa percepção mais à frente.

## O que acontece quando você não tem limites

Quando vivemos constantemente sem limites:

- A exaustão se acumula sem que os outros percebam (porque você sempre aparece disponível)
- O ressentimento cresce de forma silenciosa
- Você começa a se afastar das pessoas — não por escolha, mas por sobrevivência
- A relação se desequilibra: você dá, o outro recebe, e nenhum dos dois percebe o que está acontecendo
- Você vai ficando menor dentro das suas próprias relações

## Como colocar limites de forma acolhedora

Colocar limites não exige ser duro(a) ou frio(a). Existem formas de fazer isso com gentileza — inclusive com você mesmo(a).

**Comece pequeno:**
Não precisa começar pelo limite mais difícil. Escolha uma situação pequena — uma reunião que você pode declinar, um favor que pode dizer "agora não consigo". Pratique o como se sente.

**Separe o comportamento da pessoa:**
"Não posso fazer isso" é diferente de "não gosto de você". Você pode amar alguém e ainda assim não ter disponibilidade para atender a um pedido específico.

**Use frases que honram os dois lados:**
- "Eu gostaria muito de ajudar, mas agora não tenho como."
- "Preciso de um tempo para cuidar de mim antes de conseguir estar presente pra você."
- "Não vou conseguir hoje, mas posso pensar em como te ajudar de outra forma."

**Não explique demais:**
Você não deve justificativas longas. "Não vou conseguir" é uma frase completa. Explicações excessivas frequentemente saem de um lugar de culpa — e às vezes abrem espaço para negociação onde você não quer negociar.

## E quando a pessoa fica chateada?

Às vezes vai acontecer. Alguém vai ficar desapontado(a). Isso não significa que você errou.

Relações saudáveis têm espaço para que ambas as partes coloquem limites. Se uma relação só funciona quando você diz sim para tudo, pode ser que essa relação precise de um olhar mais cuidadoso.

Você não é responsável por administrar o emocional de todos ao seu redor.

## Uma verdade sobre limites e amor

Dizer não, quando dito com cuidado, pode ser uma das formas mais profundas de dizer sim — a você mesmo(a), à relação, à honestidade.

Porque quando você está presente com o que realmente pode oferecer, você está mais inteiro(a). Mais genuíno(a). Mais real.

E relações construídas sobre essa base tendem a ser muito mais bonitas do que aquelas onde um dos lados se apaga para que tudo funcione.

PERGUNTAS PARA O DIÁRIO
• O que eu temo que aconteça quando digo não para alguém importante para mim?
• Em que relações eu tenho mais dificuldade de colocar limites? O que essas relações têm em comum?
• Existe algum "sim" que eu dei recentemente que, na verdade, era um "não"? Como isso me afetou?
• O que mudaria nas minhas relações se eu pudesse ser mais honesto(a) sobre minha disponibilidade?
• Como eu gostaria que as pessoas reagissem quando eu colocar um limite? Essa expectativa é realista?

---
*Este conteúdo é educativo e de apoio emocional. Não substitui acompanhamento psicológico ou terapêutico.*"""
  },
  {
    "slug": "como-criar-uma-rotina-emocional-sem-pressao",
    "title": "Como criar uma rotina emocional sem pressão",
    "category": "Rotina e hábitos",
    "image_url": "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=80",
    "image_alt": "Mesa organizada com agenda e café",
    "read_time": 7,
    "published": True,
    "summary": "Rotina emocional não é uma lista de obrigações. É um conjunto de pequenas âncoras que te ajudam a se sentir mais presente no seu próprio dia.",
    "content": """RESUMO RÁPIDO
---
[Se você está sem energia para ler tudo, aqui está o resumo:]
• Este artigo é sobre criar uma rotina de autocuidado emocional que caiba na sua vida real
• Ideia principal: rotina não é rigidez — é um conjunto de pequenos pontos de apoio ao longo do dia
• Uma ação pequena para hoje: escolha UMA coisa para fazer amanhã de manhã que seja só sua
• Pergunta para diário: O que me faz sentir mais centrado(a) no meu próprio dia?
---

## Rotina emocional: o que isso significa?

Quando a maioria das pessoas ouve "rotina emocional", imagina uma lista enorme de práticas: meditação de manhã, journaling à tarde, leitura à noite, exercício todos os dias, yoga no fim de semana...

E diante dessa lista, a maioria desiste antes de começar.

Rotina emocional não é isso. É muito mais simples — e por isso, muito mais sustentável.

Uma rotina emocional é um conjunto de pequenas ações intencionais que te ajudam a se reconectar com você mesmo(a) ao longo do dia. Não precisa ser perfeita. Não precisa ser todos os dias. Não precisa parecer produtiva para os outros.

Ela precisa funcionar para você.

## Por que rotinas emocionais importam?

Sem nenhuma âncora no dia, é fácil chegar à noite completamente perdido(a) de si mesmo(a). Você passou o dia respondendo a demandas externas, cuidando de outras pessoas, resolvendo problemas — e não teve nenhum momento que fosse só seu.

Com o tempo, essa falta de aterramento emocional pode se traduzir em:
- Sensação de vazio sem saber por quê
- Irritabilidade que aparece do nada
- Dificuldade de entender o que está sentindo
- Impressão de estar vivendo no piloto automático

Uma rotina emocional cria pequenas pausas onde você pode voltar para dentro.

## O erro mais comum: tentar mudar tudo de uma vez

A maioria das pessoas que tentou criar uma rotina e desistiu fez isso: tentou mudar tudo ao mesmo tempo.

Nova rotina de manhã. Nova dieta. Novo horário de dormir. Nova prática de meditação. Tudo em uma semana.

Em duas semanas, nada sobrou.

O problema não é falta de vontade — é falta de progressividade. O cérebro humano resiste a mudanças grandes e bruscas. Ele se adapta melhor a pequenas alterações constantes.

PAUSA DE REFLEXÃO

Pensa em alguma rotina que você já manteve por tempo. Pode ser qualquer coisa — tomar café toda manhã, checar o celular antes de dormir, ouvir música no caminho. O que essas práticas têm em comum? Provavelmente são simples, rápidas e não exigem esforço consciente.

É nesse princípio que uma rotina emocional sustentável se apoia.

## Como construir a sua rotina: passo a passo

**1. Mapeie os momentos naturais do seu dia**
Você já tem momentos de pausa no seu dia — mesmo que pequenos. Acordar, tomar café, o intervalo do almoço, o trajeto de volta pra casa, antes de dormir. Esses momentos já existem. A ideia é aproveitar alguns deles para uma prática emocional pequena.

**2. Escolha uma prática por momento**
Não duas. Não três. Uma.

Exemplos:
- Ao acordar: antes de pegar o celular, pergunte a si mesmo(a) "Como estou hoje?"
- No café: um minuto sem tela, só sentindo o gosto e o calor
- No intervalo: anote uma frase sobre como você está se sentindo
- Antes de dormir: três coisas que aconteceram hoje, sem julgamento

**3. Comece com três dias, não sete**
Comprometer-se com três dias por semana é mais honesto e sustentável do que prometer todos os dias. E quando você consegue três, quatro aparecem naturalmente.

**4. Avalie sem julgamento**
Uma vez por semana, pergunte: "O que funcionou? O que não funcionou?" Sem culpa. Só ajuste.

## Exemplos de práticas simples

- Respiração: três respirações conscientes ao acordar
- Nomeação: "Hoje estou me sentindo _____"
- Registro: uma linha no diário, qualquer coisa
- Movimento: cinco minutos de alongamento sem tela
- Gratidão concreta: uma coisa específica que aconteceu hoje
- Desconexão: 10 minutos sem celular antes de dormir

Nenhuma dessas práticas é revolucionária. Mas praticadas com consistência, elas criam um fio condutor entre você e sua vida emocional.

## O que fazer quando a rotina quebra

Vai quebrar. Isso é certo.

Você vai ter uma semana difícil. Uma viagem. Uma crise. Um dia que simplesmente não cooperou. E a rotina vai escorregrar.

O passo mais importante é: voltar sem drama.

Não precisa compensar. Não precisa recomeçar "do zero" com mais rigidez. Só volta, do jeito que der, quando der.

Rotina emocional não é uma prova de disciplina. É um convite que você se faz — e pode aceitar de novo sempre que quiser.

PERGUNTAS PARA O DIÁRIO
• O que me faz sentir mais centrado(a) no meu próprio dia?
• Quais momentos do meu dia já existem naturalmente que eu poderia usar como âncoras emocionais?
• O que me impede de criar espaços para mim mesmo(a) ao longo do dia?
• Como eu me sinto quando não tenho nenhum momento só meu durante o dia?
• Que prática pequena eu poderia tentar essa semana — algo que levasse menos de 5 minutos?

---
*Este conteúdo é informativo e de apoio ao autoconhecimento. Não substitui acompanhamento profissional.*"""
  },
  {
    "slug": "o-que-fazer-quando-a-cabeca-nao-desliga",
    "title": "O que fazer quando a cabeça não desliga",
    "category": "Pensamentos difíceis",
    "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    "image_alt": "Pessoa em reflexão com luz suave",
    "read_time": 7,
    "published": True,
    "summary": "Pensamentos que não param, preocupações circulares, aquela sensação de não conseguir descansar a mente. Este artigo explora o que acontece e o que pode ajudar.",
    "content": """RESUMO RÁPIDO
---
[Se você está sem energia para ler tudo, aqui está o resumo:]
• Este artigo fala sobre a ruminação — quando os pensamentos entram em loop e não deixam você descansar
• Ideia principal: a cabeça que não desliga geralmente está tentando resolver algo que não tem solução racional
• Uma ação pequena para hoje: quando o loop começar, coloque o pensamento no papel e feche o caderno
• Pergunta para diário: Que pensamento volta repetidamente para mim essa semana?
---

## Você conhece esse estado?

É tarde da noite. Você está deitado(a), cansado(a) o suficiente para dormir — mas a cabeça não para.

Pensamentos sobre o trabalho. Sobre aquela conversa de ontem. Sobre o que você deveria ter dito. Sobre o que pode acontecer amanhã. Sobre algo que aconteceu há cinco anos e que, por algum motivo, voltou agora.

Você tenta parar. Pensa em outra coisa. A mente volta. Você tenta de novo. Ela insiste.

Essa experiência tem um nome: ruminação. E é mais comum do que parece.

## O que é ruminação?

Ruminação é o processo de pensar repetidamente sobre os mesmos problemas, situações ou preocupações — geralmente de forma circular, sem chegar a uma conclusão ou solução.

Diferente do pensamento reflexivo (que leva a insights e clareza), a ruminação gira no mesmo ponto sem avançar. Como uma roda que gira sem tração.

Ela costuma aparecer especialmente à noite — quando as distrações do dia diminuem e os pensamentos não têm mais competição.

## Por que a mente faz isso?

A mente ruminante está, na maioria das vezes, tentando resolver algo. Ela entendeu que há um problema — uma ameaça, uma incerteza, uma situação não resolvida — e quer chegar a uma conclusão.

O problema é que nem todo problema tem solução racional. Alguns problemas são emocionais. Relacionais. Existenciais. E a mente continua tentando resolver racionalmente o que precisaria de outro tipo de atenção.

Outros fatores que alimentam a ruminação:
- Ansiedade (que mantém o sistema de alerta ativado)
- Controle excessivo (tentar antecipar tudo para se sentir seguro)
- Não ter processado emocionalmente algo que aconteceu
- Cansaço (o cérebro exausto perde a capacidade de regular os pensamentos)

PAUSA DE REFLEXÃO

Você consegue identificar um pensamento que volta repetidamente para você? Não precisa ser sobre algo grande. Às vezes são preocupações pequenas que insistem. Qual é o tema desse pensamento recorrente?

## O que geralmente não ajuda

**Tentar "não pensar":** quanto mais você tenta suprimir um pensamento, mais ele se fortalece. É o famoso efeito urso branco — tente não pensar em um urso branco e veja o que acontece.

**Só distrair:** scrollar o celular às 2h da manhã não resolve a ruminação — ela volta assim que você desliga a tela.

**Buscar certeza onde não existe:** quando a ruminação é sobre incerteza, tentar encontrar respostas definitivas geralmente só prolonga o loop.

## O que pode ajudar

**Externalizar o pensamento**
Colocar no papel o que está passando pela sua cabeça tem um efeito neurológico real: a escrita ativa o córtex pré-frontal, que ajuda a regular as emoções e os pensamentos. Você não precisa escrever algo elaborado. Uma frase já ajuda.

**Nomear o estado, não apenas o conteúdo**
Em vez de ficar repassando o problema, experimente nomear o que está sentindo: "Estou ansioso(a)." "Estou com medo." "Estou incerto(a)." Nomear a emoção por baixo do pensamento pode reduzir a intensidade dele.

**Âncoras corporais**
Quando a cabeça está em loop, o corpo pode ser um ponto de retorno. Respiração consciente (4 tempos para inspirar, 4 para segurar, 6 para soltar). Pressão dos pés no chão. Temperatura de algo em suas mãos.

**Agendamento do pensamento**
Técnica da terapia cognitivo-comportamental: quando um pensamento ruminante aparecer, diga para ele "anotei você, vou pensar nisso amanhã entre 17h e 17h30". E anota. O cérebro tende a soltar quando sente que o pensamento foi "arquivado".

**Aceitar a incerteza (sem resolver)**
Às vezes o pensamento volta porque há uma pergunta sem resposta e a mente não quer aceitar isso. Frases como "eu não sei o que vai acontecer, e está tudo bem não saber agora" podem ajudar a reduzir o atrito.

## Quando a ruminação precisa de atenção profissional

Se os pensamentos circulares estão interferindo significativamente no seu sono, relacionamentos ou capacidade de funcionar no dia a dia — pode ser sinal de ansiedade generalizada ou outro quadro que se beneficia de apoio profissional.

Isso não é fraqueza. É cuidado.

PERGUNTAS PARA O DIÁRIO
• Que pensamento volta repetidamente para mim essa semana?
• Quando a minha cabeça não desliga, o que eu geralmente faço? Isso ajuda ou piora?
• O que está por baixo dos pensamentos que ficam em loop — que sentimento eles estão tentando processar?
• Se eu pudesse "arquivar" esse pensamento até amanhã, o que eu precisaria sentir para conseguir fazer isso?
• Como seria acordar amanhã com a cabeça um pouco mais leve?

---
*Este conteúdo é informativo. Não substitui atendimento psicológico ou psiquiátrico. Se você está em sofrimento intenso, procure ajuda profissional.*"""
  },
  {
    "slug": "o-que-escrever-no-diario-quando-voce-nao-sabe-por-onde-comecar",
    "title": "O que escrever no diário quando você não sabe por onde começar",
    "category": "Diário emocional",
    "image_url": "https://images.unsplash.com/photo-1516414447565-b14be0adf13e?w=800&q=80",
    "image_alt": "Caderno aberto com caneta em mesa aconchegante",
    "read_time": 7,
    "published": True,
    "summary": "A página em branco intimida. Mas o diário não precisa ser literário nem perfeito. Ele precisa ser seu. Aqui você encontra começos possíveis para quando as palavras não chegam.",
    "content": """RESUMO RÁPIDO
---
[Se você está sem energia para ler tudo, aqui está o resumo:]
• Este artigo é para quando você quer escrever no diário mas trava na página em branco
• Ideia principal: não existe jeito certo de escrever no diário — existe o que funciona para você
• Uma ação pequena para hoje: abra o diário e escreva "hoje eu estou ___" e complete
• Pergunta para diário: O que eu gostaria de ter dito hoje que não disse?
---

## A página em branco

Você pega o caderno. Ou abre o app. Está disposto(a) a escrever. Mas aí... nada.

Não sabe por onde começar. Sente que não tem nada importante para dizer. Ou tem muita coisa, mas tudo parece grande demais para caber em palavras.

E o caderno fica vazio mais um dia.

Essa experiência é muito mais comum do que parece. E não tem nada a ver com falta de vontade ou capacidade. Tem a ver com não saber o que o diário "quer" de você.

A resposta: o diário não quer nada. Ele está esperando.

## O diário não precisa ser literário

Existe um medo silencioso que muita gente carrega quando pensa em escrever: o de que o texto precisa ser bonito, elaborado, coerente.

Não precisa.

O diário é um dos poucos lugares do mundo onde você pode escrever mal e ainda assim fazer algo valioso. Frases incompletas. Pensamentos soltos. Uma palavra e um ponto final. Tudo é válido.

O propósito não é a qualidade do texto. É o que acontece em você enquanto escreve.

## Por que escrever ajuda?

Quando você coloca pensamentos em palavras, acontece algo no cérebro: você sai do modo de processamento emocional bruto (que pode ser caótico e avassalador) e começa a usar o córtex pré-frontal — a parte responsável por dar sentido, organizar e regular.

Em outras palavras: escrever ajuda a organizar o que está confuso. A ver o que estava invisível. A entender o que estava só sendo sentido.

PAUSA DE REFLEXÃO

Pensa na última vez que você estava com algo pesando na cabeça e conseguiu falar sobre isso com alguém. Como você se sentiu depois? A escrita no diário pode ter um efeito parecido — mesmo sem ninguém do outro lado.

## Começos possíveis quando as palavras não chegam

Às vezes o que falta é uma porta de entrada. Aqui estão alguns começos que podem ajudar:

**Completar frases:**
- "Hoje eu estou..."
- "O que está pesando agora é..."
- "Uma coisa que não parei para pensar essa semana é..."
- "Eu gostaria que..."
- "Estou com medo de..."
- "Uma coisa que me surpreendeu hoje foi..."
- "O que eu mais precisaria ouvir agora é..."

**Perguntas simples:**
- Como foi hoje, honestamente?
- O que eu não disse para ninguém hoje?
- O que eu evitei pensar essa semana?
- O que eu estou carregando que não precisaria ser meu?

**Listagem livre:**
Escreva uma lista de tudo que está passando pela sua cabeça — sem ordenar, sem explicar. Só despeja. Pode ser uma lista de cinco coisas ou de vinte. O objetivo é esvaziar, não organizar.

**Carta para si mesmo(a):**
Escreva uma carta curta para você. Começa com "Olá" e vai escrevendo o que viria a seguir se estivesse falando com um(a) amigo(a) que está passando pelo que você está passando.

## Diferentes estilos de diário

Não existe um único formato certo:

**Diário livre:** escreve o que vier, sem estrutura
**Diário de perguntas:** responde uma pergunta por dia
**Diário de marcadores:** só registra humor, energia e uma palavra que define o dia
**Diário de gratidão:** três coisas que aconteceram hoje, mesmo as pequenas
**Diário de observação:** descreve o dia como se estivesse relatando — sem julgamento

Experimente um por uma semana. Veja o que se sente mais natural.

## E se o que sair for feio, triste ou pesado?

Escreva mesmo assim.

O diário não precisa ser positivo. Não precisa ter lições. Pode ser um lugar onde você coloca o que está difícil — e isso por si só já tem valor.

Deixar que as palavras difíceis existam no papel é uma forma de validar o que você está sentindo. E, às vezes, só isso já faz diferença.

## Uma última coisa

Você não precisa escrever muito. Uma frase por dia, alguns dias por semana, já cria uma prática.

E um dia você vai ler o que escreveu há alguns meses e vai entender algo sobre si mesmo(a) que não teria entendido de outra forma.

Esse é o presente do diário. Não é imediato. Mas é real.

PERGUNTAS PARA O DIÁRIO
• O que eu gostaria de ter dito hoje que não disse?
• Quando eu imagino escrever no diário, o que me trava? É vergonha? Medo? Falta de tempo? Não saber o que escrever?
• Se eu pudesse escrever uma coisa para o meu eu de daqui a um ano, o que seria?
• O que eu carrego que ainda não coloquei em palavras para ninguém?
• Como eu me sentiria se pudesse esvaziar a cabeça no papel antes de dormir?

---
*Este conteúdo é de apoio ao autoconhecimento. Não substitui acompanhamento psicológico.*"""
  },
]


def create_article(article: dict):
    url = f"{SUPABASE_URL}/rest/v1/articles"
    data = json.dumps(article).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            status = resp.status
            print(f"  [{status}] Criado: {article['slug']}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "duplicate" in body.lower() or "unique" in body.lower():
            print(f"  [JÁ EXISTE] {article['slug']} — pulando")
        else:
            print(f"  [ERRO {e.code}] {article['slug']}: {body[:200]}")
    except Exception as e:
        print(f"  [ERRO] {article['slug']}: {e}")


def main():
    print(f"Criando {len(ARTICLES)} novos artigos...\n")
    for article in ARTICLES:
        create_article(article)
    print("\nConcluído!")


if __name__ == "__main__":
    main()
