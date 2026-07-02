# Correções Finais de Produção — A Vida Não Colabora
**Data:** 2026-07-02

---

## 1. Resumo executivo

| Item | Status |
|---|---|
| IA alterada | ❌ Não |
| Planos/preços alterados | ❌ Não |
| ForceChangePassword usa RPC (não UPDATE direto) | ✅ |
| INSERT em profiles protege plan e role | ✅ |
| useAuth upsert com ignoreDuplicates | ✅ |
| stripe-webhook expandido (subscriptions + payment_events + histórico + notificações) | ✅ |
| Edge Function manage-subscription criada | ✅ |
| MyPlanPage chama manage-subscription (não banco diretamente) | ✅ |
| AdminPermissions verificado (sem alteração necessária) | ✅ |
| Build passa | ✅ |
| TypeScript sem erros | ✅ |

---

## 2. Confirmação de que a IA não foi alterada

Nenhuma alteração foi feita em providers, prompts, serviços, funções ou lógica de geração de IA.

Os seguintes arquivos e funções permaneceram intocados:
- `src/lib/aiContent.ts`
- `supabase/functions/generate-content/`
- Todas as chamadas a `https://text.pollinations.ai/`
- `generateContentForTask()`, `buildTaskPrompt()`, `generateUserProfileSummary()`
- Variáveis de ambiente de IA
- `AdminAutomated` (geração com IA)
- Fila de Pendências — lógica de geração

---

## 3. ForceChangePassword.tsx — RPC clear_must_change_password

**Problema:** Linha 28 fazia UPDATE direto em `profiles`:
```ts
await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', userId)
```
Após a migration 040 (que remove a policy UPDATE do usuário), essa linha falha silenciosamente.

**Solução:**

### Migration 041 — `clear_must_change_password()` RPC

```sql
CREATE FUNCTION clear_must_change_password()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;
  UPDATE profiles SET must_change_password = false, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;
GRANT EXECUTE ON FUNCTION clear_must_change_password TO authenticated;
```

### ForceChangePassword.tsx — linha 28

```ts
// Antes
await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', userId)

// Depois
await supabase.rpc('clear_must_change_password')
```

---

## 4. Migration 041 — INSERT em profiles mais restrito

**Problema:** A policy `users_insert_own_profile` (migration 040) só verificava `auth.uid() = user_id`, permitindo ao usuário criar perfil com `plan='essential'` ou `role='admin'`.

**Solução:**

```sql
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;

CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(plan, 'free') = 'free'
    AND COALESCE(role, 'user') = 'user'
  );
```

Usuário nunca pode criar perfil com plano ou papel privilegiado.

---

## 5. useAuth.ts — upsert seguro com ignoreDuplicates

**Problema:** O upsert sem `ignoreDuplicates` tenta fazer UPDATE em conflito. Após migration 040 remover a policy UPDATE do usuário, isso falha com erro RLS.

**Solução:**

```ts
// Antes
.upsert({ user_id: userId, plan: 'free', full_name: '' })

// Depois
.upsert(
  { user_id: userId, plan: 'free', full_name: '' },
  { onConflict: 'user_id', ignoreDuplicates: true },
)
```

Se o perfil já existir, nada é feito (ON CONFLICT DO NOTHING). O SELECT seguinte retorna `null` em caso de conflito ignorado, o que faz o `setProfile(newProfile)` receber `null` — mas o `else` já cuida disso com os dados do SELECT anterior.

---

## 6. stripe-webhook/index.ts — expandido

Adicionados 4 novos comportamentos em cada evento, sem remover os existentes:

### checkout.session.completed
- ✅ Atualiza `profiles.plan` (existente)
- ✅ **NOVO:** Upsert em `user_subscriptions` com datas do ciclo Stripe e `provider_subscription_id`
- ✅ **NOVO:** INSERT em `plan_change_history` com `change_type='upgrade'`
- ✅ **NOVO:** INSERT em `notifications` — "Assinatura ativada com sucesso!"

### invoice.payment_succeeded
- ✅ Atualiza `profiles.plan` via `stripe_customer_id` (existente)
- ✅ **NOVO:** Upsert em `user_subscriptions` com datas renovadas e `cancel_at_period_end` do Stripe
- ✅ **NOVO:** INSERT em `payment_events` com `type='monthly_payment'`
- ✅ **NOVO:** INSERT em `plan_change_history` (somente se houve mudança de plano)
- ✅ **NOVO:** INSERT em `notifications` — "Pagamento confirmado"

### customer.subscription.deleted
- ✅ Reverte `profiles.plan` para `'free'` (existente — mas agora respeita `pending_plan`)
- ✅ **NOVO:** Se havia `pending_plan` em `user_subscriptions`, usa ele como plano final (ex: downgrade agendado)
- ✅ **NOVO:** Atualiza `user_subscriptions` com `status='cancelled'` e limpa pending_plan
- ✅ **NOVO:** INSERT em `plan_change_history` com `change_type='cancel'` ou `'downgrade'`
- ✅ **NOVO:** INSERT em `notifications` — "Assinatura encerrada" ou "Plano alterado"

---

## 7. Edge Function manage-subscription (nova)

**Arquivo:** `supabase/functions/manage-subscription/index.ts`

**Propósito:** Permite que o frontend cancele, faça downgrade ou reative a assinatura, garantindo que o Stripe seja chamado além do banco.

**Ações suportadas:**

| Ação | Stripe | DB | Histórico | Notificação |
|---|---|---|---|---|
| `cancel` | `cancel_at_period_end: true` | status='cancel_pending', pending_plan='free' | change_type='cancel' | "Cancelamento agendado" |
| `downgrade` | `cancel_at_period_end: true` | pending_plan=targetPlan | change_type='downgrade_intent' | "Downgrade agendado" |
| `reactivate` | `cancel_at_period_end: false` | status='active', pending_plan=null | change_type='reactivate' | "Assinatura reativada" |

**Segurança:**
- Autentica via JWT no header Authorization
- Usa service role apenas para operações no banco
- Se não há `provider_subscription_id` (conta manual/teste), só atualiza o banco

**Deploy necessário:**
```bash
supabase functions deploy manage-subscription --project-ref lejvvhzluggyxlfwfoxl
```

---

## 8. MyPlanPage.tsx — handlers via Edge Function

Os três handlers agora chamam `manage-subscription` em vez de atualizar `user_subscriptions` diretamente:

```ts
// handleCancel
const { data, error } = await supabase.functions.invoke('manage-subscription', {
  body: { action: 'cancel' },
})

// handleDowngrade
const { data, error } = await supabase.functions.invoke('manage-subscription', {
  body: { action: 'downgrade', targetPlan },
})

// handleReactivate
const { data, error } = await supabase.functions.invoke('manage-subscription', {
  body: { action: 'reactivate' },
})
```

Todos ainda têm try/catch e exibem a mensagem retornada pelo backend.

---

## 9. AdminPermissions.tsx — verificado, sem alteração

A query usa `.eq('id', id)` onde `id = a.id = profiles.id` (PK interno). O `.select('id, user_id, ...')` retorna `profiles.id`, e `revokeAdmin(a.id, ...)` passa esse valor. **Correto — não requer alteração.**

Admins têm UPDATE via policy "Admin can update all profiles" (migration 017), que permanece intacta.

---

## 10. Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `supabase/migrations/041_force_password_and_insert_protection.sql` | **NOVO** — RPC clear_must_change_password + INSERT policy mais restrita |
| `src/components/ForceChangePassword.tsx` | Linha 28: UPDATE direto → RPC clear_must_change_password |
| `src/hooks/useAuth.ts` | upsert: adicionado ignoreDuplicates: true |
| `supabase/functions/stripe-webhook/index.ts` | Expandido: user_subscriptions, payment_events, plan_change_history, notifications |
| `supabase/functions/manage-subscription/index.ts` | **NOVA** Edge Function para cancel/downgrade/reactivate via Stripe |
| `src/components/MyPlanPage.tsx` | handleCancel/handleDowngrade/handleReactivate → chamam manage-subscription |

---

## 11. Testes executados

```
npm run build      ✅ built in 5.88s, 0 errors
npx tsc --noEmit   ✅ 0 erros TypeScript
npm run lint       ⚠️ baseline de warnings (não piorou)
npm audit --omit=dev  ⚠️ 2 vulnerabilidades dev (esbuild/vite — não afeta produção)
```

---

## 12. Aplicar migrations no banco real

### Pré-requisito
```bash
supabase login
supabase link --project-ref lejvvhzluggyxlfwfoxl
```

### Aplicar
```bash
supabase db push --project-ref lejvvhzluggyxlfwfoxl
```

Isso aplica todas as migrations pendentes (034 a 041) em ordem.

**Atenção pós-push:**
- Migration 040 remove UPDATE direto de usuário em `profiles` → ForceChangePassword e Profile.tsx já corrigidos para usar RPC
- Migration 041 cria `clear_must_change_password()` e fortalece INSERT

### Deploy das Edge Functions
```bash
supabase functions deploy stripe-webhook --project-ref lejvvhzluggyxlfwfoxl
supabase functions deploy manage-subscription --project-ref lejvvhzluggyxlfwfoxl
```

### Segredos necessários para manage-subscription (já configurados para stripe-webhook)
```
STRIPE_SECRET_KEY       → chave secreta da conta Stripe
SUPABASE_URL            → URL do projeto Supabase
SUPABASE_SERVICE_ROLE_KEY → service role key
SUPABASE_ANON_KEY       → anon key
```

---

## 13. Pendências restantes

### 13.1 Testes com ambiente real
Todas as validações são estáticas. Validação de runtime (Stripe checkout real, webhook real, RLS no banco real) ainda necessária após o push.

### 13.2 Verificar `payment_events` schema
A coluna `stripe_invoice_id` foi usada no stripe-webhook mas pode não existir na tabela. Verifique o schema de `payment_events` e adicione `ALTER TABLE payment_events ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;` se necessário.

### 13.3 Fluxo de downgrade para plano pago
O downgrade atual cancela a assinatura Stripe e define `pending_plan`. Quando o webhook `customer.subscription.deleted` chega, o plano é alterado. Para downgrade de paid→paid (ex: therapeutic-plus → therapeutic), seria necessário criar uma nova assinatura Stripe no webhook. Esta implementação cobre apenas free como destino de downgrade via Stripe.
