# Verificação de tipos das Edge Functions

Atualizado em 22/08/2026: **nenhuma Edge Function tem exceção no CI**.
O workflow descobre todas as funções com `index.ts`, executa `deno check` em
cada uma e bloqueia o merge se qualquer verificação falhar.

## Pendência eliminada

As cinco funções que estavam temporariamente fora da barreira do CI agora
passam no `deno check`:

- `manage-subscription`
- `resend-webhook`
- `stripe-audit`
- `stripe-selftest`
- `stripe-webhook`

As correções preservam o comportamento em produção:

- O valor real de `apiVersion` enviado ao Stripe continua
  `'2024-06-20'`. O uso de `as Stripe.LatestApiVersion` é apenas uma
  anotação para compatibilizar o SDK `stripe@14.25.0`, cujo tipo literal está
  desatualizado em relação ao valor já usado pelo produto.
- As funções Stripe que usam consultas Supabase receberam tipos de cliente
  compatíveis com o cliente de serviço já criado em execução. Não houve
  mudança em consultas, eventos, planos, cobranças ou permissões.
- `resend-webhook` agora informa explicitamente que seu buffer é
  `ArrayBuffer`, como exige a assinatura criptográfica do Deno; os bytes
  processados continuam os mesmos.
- `manage-subscription` guarda o identificador de usuário após a validação de
  autenticação, removendo apenas uma incerteza de tipagem em callbacks.

## Regra atual

Não adicione uma lista de funções toleradas ou uma exceção que transforme
erro de tipo em aviso. Caso uma função futura falhe, a correção deve passar
pelo mesmo `deno check` antes do merge.
