# Ideia 1 — Fase 9: Conteúdo contextual + Cuidar

## Objetivo

Conectar o que a pessoa acabou de registrar/observar com conteúdos úteis e com os recursos de cuidado já existentes, sem criar um segundo sistema paralelo.

## Decisões desta fase

- Home Hoje e Mapa Emocional continuam usando o componente existente `RecommendedContent`.
- A pontuação nesses dois contextos passa a usar somente sinais estruturados recentes: humor, energia, ansiedade, marcadores emocionais, contextos, necessidades, ações de cuidado, gatilhos estruturados e resultado estruturado de questionário.
- Vários check-ins no mesmo dia são agregados em um único ponto antes da pontuação.
- Texto livre não entra na pontuação de conteúdo da Home/Mapa.
- A barreira de segurança permanece: campos de texto livre são verificados separadamente apenas para detectar linguagem de risco e, nesse caso, o bloco de conteúdo é substituído pelo suporte de segurança existente.
- O Plano de Autocuidado continua usando o foco mensal como contexto principal para as recomendações e passa a explicar isso explicitamente na interface.
- O grupo `Cuidar` já existente na navegação é preservado. Não foi criada uma página-hub duplicada apenas para apontar para Plano de Autocuidado e Orientação.

## O que não mudou

- catálogo de conteúdos;
- preços e entitlements;
- regras do Plano de Autocuidado;
- Orientação;
- Stripe;
- banco de dados/migrations;
- Edge Functions;
- conteúdo livre do Diário para as outras funções que já dependem dele.

## Princípio de produto

A recomendação deve responder a: “por que isso apareceu para mim agora?” sem transformar associação em causa e sem usar mais dados do que o necessário para aquela experiência.
