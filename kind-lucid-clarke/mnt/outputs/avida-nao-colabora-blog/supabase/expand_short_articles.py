#!/usr/bin/env python3
"""
expand_short_articles.py

Faz PATCH nos 7 artigos curtos para expandir o conteúdo.
Primeiro faz GET para obter o conteúdo existente, depois
adiciona seções faltantes e faz PATCH com o conteúdo expandido.
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
}

# Seções de expansão por slug
EXPANSIONS = {
    "vivendo-no-automatico": {
        "append": """
## Reconhecendo o automático em você

O piloto automático não é sempre ruim. Ele existe para nos poupar energia — deixamos de pensar em como amarrar os sapatos porque já internalizamos. O problema é quando o automático assume áreas da vida que precisariam de presença real: nossas emoções, nossos relacionamentos, nossos valores.

Quando você está no automático emocional, pode acordar um dia e perceber que não sabe mais o que gosta, o que quer, o que sente. As decisões foram tomadas por inércia, não por escolha.

Alguns sinais práticos de que você pode estar no automático:
- Responde "tudo bem" sem nem pensar quando perguntam como você está
- Chega ao final do dia sem lembrar de como ele passou
- Reage às situações de forma sempre igual — raiva, isolamento, ironia — sem perceber que é um padrão
- Sente que está cumprindo um roteiro que não escreveu

## Pequenas práticas de presença

Sair do automático não exige grandes mudanças. Exige pequenas pausas de consciência ao longo do dia.

**Pausa de 3 respirações:** antes de abrir o e-mail, pegar o celular ou responder uma mensagem, respire 3 vezes. Isso cria um micro-momento de presença entre o estímulo e a resposta.

**Check-in emocional rápido:** uma vez ao dia, pergunte a si mesmo(a): "como eu estou agora?" Não o que você deveria estar sentindo — o que você está.

**Uma refeição sem tela por dia:** comer em automático é um dos rituais mais comuns. Fazer uma refeição com atenção plena — prestando atenção no sabor, na textura, na temperatura — treina a presença de formas que se expandem para outras áreas.

**Notar o momento de transição:** entre uma tarefa e outra, entre uma reunião e outra, entre o trabalho e a casa — esses momentos de transição costumam ser engolidos pelo automático. Perceber que você está mudando de contexto é uma forma simples de saí-lo.

## Perguntas para o diário

- Em que área da minha vida sinto que estou mais no automático?
- Quando foi a última vez que fiz algo com presença plena — sem pensar em outra coisa?
- Que decisão recente foi tomada por inércia, não por escolha consciente?
- O que eu sentiria se desligasse o piloto automático só por um dia?
- Qual pequena pausa de presença eu poderia criar para amanhã?

## Aviso importante

Este conteúdo é de apoio ao autoconhecimento e bem-estar emocional. Não substitui acompanhamento psicológico ou psiquiátrico. Se você sente que o distanciamento emocional é intenso e persistente, considere buscar apoio profissional.""",
    },
    "plano-simples-de-autocuidado": {
        "append": """
## Modelo de plano semanal de autocuidado

Um plano de autocuidado funciona melhor quando é simples, flexível e construído a partir da sua realidade — não de um ideal inatingível. Abaixo, um modelo para você adaptar:

**Segunda-feira**
- Manhã: verificar como estou antes de pegar o celular (1 min)
- Noite: escrever uma frase sobre como foi o dia

**Terça-feira**
- Tarde: pausa de 10 minutos sem tela
- Noite: comer algo com atenção, sem distrações

**Quarta-feira**
- Manhã: 5 minutos de alongamento ou movimento leve
- Noite: listar uma coisa pequena que consegui hoje

**Quinta-feira**
- Livre — observar o que surge sem exigência

**Sexta-feira**
- Tarde: mensagem para alguém de quem gosto
- Noite: registrar no diário o que a semana trouxe

**Sábado**
- Uma atividade que dá prazer — sem justificativa de produtividade

**Domingo**
- Planejar a semana com intenção, não com pressão

Este modelo não é uma obrigação. É uma sugestão. Adapte cada item para o que for possível para você nesta semana específica.

## O que fazer quando o plano falha

Quando você não consegue cumprir o plano (e vai ter dias assim), a pergunta não é "por que não consegui?". É: "o que me impediu, e como posso tornar isso mais fácil da próxima vez?"

O autocuidado que funciona é o que resiste aos dias ruins. Se só funciona quando você está bem, é um luxo — não um suporte.

## Perguntas para o diário

- Que tipo de autocuidado sinto mais falta quando não faço?
- O que me impede de me cuidar nos dias difíceis?
- Se meu plano precisasse ter só uma coisa por dia, qual seria?
- Como eu quero me sentir ao final desta semana?
- O que posso fazer amanhã que seria uma forma de cuidado — por menor que seja?

## Aviso importante

Autocuidado é uma prática individual de bem-estar, não tratamento de saúde mental. Se você está passando por dificuldades emocionais significativas, procure um psicólogo ou profissional de saúde.""",
    },
    "rotina-emocional-sem-pressao": {
        "append": """
## Quando a rotina não está funcionando

Às vezes você tenta criar uma rotina, segue por alguns dias, e então ela desmorona. Isso não é sinal de fracasso — é informação.

Pergunte-se: a rotina era muito exigente para a minha energia atual? Os horários eram incompatíveis com minha realidade? Estava tentando mudar muita coisa de uma vez?

A resposta geralmente é: o plano era bom, mas não era possível para mim agora. E a solução não é mais disciplina — é mais honestidade sobre o que é viável.

## Rotina emocional para dias de baixa energia

Nos dias em que você não tem quase nada, uma rotina mínima pode ser uma âncora:

- Acordar e beber água
- Fazer uma coisa de cada vez (não multitarefa)
- Reconhecer como está sem se cobrar por estar assim
- Dormir no horário possível

Isso não é a rotina ideal. É a rotina de sobrevivência — e ela tem valor.

## A pergunta que guia a rotina certa

Em vez de perguntar "o que eu deveria fazer?", experimente perguntar: "o que eu consigo fazer hoje com a energia que tenho?"

Essa mudança de pergunta muda a relação com a rotina de cobrador para aliado.

## Perguntas para o diário

- Quando me sinto mais conectado(a) comigo mesmo(a) durante o dia?
- Que momento da minha rotina atual me dá mais sustento — e qual me drena?
- Se eu pudesse mudar uma coisa na minha rotina hoje, o que seria?
- Qual é a menor prática de autocuidado que eu consigo manter mesmo nos dias mais difíceis?
- O que minha rotina atual diz sobre o que estou priorizando?

## Aviso importante

Este conteúdo é de apoio ao autoconhecimento emocional. Não substitui acompanhamento psicológico ou psiquiátrico. Se você está passando por dificuldades persistentes, considere buscar ajuda profissional.""",
    },
    "autoestima-em-dias-dificeis": {
        "append": """
## Exemplos práticos de autocompaixão nos dias difíceis

Autoestima não é se achar incrível todos os dias. É conseguir tratar a si mesmo(a) com a mesma gentileza que você trataria um amigo querido que está passando pelo mesmo que você.

**Quando você cometeu um erro:**
Em vez de: "Que idiota. Como pude fazer isso?"
Tente: "Errei. Isso é humano. O que posso aprender aqui?"

**Quando você está sobrecarregado(a):**
Em vez de: "Preciso dar conta de tudo. Não posso reclamar."
Tente: "Estou com mais do que consigo carregar agora. O que posso tirar?"

**Quando você se comparou e saiu perdendo:**
Em vez de: "Eu nunca vou chegar lá. Sou sempre o(a) pior."
Tente: "Estou comparando meu por dentro com o por fora dos outros. Isso não é justo comigo."

**Quando você não conseguiu cumprir uma meta:**
Em vez de: "Não tenho disciplina. Não presto."
Tente: "A meta talvez fosse grande demais para o que eu tinha de energia. O que é possível agora?"

## A autoestima não precisa ser alta todos os dias

Nos dias difíceis, o objetivo não é se sentir confiante e poderoso(a). É se sentir suficientemente ok para continuar.

Algumas perguntas que ajudam a encontrar esse chão:
- O que eu fiz hoje — por menor que seja — que teve valor?
- Quem eu ajudei, mesmo sem perceber?
- O que eu superei hoje que não era simples?

## Perguntas para o diário

- Como eu me trato quando erro — e como eu trataria um amigo na mesma situação?
- Qual é a coisa que mais me faz duvidar do meu valor nos dias difíceis?
- Que voz interior aparece nos meus piores momentos? O que ela diz?
- O que eu precisaria ouvir de mim mesmo(a) agora?
- Qual é uma coisa que eu faço bem — que às vezes esqueço de reconhecer?

## Aviso importante

Autoestima baixa persistente pode ser sintoma de condições que se beneficiam de acompanhamento profissional. Este conteúdo é informativo. Procure apoio psicológico se o sofrimento for intenso ou duradouro.""",
    },
    "padroes-emocionais-repetidos": {
        "append": """
## Exemplos concretos de padrões emocionais

Padrões emocionais são difíceis de ver porque estamos dentro deles. Aqui estão alguns exemplos que podem ajudar a identificar os seus:

**Padrão de retirada:** toda vez que você se sente em conflito com alguém, desaparece. Para de responder mensagens, evita o tema, some. O conflito "some" — mas o problema não é resolvido.

**Padrão de superação:** você resolve os problemas de todo mundo antes de cuidar dos seus. Tem facilidade em identificar o que o outro precisa, mas dificuldade em identificar o que você mesmo precisa.

**Padrão de sabotagem:** quando as coisas começam a ir bem, você inconscientemente cria um obstáculo. Perde o prazo, briga sem necessidade, procrastina a decisão importante.

**Padrão de antecipação:** você vive preocupado(a) com o que ainda não aconteceu. A energia gasta antecipando problemas supera a energia gasta nos problemas reais.

**Padrão de rigidez:** quando algo sai do planejado, você sente desconforto intenso. A flexibilidade custa caro emocionalmente.

## Como padrões se formam

Padrões emocionais raramente surgem do nada. Eles costumam ser respostas aprendidas — que um dia fizeram sentido como proteção.

A retirada pode ter funcionado quando o conflito era perigoso. A superação pode ter sido necessária quando você precisava ser responsável por outros. A antecipação pode ter sido útil num ambiente imprevisível.

O problema é quando a resposta continua automática mesmo quando o contexto mudou.

## Perguntas para o diário

- Que padrão emocional eu reconheço em mim — mesmo sem querer?
- Em que situações esse padrão aparece com mais força?
- Quando esse padrão começou? O que ele pode ter me protegido no passado?
- O que aconteceria se eu respondesse diferente na próxima vez?
- Qual seria um pequeno experimento para testar uma resposta diferente?

## Aviso importante

Identificar padrões emocionais profundos é um trabalho que se beneficia muito de acompanhamento psicológico. Este conteúdo é um ponto de partida, não um substituto para terapia.""",
    },
    "pequenas-conquistas-importam": {
        "append": """
## Lista de exemplos de pequenas conquistas

Pequenas conquistas são invisíveis porque não aparecem no currículo, não rendem likes e ninguém pergunta sobre elas. Mas elas têm peso real. Aqui vão exemplos:

**No corpo:**
- Tomei água hoje
- Comi alguma coisa mesmo sem apetite
- Tomei banho num dia difícil
- Saí de casa, mesmo que só até a esquina
- Dormi antes da meia-noite

**Na mente:**
- Percebi que estava em espiral de pensamentos e parei por um momento
- Não me comparei com alguém hoje
- Reconheci uma emoção em vez de ignorá-la
- Pedi ajuda quando precisava
- Disse não para algo que me faria mal

**Nos relacionamentos:**
- Respondi uma mensagem que estava adiando
- Disse o que estava sentindo para alguém de confiança
- Coloquei um limite — mesmo que pequeno
- Fiz algo gentil para alguém

**No trabalho ou tarefas:**
- Comecei uma tarefa que estava postergando — mesmo que não terminado
- Organizei uma coisa pequena
- Finalizei algo que estava pela metade

Nenhum desses itens é pequeno demais. Em dias difíceis, alguns deles são enormes.

## Como registrar conquistas pequenas

Uma prática simples: ao final do dia, escreva uma frase respondendo "o que consegui hoje, por menor que seja?"

Não para se sentir produtivo(a) — mas para treinar o olhar a perceber o que existe, não só o que faltou.

## Perguntas para o diário

- Qual foi minha menor conquista de hoje — que normalmente eu não reconheceria?
- Em que área da minha vida tenho mais dificuldade de perceber o progresso?
- O que eu fiz esta semana que no início do ano eu não conseguiria fazer?
- Como eu celebro conquistas — mesmo as pequenas?
- O que eu diria para um amigo que alcançou uma conquista pequena mas significativa?

## Aviso importante

Este conteúdo é de apoio ao autoconhecimento e bem-estar emocional. Não substitui acompanhamento psicológico. Se você tem dificuldade persistente de reconhecer valor em si mesmo(a), considere falar com um profissional.""",
    },
    "descansar-sem-culpa": {
        "append": """
## Estratégias para descansar de verdade

Existem tipos de descanso — e nem todos funcionam da mesma forma para todo mundo:

**Descanso físico:** dormir, deitar, não se mover. É o mais óbvio, mas frequentemente o mais sabotado pela culpa de "não estar fazendo nada".

**Descanso mental:** parar de processar ativamente. Isso significa — sem resolver problemas, sem planejar, sem consumir conteúdo denso. Pode ser uma caminhada sem fone, olhar pela janela, observar a natureza.

**Descanso sensorial:** reduzir estímulos. Sem telas, sem barulho, sem notificações. Para pessoas com sobrecarga sensorial, isso é tão reparador quanto dormir.

**Descanso social:** tempo sem precisar performar, explicar ou estar disponível para outros. Para introvertidos, é especialmente necessário.

**Descanso criativo:** deixar a mente vagar sem direção. Doodle, cozinhar algo simples, arrumar um espaço pequeno — atividades que não exigem resultado.

**Descanso emocional:** espaço para sentir sem precisar ser forte, positivo ou funcional. Chorar, reconhecer que está difícil, pedir para ser cuidado.

## Por que a culpa aparece quando você descansa

A culpa do descanso costuma vir de uma crença internalizada de que valor pessoal = produtividade. Quando você para, uma parte da mente interpreta isso como "estou sendo menos".

Essa crença não é verdade — mas ela é muito persuasiva.

Uma pergunta para confrontar essa crença: "Eu condenaria um amigo por descansar?" Quase sempre a resposta é não. Por que você se condena?

## Permissão para descansar

Você não precisa ganhar o descanso. Não precisa estar exausto(a) para merecer parar. Não precisa justificar para ninguém — nem para você mesmo(a).

Descanso não é ausência de produção. É parte do que torna a produção possível. E mais do que isso: é parte do que torna a vida habitável.

## Perguntas para o diário

- Qual tipo de descanso sinto mais falta na minha vida agora?
- O que acontece dentro de mim quando paro para descansar? Surge culpa? Ansiedade? Alívio?
- De onde veio a crença de que preciso merecer o descanso?
- O que seria diferente na minha semana se eu descansasse de forma intencional?
- Qual é uma forma de descanso que posso me dar hoje — sem culpa?

## Aviso importante

Este conteúdo é de apoio ao bem-estar emocional. Não substitui acompanhamento psicológico, médico ou psiquiátrico. Dificuldades persistentes para descansar podem ter causas que se beneficiam de avaliação profissional.""",
    },
}


def get_article_content(slug: str):
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}&select=id,content"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            if data:
                return data[0].get("id"), data[0].get("content", "")
            return None, None
    except urllib.error.HTTPError as e:
        print(f"  Erro ao buscar {slug}: {e.code} {e.read().decode()}")
        return None, None


def patch_article(slug: str, content: str):
    url = f"{SUPABASE_URL}/rest/v1/articles?slug=eq.{slug}"
    body = json.dumps({"content": content}).encode("utf-8")
    headers = {**HEADERS, "Prefer": "return=minimal"}
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"  ATUALIZADO: {slug} (status {resp.status})")
    except urllib.error.HTTPError as e:
        print(f"  ERRO ao atualizar {slug}: {e.code} {e.read().decode()}")


DISCLAIMER = """
## Aviso importante

Este conteúdo é de apoio ao autoconhecimento e bem-estar emocional. Não substitui acompanhamento psicológico, psiquiátrico ou médico. Se você está passando por dificuldades significativas, considere buscar apoio profissional."""

DIARY_SECTION_MARKER = "perguntas para o diário"
DISCLAIMER_MARKER = "aviso importante"


def needs_section(content: str, marker: str) -> bool:
    return marker not in content.lower()


def main():
    print("=== Expandindo artigos curtos ===\n")
    for slug, expansion in EXPANSIONS.items():
        print(f"Processando: {slug}")
        article_id, existing_content = get_article_content(slug)

        if article_id is None:
            print(f"  Artigo não encontrado — pulando.")
            continue

        new_content = existing_content or ""

        # Append expansion block (which includes diary questions + disclaimer)
        append_text = expansion.get("append", "")
        if append_text:
            # Only append if the expansion's diary section isn't already present
            # (check for a key phrase from the expansion)
            first_line = append_text.strip().split("\n")[0]
            if first_line.replace("## ", "").strip().lower() not in new_content.lower():
                new_content = new_content.rstrip() + "\n\n" + append_text.strip()
                print(f"  Conteúdo expandido adicionado.")
            else:
                print(f"  Expansão já presente — pulando append.")

        # Ensure disclaimer exists
        if needs_section(new_content, DISCLAIMER_MARKER):
            new_content = new_content.rstrip() + "\n\n" + DISCLAIMER.strip()
            print(f"  Aviso de responsabilidade adicionado.")

        patch_article(slug, new_content)

    print("\n=== Concluído ===")


if __name__ == "__main__":
    main()
