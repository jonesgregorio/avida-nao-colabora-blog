# AGENTS.md — A Vida Não Colabora

Estas instruções se aplicam a todo o repositório, salvo se um `AGENTS.md` mais específico existir em um subdiretório.

## Fonte de verdade

Trabalhe sempre a partir da `main` remota mais recente.

Prioridade de referência:
1. código e testes atuais da `main`;
2. `kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/README.md`;
3. `CONTRIBUTING.md`;
4. documentação atual fora de `docs/archive/`;
5. ZIPs e documentos arquivados apenas como histórico.

Não use ZIP antigo, prompt histórico ou arquivo de `docs/archive/` para substituir uma implementação mais nova existente na `main`.

## Diretório real do aplicativo

```text
kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog
```

Execute os comandos do projeto a partir desse diretório:

```bash
cd kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog
```

## Protocolo de trabalho para Codex e outros agentes

Antes de editar:
- sincronize a `main`;
- crie/use branch própria da tarefa;
- inspecione os arquivos atuais e os testes relacionados;
- verifique se outro agente já implementou parte da solução.

Regras obrigatórias:
- não faça push direto na `main`;
- não faça force push nem reescreva o histórico da `main`;
- não apague ou reverta mudanças válidas de Claude, ChatGPT, Codex ou do usuário sem necessidade explícita;
- prefira patches localizados a substituições amplas;
- mantenha alterações não relacionadas fora do PR;
- antes do merge, compare novamente com a `main` para evitar sobrescrever trabalho paralelo;
- resolva conflitos preservando comportamento válido dos dois lados sempre que possível.

## Contratos de produto de alto risco

Planos oficiais atuais:
- Gratuito;
- Essencial;
- Plus.

Nomes legados como Terapêutico/Terapêutico Plus não devem retornar como nomes principais.

Tags emocionais possuem significados diferentes:

```text
emotional_tags   = marcadores emocionais
trigger_tags     = gatilhos reais
context_tags     = contextos
need_tags        = necessidades
care_action_tags = ações de cuidado
```

Nunca converta `emotional_tags` em gatilhos.

Consulte o README atual antes de alterar regras de plano, diário, mapa emocional, relatórios, autocuidado, orientação, automações editoriais ou Admin.

## Pagamentos e secrets

Preserve estes fluxos Stripe, salvo solicitação explícita de alteração:
- `create-checkout`;
- `stripe-webhook`;
- `manage-subscription`.

Uma tarefa de UI, IA, diário, relatórios, conteúdo ou Admin não autoriza refatoração de pagamentos.

Nunca envie para frontend ou commit:
- Supabase `service_role`;
- Stripe secret keys;
- chaves privadas de IA;
- tokens de automação ou outros secrets.

## Supabase

Não reaplique manualmente uma sequência antiga de migrations. Preserve compatibilidade com dados existentes e os workflows oficiais de migrations/Edge Functions.

Mudanças em migrations, RLS, RPCs, cron ou Edge Functions devem ser deliberadas, revisáveis e testadas. Não altere produção diretamente se a tarefa puder seguir pelo fluxo normal de código + PR.

## Checks obrigatórios

No diretório do app, execute antes de concluir:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Quando a tarefa tocar nas automações críticas, execute também:

```bash
deno check --node-modules-dir=auto \
  supabase/functions/run-automations/index.ts \
  supabase/functions/run-emotional-automations/index.ts
```

O workflow `.github/workflows/ci.yml` deve permanecer um CI de validação, não um robô de autocorreção. Não crie workflows temporários que façam commits/push automáticos para contornar falhas.

## Entrega

Ao finalizar:
- descreva arquivos e comportamentos alterados;
- informe validações executadas;
- destaque qualquer risco ou item ainda não verificado;
- não declare sucesso com check obrigatório falhando;
- abra PR para `main` em vez de publicar diretamente.
