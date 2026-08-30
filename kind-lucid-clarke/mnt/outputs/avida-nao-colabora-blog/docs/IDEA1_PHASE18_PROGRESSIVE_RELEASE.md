# Ideia 1 — Fase 18: liberação progressiva

## Objetivo

Dar ao produto um controle operacional para liberar gradualmente novas superfícies proativas da Ideia 1 sem manter duas versões do app e sem retirar recursos já contratados.

## Fonte de configuração

A fase reutiliza `public.analytics_settings` (`id = 1`), cuja coluna `config` já é um JSON global lido pelo app e protegido para escrita administrativa pelas políticas existentes.

A chave usada é isolada:

```json
{
  "idea1_rollout": {
    "enabled": true,
    "percentage": 100
  }
}
```

A ausência da chave equivale a `enabled: true` e `percentage: 100`, preservando integralmente a experiência já publicada.

## Coorte

O bucket do usuário é determinístico (0–99) e deriva apenas do identificador da conta. Não depende de sessão, horário, humor, texto do Diário nem qualquer conteúdo emocional.

- `100%`: todos elegíveis;
- `0%`: nenhum novo usuário recebe a superfície controlada;
- `enabled = false`: pausa operacional;
- falha de leitura: fail-open, mantendo a experiência atual.

## Primeira superfície controlada

Nesta fase, o rollout controla **somente novos convites para escolher um Foco da Semana na Home**.

O rollout não remove estado existente. Se o usuário já tiver um foco salvo ou uma reflexão pendente, o card continua disponível mesmo que o percentual seja reduzido ou a liberação seja pausada.

## Fora do rollout

O controle não altera:

- autenticação;
- Stripe, checkout, webhook ou assinatura;
- nomenclatura e entitlement dos planos;
- Diário e check-in;
- Mapa Emocional;
- relatórios;
- Plano de Autocuidado;
- Conteúdos Guiados;
- dados já salvos pelo usuário.

## Operação

O painel administrativo expõe o controle em **Sistema → Liberação**, com switch de pausa e percentual de 0 a 100. A mudança passa a valer em novas montagens da Home; não exige novo deploy.

## Evolução

Outras superfícies proativas só devem entrar neste mecanismo quando puderem obedecer à mesma regra: rollout pode controlar convite/apresentação, mas não pode invalidar entitlement, apagar estado, esconder dado já criado ou bloquear um recurso contratado.
