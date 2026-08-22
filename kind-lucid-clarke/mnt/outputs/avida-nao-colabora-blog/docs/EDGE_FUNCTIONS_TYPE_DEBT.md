# Dívida de tipo conhecida — Edge Functions Stripe

Registrado em 21/08/2026, quando o CI passou a rodar `deno check` em todas as
21 Edge Functions (antes cobria só 4). Essas 10 falharam na primeira vez que
foram verificadas. **Nenhuma delas é regressão** desta mudança — o erro já
existia no código, só nunca tinha sido detectado porque nada rodava `deno check`
nelas.

## Por que isso não bloqueia o CI agora

`.github/workflows/ci.yml` trata essas 10 funções como dívida conhecida: o
`deno check` roda nelas e o resultado aparece no log, mas uma falha aqui não
derruba o job. Qualquer outra função — as 11 saudáveis ou uma nova — continua
tendo que passar de verdade.

Isso existe porque corrigir requer editar arquivos Stripe, e o projeto proíbe
mexer em pagamentos como efeito colateral de uma tarefa que não pediu isso
explicitamente. A correção precisa ser uma tarefa própria, autorizada
explicitamente para tocar em Stripe.

## Causa raiz predominante

A maioria dos erros é a mesma linha em arquivos diferentes:

```ts
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2024-06-20' })
```

```
TS2322 [ERROR]: Type '"2024-06-20"' is not assignable to type '"2023-10-16"'.
```

O pacote instalado é `stripe@14.25.0`. O tipo TypeScript dessa versão do SDK
só aceita `'2023-10-16'` como valor literal de `apiVersion`. Em algum momento
o código passou a usar `'2024-06-20'` sem atualizar o SDK (ou o SDK foi fixado
numa versão mais antiga depois do código já usar a versão nova).

**Isso é uma incompatibilidade de tipos, não necessariamente um erro em
runtime** — a Stripe aceita a string de versão de API diretamente na
requisição HTTP, independente do que o SDK declara como tipo. Mas não dá para
assumir que é inofensivo sem confirmar qual comportamento da API
`2024-06-20` o código depende e se `2023-10-16` teria diferença relevante.
**Isso precisa ser investigado por quem for corrigir**, não assumido.

## Funções afetadas e erros específicos

| Função | Erros |
|---|---|
| `admin-discount` | `apiVersion` incompatível |
| `admin-plan-pricing` | `apiVersion` incompatível |
| `admin-schedule-cancellation` | `apiVersion` incompatível |
| `configure-stripe-webhook` | `apiVersion` incompatível **+** `Type 'string[]' is not assignable to type 'EnabledEvent[]'` |
| `create-checkout` | `apiVersion` incompatível |
| `manage-subscription` | `apiVersion` incompatível **+** `Type 'number \| ""' is not assignable to type 'number'` |
| `resend-webhook` | `TS2769: No overload matches this call` (não é o mesmo padrão de `apiVersion`) |
| `stripe-audit` | `apiVersion` incompatível **+** `TS2345: Argument of type ... is not assignable` (mais de um erro, log truncado durante o levantamento) |
| `stripe-selftest` | falha confirmada, detalhe não coletado no levantamento inicial — reconferir ao corrigir |
| `stripe-webhook` | `apiVersion` incompatível |

**Não é um bug único.** `configure-stripe-webhook`, `manage-subscription` e
`stripe-audit` têm pelo menos um erro adicional, diferente entre si, além do
`apiVersion`. `resend-webhook` parece ter um problema totalmente diferente,
apesar do nome sugerir relação com Stripe.

## Procedimento para corrigir

Isso não deve ser feito dentro de uma tarefa de CI, UI, diário, IA ou
relatórios. Precisa ser uma tarefa própria com autorização explícita para
mexer em Stripe, seguindo o fluxo normal:

1. Confirmar com o time/produto por que `apiVersion: '2024-06-20'` foi
   escolhido e se ele está realmente em uso nas chamadas à API da Stripe, ou
   se é resquício de uma atualização parcial.
2. Decidir entre atualizar o pacote `stripe` para uma versão cujo tipo aceite
   `2024-06-20`, ou alinhar o código para `2023-10-16` — **não escolher
   mecanicamente**, isso pode mudar comportamento de webhooks e checkout.
3. Corrigir os demais erros de tipo função por função, cada um pode ter causa
   diferente.
4. Rodar `deno check` em cada função corrigida e confirmar localmente.
5. Remover a função de `known_broken` em `.github/workflows/ci.yml` e da
   tabela acima **assim que ela passar de verdade** — o próprio CI avisa
   quando isso acontece (mensagem "função(ões) da lista de dívida agora
   PASSAM").
6. Testar os fluxos Stripe afetados (checkout, webhook, portal de assinatura,
   desconto, agendamento de cancelamento) antes de mergear, seguindo a
   validação normal de Stripe do projeto.
7. Nunca remover uma função desta lista sem o CI confirmar que ela passa.

## Risco de manter a dívida

Enquanto essas 10 funções não forem corrigidas, um erro de tipo **novo**
introduzido nelas por engano também não vai bloquear o CI, porque a função já
está na lista de dívida conhecida. É uma cobertura pior do que as 11 funções
saudáveis, mas ainda é melhor do que a situação anterior, em que nenhuma das
21 era verificada.
