#!/usr/bin/env python3
"""
insert_new_articles.py
======================
Insere 5 novos artigos no Supabase via API REST.
Execute no seu Mac: python3 supabase/insert_new_articles.py
"""

import json
import urllib.request
import urllib.error
from datetime import datetime

SUPABASE_URL = "https://lejvvhzluggyxlfwfoxl.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlanZ2aHpsdWdneXhsZndmb3hsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM4NjgyMiwiZXhwIjoyMDk2OTYyODIyfQ.yfQaMFSumWQfTDDPpH6UJJdvGKVifSQz8EuhQWo-NZg"

ARTICLES = [
    # ------------------------------------------------------------------ 1
    {
        "slug": "quando-voce-esta-cansado-ate-de-tentar",
        "title": "Quando você está cansado até de tentar",
        "category": "Cansaço emocional",
        "summary": "Existe um tipo de cansaço que não passa depois de dormir. Este artigo fala sobre a exaustão emocional — o que ela é, como se diferencia da preguiça, e pequenas formas de encontrar descanso possível.",
        "read_time": 8,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800&q=80",
        "content": """Existe um tipo de cansaço que não passa depois de uma boa noite de sono. Você acorda e já está pesado. O corpo levantou, mas alguma parte de você ainda está deitada, sem vontade de mais nada. Isso não é fraqueza. Isso é exaustão emocional.

## O que é exaustão emocional?

A exaustão emocional é o resultado de viver por muito tempo carregando mais do que você consegue. Pode ser o acúmulo de situações difíceis, de expectativas que não se cumprem, de relações que drenam, de responsabilidades que não têm fim. É como se o seu sistema interno tivesse entrado em modo de economia de energia — e qualquer coisa além do básico parecesse impossível.

Ela não é preguiça. Preguiça é uma escolha. Exaustão emocional é uma resposta.

## Como reconhecer que é cansaço emocional

Algumas pistas:
- Você faz as coisas, mas sem sentir nada. É como estar no piloto automático.
- As coisas que antes te davam prazer agora parecem sem graça.
- Você sente irritabilidade fácil — qualquer coisa parece demais.
- Você tem dificuldade de tomar decisões simples.
- Você fica bem quando está "desligado(a)", mas mal quando precisa se engajar.

Não precisa ter todos esses sinais. Um já é suficiente para levar a sério.

## A diferença entre preguiça e exaustão

Quem está com preguiça geralmente está descansado e optando por não fazer algo. Quem está com exaustão emocional geralmente já tentou. Já se esforçou. Já empurrou. E chegou num ponto em que o sistema simplesmente não responde mais da mesma forma.

A culpa que vem junto com a exaustão piora tudo. Porque além de estar exausto, você ainda se cobra por estar exausto.

## O que ajuda — e o que não ajuda

O que não ajuda: forçar mais, fingir que está bem, comparar seu ritmo com o de outras pessoas, usar a culpa como combustível.

O que pode ajudar:
- Reduzir o que for possível reduzir — sem julgamento.
- Identificar o que está drenando mais energia e, se possível, criar uma pausa.
- Descanso que não seja produtivo. Descanso de verdade.
- Contar para alguém de confiança como você está se sentindo.
- Não exigir de si mesmo que melhore rápido.

## Descanso possível

Descanso não precisa ser uma semana de férias ou um retiro espiritual. Às vezes descanso é sentar no sofá sem se cobrar por estar sentado. É deitar sem abrir o celular. É dizer não para um compromisso que não era necessário.

O descanso possível é o que você consegue fazer agora, com o que você tem.

## Uma coisa pequena para hoje

Escolha uma coisa que você vai não fazer hoje. Algo que estava na sua lista mental e que pode esperar. Riscar da lista sem culpa é um gesto de cuidado consigo mesmo.

## Quando procurar ajuda

Se o cansaço está durando semanas, se está afetando sua vida de formas significativas, se você sente que não há saída — vale procurar um profissional de saúde mental. Exaustão crônica pode ser um sinal de que o corpo e a mente precisam de apoio que vai além do autocuidado.

Você não precisa resolver isso sozinho.

## Perguntas para o diário

- O que tem me cansado mais ultimamente — é algo específico ou uma acumulação de coisas?
- Quando foi a última vez que eu descanseguei de verdade? Como foi?
- O que eu precisaria liberar (tarefa, expectativa, relação) para me sentir um pouco mais leve?
- Tem algo que eu continuo fazendo por obrigação mesmo sabendo que está me esgotando?
- O que eu gostaria de dizer para mim mesmo(a) neste momento de cansaço?
""",
    },

    # ------------------------------------------------------------------ 2
    {
        "slug": "como-impor-limites-sem-se-sentir-uma-pessoa-ruim",
        "title": "Como impor limites sem se sentir uma pessoa ruim",
        "category": "Relações e limites",
        "summary": "Dizer não é uma das coisas mais difíceis para muita gente — e a culpa que vem depois pode ser paralisante. Este artigo fala sobre por que colocar limites é um ato de cuidado, e como fazer isso com gentileza.",
        "read_time": 9,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&q=80",
        "content": """Dizer não é simples na teoria. Na prática, para muita gente, é uma das coisas mais difíceis que existem. Vem a culpa, vem o medo de machucar, vem a sensação de que você está sendo egoísta ou difícil. E muitas vezes, você acaba dizendo sim para uma coisa que não queria — e carrega o peso disso depois.

Este artigo é sobre isso: como colocar limites sem precisar se sentir uma pessoa ruim.

## Por que é tão difícil dizer não?

Muita gente foi criada com a ideia de que ser bom é ser disponível. Que cuidar dos outros significa colocar as necessidades deles antes das suas. Que dizer não é ser egoísta, ingrato ou difícil.

Isso cria um padrão: você diz sim quando quer dizer não. Você fica além da conta. Você ajuda mesmo quando não tem energia para se ajudar. E depois se sente vazio, ressentido ou sobrecarregado — sem saber direito por quê.

## O que é um limite, de verdade?

Um limite não é um muro. Não é uma forma de rejeitar alguém ou de se isolar. É uma forma de dizer: aqui está o que eu consigo, o que eu preciso, e o que não funciona para mim.

Limites protegem a relação tanto quanto protegem você. Porque relações onde uma pessoa dá mais do que pode sustentam geram ressentimento. E ressentimento afasta muito mais do que um não dito com cuidado.

## A culpa que vem depois do não

Dizer não muitas vezes vem seguido de um desconforto. Você fica se perguntando: "Eu fiz certo? Vou machucar a pessoa? Ela vai ficar mal comigo?"

Esse desconforto não significa que você errou. Significa que você fez algo diferente do que está acostumado. A culpa, nesses casos, não é um sinal moral — é um sinal de que você saiu da zona de conforto de sempre ceder.

## Exemplos de frases para colocar limites com gentileza

Você não precisa justificar excessivamente. Mas pode ser gentil:

- "Neste momento não consigo, mas posso te ajudar de outra forma."
- "Preciso de um tempo antes de responder isso."
- "Não estou bem para essa conversa agora. Posso falar amanhã?"
- "Isso não vai funcionar para mim."
- "Eu gostaria de ajudar, mas hoje não tenho como."

Simples. Honesto. Sem precisar de uma dissertação de justificativa.

## Limites graduais

Não é preciso começar com o limite mais difícil. Você pode começar pequeno:

- Dizer não para um pedido pequeno que você normalmente aceita sem querer.
- Saindo de uma conversa que te esgota um pouco mais cedo.
- Não respondendo uma mensagem imediatamente quando você não tem energia.

Cada pequeno não é uma prática. E com o tempo, fica mais natural.

## Sobre quem reage mal ao seu limite

Quando você começa a colocar limites, algumas pessoas reagem mal. Isso pode ser doloroso — especialmente quando são pessoas próximas.

Mas também revela algo importante: a relação estava funcionando porque você cedia. Quando você para de ceder, a dinâmica muda. E nem sempre a outra pessoa está pronta para essa mudança.

Isso não é culpa sua. E não significa que você deve voltar a ceder para preservar a relação.

## Uma coisa para hoje

Pense em uma situação em que você disse sim quando queria dizer não. O que você gostaria de ter dito? Escreva. Não precisa enviar para ninguém. Só praticar como seria.

## Perguntas para o diário

- Em quais situações eu costumo dizer sim quando quero dizer não?
- O que eu temo que aconteça quando coloco um limite?
- Quais são as relações onde me sinto mais à vontade para dizer não?
- O que "ser uma pessoa boa" significa para mim — e essa definição me faz bem?
- Que limite eu gostaria de colocar mas ainda não coloquei?
""",
    },

    # ------------------------------------------------------------------ 3
    {
        "slug": "o-que-fazer-quando-a-cabeca-nao-desliga",
        "title": "O que fazer quando a cabeça não desliga",
        "category": "Pensamentos difíceis",
        "summary": "Pensamentos acelerados, ruminação, uma mente que não para — isso afeta o sono, a concentração e o bem-estar. Este artigo traz formas práticas de desacelerar sem precisar silenciar tudo.",
        "read_time": 8,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1476611338391-6f395a0dd82e?w=800&q=80",
        "content": """Você deita para dormir e a mente começa. Uma conversa que aconteceu há três dias. Uma tarefa que você esqueceu. Uma preocupação que você não consegue resolver agora. Uma crítica que alguém fez e que ficou ecoando. Um cenário que você fica repassando sem parar.

Isso tem um nome: ruminação. E é muito mais comum do que parece.

## O que é ruminação?

Ruminação é quando a mente fica presa em um loop de pensamentos — geralmente sobre algo que preocupa, machuca ou que você não consegue resolver. Ao contrário de reflexão (que leva a algum lugar), ruminação gira em círculos. Você pensa, pensa, pensa — e fica no mesmo lugar.

É exaustivo. E muitas vezes acontece nos momentos em que você mais precisaria descansar.

## Por que a cabeça acelera

A mente humana tem uma tendência natural de procurar problemas — é uma função de sobrevivência. O problema é que ela não distingue bem entre uma ameaça real e uma preocupação abstrata. Então trata as duas com a mesma urgência.

Além disso, quando você está cansado, ansioso ou sob pressão, o sistema de alerta do seu cérebro fica mais sensível. Pequenas coisas parecem grandes. Pensamentos aparecem com mais intensidade.

## O que ajuda — sem precisar silenciar tudo

A ideia de "esvaziar a mente" pode ser frustrante porque não é exatamente assim que funciona. O objetivo não é silenciar os pensamentos — é não ficar preso neles.

### 1. Escrever como âncora

Colocar os pensamentos no papel cria uma distância entre você e eles. Em vez de girarem dentro da sua cabeça, eles ficam do lado de fora. Você consegue ver o que está pensando, em vez de só sentir.

Não precisa ser organizado. Pode ser um fluxo de consciência — só escrever o que está na mente até não ter mais o que escrever.

### 2. Nomear o pensamento

Quando você percebe um pensamento ruminativo, dê um nome para ele:
- "Estou tendo o pensamento de que falhei."
- "Estou me preocupando com o que vai acontecer amanhã."

Isso cria uma leve separação entre você e o pensamento. Você é quem observa — não o pensamento em si.

### 3. Trazer o foco para o corpo

Quando a mente acelera, o corpo pode ser uma âncora. Algumas formas:
- Respiração lenta: inspire por 4 segundos, segure por 4, expire por 6.
- Notar 5 coisas que você pode ver, 4 que pode tocar, 3 que pode ouvir.
- Colocar os pés descalços no chão e prestar atenção nessa sensação.

### 4. Dar um horário para a preocupação

Soa estranho, mas funciona: reserve 15 minutos no dia para se preocupar conscientemente. Anote suas preocupações nesse horário. Quando um pensamento intrusivo aparecer em outro momento, diga para si mesmo: "Vou pensar nisso no meu horário de preocupação."

### 5. Aceitar que nem tudo precisa de solução agora

Muitos pensamentos ruminativos são sobre coisas que não têm solução no momento. Parte do trabalho é reconhecer: "Eu não posso resolver isso agora. E tudo bem."

## Quando buscar ajuda

Se os pensamentos acelerados estão interferindo no seu sono, na sua concentração ou na sua qualidade de vida de forma consistente, vale conversar com um profissional. Ansiedade crônica e pensamentos intrusivos têm tratamentos efetivos.

## Perguntas para o diário

- Quais pensamentos costumam aparecer quando minha cabeça não para?
- Em que momento do dia minha mente fica mais agitada?
- Existe alguma preocupação recorrente que eu ainda não resolvi — e o que me impede de agir sobre ela?
- Quando me sinto mais tranquilo(a)? O que é diferente nesses momentos?
- Que frase eu gostaria de poder dizer para mim mesmo(a) quando a mente acelera?
""",
    },

    # ------------------------------------------------------------------ 4
    {
        "slug": "como-dormir-melhor-quando-a-mente-nao-para",
        "title": "Como dormir melhor quando a mente não para",
        "category": "Sono e descanso",
        "summary": "A mente acelerada à noite é um dos principais inimigos do sono. Este artigo fala sobre higiene do sono, ansiedade noturna e rituais simples de descanso que podem fazer diferença.",
        "read_time": 9,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1531353826977-0941b4779a1c?w=800&q=80",
        "content": """O quarto está escuro. O barulho diminuiu. Você finalmente deitou. E então — a mente acende. Pensamentos sobre o dia que passou, sobre o dia que vai chegar, sobre conversas inacabadas, sobre coisas que você esqueceu de fazer.

Dormir deveria ser natural. Para muita gente, virou um desafio.

## Por que a mente acelera à noite?

Durante o dia, estímulos externos — trabalho, pessoas, telas, tarefas — ocupam a mente. À noite, quando os estímulos diminuem, os pensamentos que ficaram reprimidos durante o dia aparecem com mais intensidade.

Além disso, o estado de alerta que acompanha a ansiedade dificulta o relaxamento. O sistema nervoso fica em modo de "atenção" — exatamente o oposto do que o sono precisa.

## O que é higiene do sono

Higiene do sono é o conjunto de hábitos que preparam o corpo e a mente para descansar. Não é sobre ser rígido — é sobre criar condições favoráveis.

### Consistência de horário

Acordar e dormir no mesmo horário todos os dias (inclusive fins de semana) ajuda a regular o relógio biológico. Parece simples — e é uma das coisas com mais evidência científica sobre qualidade de sono.

### Luz e telas

A luz azul das telas (celular, computador, TV) sinaliza para o cérebro que ainda é dia. Reduzir telas pelo menos 30-60 minutos antes de dormir ajuda a preparar o sono. Se não for possível, existem filtros de luz azul e óculos específicos para isso.

### Ambiente de sono

Quarto escuro, silencioso e levemente fresco favorece o sono. O corpo baixa a temperatura durante o sono — um ambiente muito quente atrapalha esse processo.

### Cafeína e álcool

Cafeína pode persistir no organismo por 6 a 8 horas. Consumida tarde da tarde, interfere no sono mesmo que você não perceba. O álcool, embora induza sonolência, fragmenta o sono nas horas seguintes.

## Ansiedade noturna

A ansiedade à noite tem características próprias: os pensamentos parecem maiores, os problemas parecem sem saída, e tudo parece mais urgente do que de dia.

Uma coisa que ajuda: escrever as preocupações antes de deitar. Não para resolver — apenas para tirar da cabeça. Quando você coloca no papel, o cérebro não precisa mais ficar "segurando" o pensamento.

Outra técnica: antes de dormir, escrever três coisas boas que aconteceram no dia. Pequenas. Não precisam ser grandes conquistas. Esse exercício ajuda a redirecionar a atenção para algo diferente do ciclo de preocupação.

## Rituais de descanso

Um ritual noturno não precisa ser complexo. Pode ser simples:

- Chá sem cafeína.
- Um banho morno.
- Ler um livro físico (não no celular).
- Ouvir música tranquila ou sons da natureza.
- Uma respiração lenta por alguns minutos.

O que importa é a consistência. Com o tempo, o ritual se torna um sinal para o cérebro: é hora de desacelerar.

## Se você acordar no meio da noite

Acordar no meio da noite é normal. O problema é o que acontece depois. Se ficar na cama tentando forçar o sono por mais de 20-30 minutos, pode ser mais útil sair da cama, fazer algo tranquilo (ler, escrever, ouvir algo calmo) e voltar quando sentir sono de novo.

Ficar na cama frustrado cria uma associação entre cama e ansiedade — o oposto do que você quer.

## Quando procurar ajuda

Insônia crônica (dificuldade para dormir por mais de três noites por semana durante mais de um mês) merece atenção. A terapia cognitivo-comportamental para insônia (TCC-I) tem boa evidência científica — e em alguns casos pode ser mais efetiva do que medicação a longo prazo.

## Perguntas para o diário

- O que costuma passar pela minha cabeça quando não consigo dormir?
- Que hábitos da minha noite podem estar atrapalhando o sono?
- Qual ritual noturno eu gostaria de experimentar esta semana?
- Como meu sono afeta como eu me sinto de dia?
- O que eu precisaria mudar no meu ambiente para ter noites mais tranquilas?
""",
    },

    # ------------------------------------------------------------------ 5
    {
        "slug": "quando-a-vida-nao-colabora-e-voce-tambem-nao-consegue",
        "title": "Quando a vida não colabora e você também não consegue",
        "category": "Vida real",
        "summary": "Existem dias em que tudo parece errar ao mesmo tempo — e você ainda não consegue fazer o que deveria. Este artigo é para esses dias: sobre expectativa x realidade, autocompaixão e o que significa estar bem de verdade.",
        "read_time": 10,
        "published": True,
        "image_url": "https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80",
        "content": """Existem dias em que tudo parece ir em direção errada ao mesmo tempo. O trabalho não deu certo. A relação pesou. A cabeça não colaborou. O plano não se cumpriu. E além de tudo isso, você ainda sente que deveria estar conseguindo — e não está.

Este artigo é para esses dias.

## Quando a vida não colabora

Às vezes as coisas simplesmente não saem como você queria. Não por falta de esforço, não por incompetência, não por que você fez algo errado. Às vezes é só isso: a vida não colabora.

Perder um emprego que era importante. Uma relação que foi embora. Um plano que desmoronou. Uma fase que não termina. Coisas que doem independentemente de quão "forte" você seja ou de quanta terapia você já fez.

Reconhecer isso — sem tentar consertar ou ressignificar imediatamente — já é uma forma de honestidade consigo mesmo.

## A distância entre expectativa e realidade

Grande parte do sofrimento em dias difíceis vem da distância entre onde você esperava estar e onde você está. Você esperava estar bem. Está mal. Você esperava conseguir. Não conseguiu. Você esperava que essa fase tivesse passado. Ainda não passou.

Essa distância dói. E a tendência é culpar a si mesmo por estar nela.

Mas expectativas são apenas hipóteses sobre o futuro. A realidade é o que está aqui. E às vezes elas não coincidem — sem que isso seja culpa sua.

## O que é autocompaixão — e o que não é

Autocompaixão não é se pegar no colo e nunca se responsabilizar por nada. É tratar a si mesmo com o mesmo cuidado que você trataria um amigo que está passando pelo que você está passando.

Se um amigo viesse até você e dissesse: "Eu não consegui fazer nada hoje. Estou me sentindo um fracasso" — o que você responderia? Provavelmente não diria: "Você mesmo tem culpa disso. Se esforça mais."

Mas é exatamente isso que muita gente diz para si mesma.

Autocompaixão é perceber que você está sofrendo, reconhecer que sofrimento faz parte da experiência humana, e responder com gentileza — em vez de crítica.

## O que significa estar bem de verdade

"Estar bem" não é estar feliz o tempo todo. Não é ter tudo resolvido. Não é ser produtivo mesmo nos dias ruins.

Às vezes estar bem é conseguir sair da cama. Às vezes é dar uma volta curta. Às vezes é apenas atravessar o dia sem se destruir emocionalmente no processo.

O padrão que a cultura coloca sobre "estar bem" — positivo, produtivo, agradecido, resiliente — pode ser opressor nos momentos em que você simplesmente não está assim. E fingir que está não ajuda.

## O que você pode fazer num dia em que nada funciona

Não é uma lista de produtividade. É uma lista de mínimos possíveis:

- Comer algo — mesmo que não tenha fome.
- Beber água.
- Falar com alguém — mesmo que seja só uma mensagem curta.
- Sair de dentro de casa por alguns minutos, se for possível.
- Colocar no papel o que você está sentindo, sem tentar resolver.

Esses não são passos para "vencer o dia". São formas de atravessá-lo.

## Dias ruins passam

Isso não é um consolo vazio. É uma observação sobre como o tempo funciona. Dias ruins passam. Fases difíceis mudam. Não necessariamente para algo fácil — mas para algo diferente.

E você já atravessou coisas difíceis antes. Talvez não lembre direito, mas atravessou.

## Quando pedir ajuda

Se dias ruins estão virando semanas, se você sente que não consegue funcionar, se os pensamentos ficam muito pesados — vale buscar apoio. Terapeuta, médico, alguém de confiança. Não para "não ser fraco(a)". Para cuidar de você.

Pedir ajuda não é desistir. É uma das formas mais corajosas de cuidar de si mesmo.

## Perguntas para o diário

- Como eu estou me sentindo hoje, sem tentar explicar ou justificar?
- O que está pesando mais para mim agora?
- Que expectativa eu tenho sobre mim mesmo(a) que pode não estar sendo justa?
- O que eu precisaria ouvir agora de alguém que se importa comigo?
- Qual foi o mínimo que consegui fazer hoje — e como posso reconhecer isso como válido?
""",
    },
]


def insert_article(article: dict) -> dict:
    """Envia um artigo para o Supabase via REST API."""
    url = f"{SUPABASE_URL}/rest/v1/articles"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(article).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            return {"ok": True, "status": resp.status, "body": json.loads(body)}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        return {"ok": False, "status": e.code, "body": body}


def check_existing(slug: str) -> bool:
    """Verifica se um artigo com esse slug já existe."""
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}&select=id"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        return len(data) > 0


def main():
    print("=" * 60)
    print("Inserindo novos artigos no Supabase")
    print(f"Projeto: {SUPABASE_URL}")
    print(f"Total de artigos: {len(ARTICLES)}")
    print("=" * 60)

    for i, article in enumerate(ARTICLES, 1):
        slug = article["slug"]
        title = article["title"]
        print(f"\n[{i}/{len(ARTICLES)}] {title}")
        print(f"  Slug: {slug}")

        # Verificar se já existe
        try:
            exists = check_existing(slug)
            if exists:
                print(f"  PULADO — artigo com este slug já existe.")
                continue
        except Exception as e:
            print(f"  Erro ao verificar existência: {e}")
            continue

        # Inserir
        result = insert_article(article)
        if result["ok"]:
            print(f"  OK — inserido com sucesso (status {result['status']})")
        else:
            print(f"  ERRO (status {result['status']})")
            print(f"  Resposta: {result['body'][:200]}")

    print("\n" + "=" * 60)
    print("Concluído!")
    print("=" * 60)


if __name__ == "__main__":
    main()
