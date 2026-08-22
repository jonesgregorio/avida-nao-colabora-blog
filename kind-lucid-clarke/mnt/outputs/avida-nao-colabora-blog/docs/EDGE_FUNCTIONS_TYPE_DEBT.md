# Dívida de tipo conhecida — Edge Functions

Registrado em 21/08/2026, quando o CI passou a rodar `deno check` em todas as
21 Edge Functions (antes cobria só 4). 10 falharam na primeira vez que foram
verificadas. **Nenhuma delas era regressão** dessa mudança — o erro já existia
no código, só nunca tinha sido detectado porque nada rodava `deno check` nelas.

Em 21/08/2026, 5 das 10 foram totalmente corrigidas (ver seção "Corrigidas"
abaixo). Uma sexta (`stripe-webhook`) teve o erro de `apiVersion` corrigido,
mas continua com dívida por outros erros não relacionados. 5 restam como
dívida conhecida.

## Por que a dívida restante não bloqueia o CI

`.github/workflows/ci.yml` trata as 5 funções da lista `known_broken` como
dívida conhecida: o `deno check` roda nelas e o resultado aparece no log, mas
uma falha ali não derruba o job. Qualquer outra função — as agora 16
saudáveis, ou uma nova — continua tendo que passar de verdade. O próprio CI
avisa sozinho se uma função da lista voltar a passar (mensagem "agora
PASSAM").

## Corrigidas em 21/08/2026

`admin-discount`, `admin-plan-pricing`, `admin-schedule-cancellation`,
`create-checkout` e `configure-stripe-webhook` tinham o mesmo erro:

```
TS2322 [ERROR]: Type '"2024-06-20"' is not assignable to type '"2023-10-16"'.
```

O pacote instalado é `stripe@14.25.0`. O tipo TypeScript dessa versão do SDK
só aceita `'2023-10-16'` como valor literal de `apiVersion`, mas o código
passa `'2024-06-20'`.

A correção usa um padrão que já existia no próprio projeto, em
`run-lifecycle-emails/index.ts` (função que já passava no `deno check`):

```ts
apiVersion: '2024-06-20' as Stripe.LatestApiVersion
```

Isso é **só uma anotação de tipo** — não muda a string que é enviada para a
Stripe em tempo de execução, que continua sendo `'2024-06-20'` exatamente
como antes. Zero mudança de comportamento.

`configure-stripe-webhook` tinha um segundo erro:

```
TS2322 [ERROR]: Type 'string[]' is not assignable to type 'EnabledEvent[]'.
```

A lista `WEBHOOK_EVENTS` (`checkout.session.completed`,
`invoice.payment_succeeded`, `invoice.payment_failed`,
`customer.subscription.created/updated/deleted`) tem nomes de evento reais e
válidos da Stripe — não havia erro de digitação. O problema era só a
inferência de tipo: `const WEBHOOK_EVENTS = [...]` sem anotação vira
`string[]` genérico. A correção anota o tipo explícito
`Stripe.WebhookEndpointUpdateParams.EnabledEvent[]`, sem alterar nenhum valor
da lista.

## Dívida restante

| Função | Erro | Relacionado a Stripe? |
|---|---|---|
| `manage-subscription` | `Type 'number \| ""' is not assignable to type 'number'`, mais `'user' is possibly 'null'` (2 ocorrências). `apiVersion` **não** corrigido aqui ainda | Sim |
| `stripe-webhook` | `apiVersion` **já corrigido** com o mesmo cast dos demais. Restam vários erros não relacionados: `SupabaseClient<any, "public", "public", any, any>` não é atribuível ao tipo esperado por uma chamada, o que faz o TypeScript inferir `never` para o retorno — daí cascatas como `Object literal may only specify known properties and 'stripeeventid' does not exist in type 'never[]'`, `Property 'plan' does not exist on type 'never'`, `Property 'userid' does not exist on type 'never'`. Não é um erro, é uma cadeia de erros com uma causa raiz provável (incompatibilidade de versão/generics do `supabase-js` num helper compartilhado) | O `apiVersion` sim; a cascata de `never` não |
| `stripe-audit` | `apiVersion` **não** corrigido aqui ainda, **+** o mesmo padrão de `Argument of type 'SupabaseClient<any, "public", "public", any, any>' is not assignable to parameter of type 'SupabaseClient<unknown, {...` visto em `stripe-webhook` (mais de uma ocorrência) | Parcialmente — o segundo erro é o mesmo problema de `SupabaseClient` de `stripe-webhook`, não é sobre Stripe |
| `stripe-selftest` | falha confirmada, detalhe não coletado — a ferramenta de captura de log falhou durante o levantamento | A confirmar |
| `resend-webhook` | `TS2769: No overload matches this call` | **Não.** Esta função é o webhook do Resend (e-mail), não tem nenhum import ou uso de Stripe. Está nesta lista só porque falhou no mesmo lote. O erro provavelmente está em `crypto.subtle.importKey`/`sign` ou no cliente Supabase — precisa de investigação própria, separada da dívida Stripe |

`stripe-webhook` e `stripe-audit` compartilham o mesmo erro de
`SupabaseClient` — vale investigar as duas juntas, provavelmente é a mesma
causa raiz (um helper compartilhado ou uma versão de `@supabase/supabase-js`
com generics incompatíveis entre o client usado nessas funções e o que uma
chamada espera).

`manage-subscription` tem um valor que pode ser `number` ou string vazia
`""` onde a Stripe espera só `number` — suspeita é um campo de data/timestamp
(`start_date`/`end_date` de `subscriptionSchedules`), mas não foi confirmado
com certeza qual variável carrega esse tipo nem se há caminho de execução
real que produza a string vazia. **Não corrigir por suposição** — precisa
achar a linha exata primeiro.

## Procedimento para corrigir o que resta

1. Rodar `deno check` localmente ou reabrir o log do CI para pegar
   linha/coluna exata de cada erro (o levantamento de 21/08 não conseguiu
   isolar todas as linhas por limitação da ferramenta usada, não por falta do
   dado no log).
2. Para `manage-subscription`: identificar a variável exata que é
   `number | ""` e decidir se o `""` é um estado real possível (nesse caso,
   tratar antes de repassar pra Stripe) ou só uma tipagem solta que pode
   virar `number | undefined` sem mudar comportamento.
3. Para `stripe-webhook` e `stripe-audit`: investigar juntas o erro de
   `SupabaseClient<any, "public", "public", any, any>` — provavelmente a
   mesma causa raiz nas duas. `apiVersion` de `stripe-audit` ainda precisa do
   mesmo cast usado nas outras 6 funções já corrigidas.
4. Para `resend-webhook`: tratar como um ticket próprio, não relacionado a
   Stripe.
5. Corrigir uma função por vez, confirmar com `deno check` isolado antes de
   seguir para a próxima.
6. Remover cada função de `known_broken` em `.github/workflows/ci.yml` e
   desta tabela assim que ela passar de verdade.
7. Testar os fluxos Stripe afetados antes de mergear qualquer correção que
   toque `manage-subscription`, `stripe-webhook` ou `stripe-audit`.

## Risco de manter a dívida

Enquanto essas 5 funções não forem corrigidas, um erro de tipo **novo**
introduzido nelas por engano também não vai bloquear o CI, porque a função já
está na lista de dívida conhecida.
