# Incidente — loading infinito de autenticação (2026-08-27)

## Sintoma
Blog e Admin permaneciam no loader global `Carregando...`, impedindo chegar à tela de login e às áreas autenticadas.

## Diagnóstico
- Vercel em produção estava `READY`, sem erro 5xx de runtime relacionado.
- Supabase Database/PostgREST continuava respondendo normalmente.
- Logs de Auth mostraram chamadas de sessão/token com latências anormalmente altas.
- `useAuth()` mantinha `loading=true` até `getSession()` e o carregamento do perfil terminarem, sem timeout.

## Correção
- timeout defensivo de 8 segundos para liberar o shell mesmo se o Auth ficar lento;
- quando a sessão já é conhecida, o perfil termina de carregar em segundo plano;
- fluxos posteriores de autenticação continuam usando o carregamento normal do perfil;
- cleanup do timer ao desmontar o hook.

## Escopo
Sem alteração de Stripe, planos, RLS, banco ou regras de autorização.
