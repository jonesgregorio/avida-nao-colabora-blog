# CLAUDE.md — A Vida Não Colabora

Este arquivo define as regras de trabalho do Claude neste repositório.

## Fonte de verdade

A fonte de verdade é a `main` mais recente do GitHub.

Ordem de confiança:
1. código e testes atuais da `main`;
2. `kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/README.md`;
3. `CONTRIBUTING.md`;
4. documentação atual fora de `docs/archive/`;
5. documentos arquivados e ZIPs antigos somente como histórico, nunca como especificação principal.

Nunca recrie comportamento antigo apenas porque aparece em ZIP, prompt ou documento arquivado.

## Local correto do aplicativo

O aplicativo real está em:

```text
kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog
```

Para executar comandos do app:

```bash
cd kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog
```

A configuração `.claude/launch.json` da raiz já aponta para esse diretório.

## Fluxo obrigatório de colaboração

Antes de alterar qualquer coisa:
1. sincronize a `main` remota;
2. confirme que está trabalhando a partir da versão mais recente;
3. crie/use uma branch própria para a tarefa;
4. leia os arquivos atuais antes de editar;
5. preserve implementações válidas feitas por Claude, Codex, ChatGPT ou pelo usuário.

Durante o trabalho:
- não faça push direto na `main`;
- não use `force push`, `reset --hard` ou reescrita destrutiva de histórico na `main`;
- não substitua arquivos inteiros sem necessidade quando uma alteração localizada for suficiente;
- não reverta trabalho de outro agente só para simplificar sua solução;
- quando houver conflito, compare com a `main` mais recente e preserve as duas intenções sempre que possível;
- mantenha cada PR focado no escopo solicitado.

## Regras de produto que não podem regredir

Planos oficiais atuais:
- Gratuito;
- Essencial;
- Plus.

Nomes antigos como Terapêutico/Terapêutico Plus existem apenas por compatibilidade histórica e não devem voltar como nomenclatura principal.

Separação de dados emocionais:

```text
emotional_tags   = marcadores emocionais
trigger_tags     = gatilhos reais
context_tags     = contextos
need_tags        = necessidades
care_action_tags = ações de cuidado
```

Nunca trate `emotional_tags` como gatilhos.

O README do app contém a definição atual de diário, mapa emocional, relatórios, plano de autocuidado, orientação mensal, automações editoriais e regras por plano. Consulte-o antes de alterar essas áreas.

## Stripe e pagamentos

Fluxos críticos existentes:
- `create-checkout`;
- `stripe-webhook`;
- `manage-subscription`.

Não altere, refatore, renomeie ou remova fluxos Stripe como efeito colateral de tarefas de UI, diário, IA, relatórios, conteúdo ou Admin. Só mexa em pagamentos quando a tarefa pedir isso explicitamente.

Nunca exponha chaves secretas, `service_role`, secrets Stripe ou chaves de IA no frontend, logs, commits ou documentação pública.

## Supabase, migrations e automações

Não reaplique migrations antigas manualmente nem use listas históricas como roteiro de produção.

Preserve os workflows oficiais e os contratos atuais das Edge Functions. Mudanças em banco, RLS, cron, RPC ou Edge Functions devem ser compatíveis com dados existentes e acompanhadas de validação adequada.

Não altere produção diretamente quando a tarefa puder ser resolvida por código + PR.

## Validação obrigatória

Antes de declarar uma tarefa concluída, execute no diretório do app:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Para mudanças nas automações críticas também valide:

```bash
deno check --node-modules-dir=auto \
  supabase/functions/run-automations/index.ts \
  supabase/functions/run-emotional-automations/index.ts
```

O CI oficial em `.github/workflows/ci.yml` é a barreira final. Se o CI falhar, corrija a causa na branch; não crie workflows temporários que façam commits automáticos para mascarar a falha.

## Critério de conclusão

Uma tarefa só está concluída quando:
- o escopo solicitado foi implementado;
- funcionalidades existentes fora do escopo foram preservadas;
- testes e validações relevantes passaram;
- nenhuma regressão conhecida foi escondida;
- o PR descreve claramente o que mudou e o que não foi alterado.
