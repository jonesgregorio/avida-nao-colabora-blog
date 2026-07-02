# Correções — Auditoria ZIP24

## Pré-condição (estado antes)
| Verificação | Resultado |
|---|---|
| `npm run build` | ✅ sem erros |
| `npx tsc --noEmit` | ✅ 0 erros |
| `npm run lint` | ⚠️ 203 avisos (sem erros) |
| `npm audit --omit=dev` | ⚠️ 2 vulnerabilidades dev-only (esbuild/vite) |

---

## Item 2 — CORS em `manage-subscription`
**Arquivo:** `supabase/functions/manage-subscription/index.ts`

Adicionado:
- Handler `OPTIONS` retornando `204` com headers CORS
- `CORS_HEADERS` constante (`Access-Control-Allow-Origin: *`)
- Todos os `Response` retornam os headers CORS + `Content-Type: application/json`
- Helper `jsonResponse()` para reduzir repetição

---

## Item 3 — Downgrade Stripe
O fluxo já estava correto: `cancel_at_period_end=true` + `pending_plan` armazenado.
O webhook `customer.subscription.deleted` lê `pending_plan` e aplica o plano correto.
Nenhuma alteração necessária além do que foi feito.

---

## Item 4 — `payment_events` — coluna `provider_payment_id`
**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

Corrigido: `stripe_invoice_id` → `provider_payment_id` no INSERT de `payment_events`
(conforme schema em `022_subscriptions_email.sql`).

---

## Item 5 — Ordem de operações no webhook checkout
**Arquivo:** `supabase/functions/stripe-webhook/index.ts`

Corrigido: busca `prevProfile.plan` (oldPlan) **antes** de executar o `UPDATE profiles.plan`,
garantindo que o histórico registre o plano anterior correto.

---

## Item 6 — Colunas pending em `user_subscriptions`
**Migration:** `042_subscriptions_pending_and_rpc.sql`

Adicionadas colunas:
- `pending_plan_key TEXT`
- `pending_change_type TEXT`
- `pending_change_status TEXT DEFAULT 'scheduled'`

---

## Item 7 — Notificações via backend (service role)
Já implementado em sessões anteriores: `manage-subscription` e `stripe-webhook`
inserem notificações usando o cliente `service_role` (sem passar pelo RLS de usuário).

---

## Item 8 — `Auth.tsx` — sem upsert no cadastro
**Arquivo:** `src/components/Auth.tsx`

Removido o bloco `supabase.from('profiles').upsert(...)` após `signUp`.
O trigger `handle_new_user` (migration 022) já cria o perfil automaticamente
com `full_name` lido de `raw_user_meta_data`, sem risco de sobrescrever campos protegidos.

---

## Item 9 — Política INSERT em `profiles` mais restritiva
**Migration:** `042_subscriptions_pending_and_rpc.sql`

Recriada a policy `users_insert_own_profile` adicionando:
```sql
AND COALESCE(unlimited_access, false) = false
```
Além das checagens já existentes de `plan = 'free'` e `role = 'user'`.

---

## Item 10 — `ForceChangePassword` (RPC)
Concluído em sessão anterior. Usa RPC `clear_must_change_password()` SECURITY DEFINER.

---

## Item 11 — `AdminPermissions` (`.eq('id', id)`)
Verificado em sessão anterior. Consulta correta — filtra pelo `id` do registro de permissão, não pelo `user_id`.

---

## Item 12 — `personalizedDeliveryService.ts`
Verificado: o serviço já usa `monthly_guidance_requests` e `professional_comments`
com os campos corretos (`comment`, `comment_text`, `month_key`, etc.). Nenhuma alteração necessária.

---

## Item 13 — Guia mensal duplicada
Verificado: `personalizedDeliveryService.ts` reflete respostas em `monthly_guidance_requests`,
não em `support_tickets`. Fluxo correto, nenhuma alteração necessária.

---

## Item 14 — Destinos das notificações (`action_view`)
**Arquivos:** `stripe-webhook/index.ts`, `manage-subscription/index.ts`

Adicionado `action_view: 'my-plan'` a todas as notificações de plano/pagamento inseridas
pelos dois Edge Functions.

---

## Item 15 — RPC `mark_personalized_content_as_read`
**Migration:** `042_subscriptions_pending_and_rpc.sql`

Criada função SECURITY DEFINER:
```sql
mark_personalized_content_as_read(delivery_id UUID)
```
Atualiza `status = 'archived'` somente para conteúdos do próprio usuário com `status = 'sent'`.
GRANT EXECUTE para `authenticated`.

---

## Pós-condição (estado após)
| Verificação | Resultado |
|---|---|
| `npm run build` | ✅ sem erros |
| `npx tsc --noEmit` | ✅ 0 erros |
| Deploy `manage-subscription` | ✅ v2 |
| Deploy `stripe-webhook` | ✅ v10 |
| Migration 042 | ✅ aplicada em produção |
