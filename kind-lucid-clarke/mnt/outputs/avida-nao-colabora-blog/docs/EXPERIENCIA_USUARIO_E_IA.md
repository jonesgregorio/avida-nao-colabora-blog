# Experiência do usuário e uso interno de IA

## Princípio de produto

A inteligência artificial pode ser usada internamente para apoiar geração, interpretação, organização, recomendação, rascunhos e automações do produto. Esse mecanismo não deve ser apresentado ao usuário final como parte da experiência.

A interface do usuário deve falar sobre o benefício entregue — por exemplo: **leitura**, **orientação**, **sugestões**, **organização**, **resumo**, **plano** ou **recomendação** — sem destacar IA, modelo, provider, prompt, Edge Function ou demais detalhes de implementação.

## O que continua interno

Campos e contratos técnicos como `ai_disabled`, `ai_title`, `ai_reflection`, `ai_suggested_tags`, `ai_draft_json`, `ai_used`, `provider` e `model` continuam válidos quando necessários para compatibilidade, auditoria, observabilidade, proveniência e operação administrativa.

O Admin pode manter referências explícitas a IA, providers, modelos, logs e geração automática porque essa informação é operacional e necessária para governança do sistema.

## Regras para interfaces do usuário

1. Não usar rótulos como “com IA”, “análise de IA”, “gerado por IA” ou “a IA percebeu”.
2. Não expor mensagens cruas de providers, Edge Functions ou serviços internos.
3. Falhas devem virar mensagens neutras relacionadas à funcionalidade que a pessoa estava usando.
4. Preferências de privacidade devem descrever o efeito percebido pelo usuário, sem explicar a implementação interna.
5. Quando houver revisão administrativa obrigatória, a interface pode comunicar que a solicitação está “em análise” ou “sendo preparada”, sem expor o rascunho interno.
6. Não remover metadados técnicos ou históricos apenas para alterar linguagem de interface.

## Exemplos atuais

- Diário: “Salvar sem leitura complementar”.
- Reflexão após o Diário: “O que apareceu no seu registro” e sugestões que a pessoa confirma antes de entrarem no mapa/relatórios.
- Mapa Emocional: “Entender melhor meu mapa”.
- Orientação Mensal: solicitação “em análise”, com resposta final apresentada como orientação.
- Plano de Autocuidado e Relatórios: apresentar base, sinais, prioridades e leituras sem revelar o mecanismo interno de geração.

## Proteção contra regressão

`tests/userFacingAiDisclosure.test.ts` verifica as principais superfícies do usuário e os helpers que podem propagar mensagens de erro. Novos recursos voltados ao usuário que utilizem IA internamente devem ser adicionados a essa proteção quando relevante.
