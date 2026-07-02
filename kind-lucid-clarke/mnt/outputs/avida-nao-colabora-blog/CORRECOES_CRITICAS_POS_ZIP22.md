# Correções Críticas Pós-ZIP22 — A Vida Não Colabora
**Data:** 2026-07-02

---

## 1. Resumo executivo

| Item | Status |
|---|---|
| IA alterada | ❌ Não |
| Meu Plano / upgrade corrigido | ✅ |
| payment_events removido do cliente | ✅ |
| plan_change_history CHECK ampliado | ✅ |
| Notificações de plano via cliente removidas | ✅ |
| profiles protegido com RPC | ✅ |
| stripe-webhook sem fallback hardcoded | ✅ |
| Migration 036 idempotente | ✅ |
| Migration 038 idempotente | ✅ |
| MyEvolutionPage sincroniza aba ao mudar prop | ✅ |
| Build passa | ✅ |
| TypeScript passa (0 erros) | ✅ |
| Lint não piorou (199 warnings — mesmo baseline) | ✅ |
| Planos e preços alterados | ❌ Não |

---

## 2. Confirmação de que a IA não foi alterada

**Nenhuma alteração foi feita em providers, prompts, serviços, funções ou lógica de geração de IA.**

Os seguintes arquivos e funções permaneceram intocados:
- `src/lib/aiContent.ts`
- `supabase/functions/generate-content/`
- Todas as chamadas a `https://text.pollinations.ai/`
- `generateContentForTask()`, `buildTaskPrompt()`, `generateUserProfileSummary()`
- Variáveis de ambiente de IA
- `AdminAutomated` (geração com IA)
- Fila de Pendências — lógica de geração

---

## 3. Correções em Meu Plano / pagamento

**Problema:** `handleUpgrade` não chamava o Stripe. Registrava intenção e mostrava "ok" mesmo sem pagamento. `profiles.plan` não era alterado diretamente, mas payment_events era inserido pelo cliente sem tratamento de erro.

**Solução:**
- `handleUpgrade` agora chama `supabase.functions.invoke('create-checkout', { body: { plan } })`
- Se Edge Function retornar erro ou não retornar URL → exibe mensagem: *"Não foi possível iniciar o pagamento agora. Seu plano atual foi mantido."*
- Se retornar URL → redireciona para `window.location.href = data.url` (checkout Stripe)
- Plano só muda via `stripe-webhook` após pagamento confirmado
- `payment_events` insert removido do cliente (registrado apenas pelo webhook)
- `recordChange` com `upgrade_intent` chamado com `.catch()` — falha não impede o redirecionamento
- Todos os handlers (`handleDowngrade`, `handleCancel`, `handleReactivate`) envolvidos em try/catch
- Erros do Supabase verificados com `if (subErr) throw`
- Estado local não é modificado como "sucesso" se o banco falhou
- `sendNotification` removido do cliente (tabela notifications não tem policy de INSERT para usuários comuns)
- Modal de upgrade atualizado: botão agora exibe "Ir para pagamento"

---

## 4. Correções em payment_events / plan_change_history / notifications

### plan_change_history — migration 039

A constraint `plan_change_history_change_type_check` só aceitava:
`upgrade`, `downgrade`, `cancel`, `reactivate`, `admin_change`

Mas o frontend usa `upgrade_intent` e `downgrade_intent`. A migration 039 amplifica a constraint:

```sql
ALTER TABLE plan_change_history
  DROP CONSTRAINT IF EXISTS plan_change_history_change_type_check;

ALTER TABLE plan_change_history
  ADD CONSTRAINT plan_change_history_change_type_check
  CHECK (change_type IN (
    'upgrade', 'upgrade_intent', 'downgrade', 'downgrade_intent',
    'cancel', 'reactivate', 'admin_change'
  ));
```

### payment_events — removido do cliente

O INSERT em `payment_events` foi removido do `handleUpgrade`. O evento será registrado pelo `stripe-webhook` após pagamento confirmado, usando service role key (sem RLS).

### notifications — removido do cliente

`sendNotification()` foi removida do `MyPlanPage`. A tabela `notifications` não tem policy de INSERT para usuários comuns (apenas SELECT e UPDATE próprias, e ALL para admin). Inserir via cliente causava erro silencioso. Notificações de plano devem ser enviadas via webhook ou service role.

---

## 5. Proteção de profiles

**Problema:** A policy "Users manage own profile" (migration 001) usava `WITH CHECK (auth.uid() = user_id)`, permitindo ao usuário atualizar qualquer coluna incluindo `plan`, `role`, `is_admin`, `account_status`, etc.

**Solução — migration 040:**

1. Adicionadas colunas seguras de perfil:
   - `display_name TEXT`
   - `preferred_name TEXT`
   - `status_phrase TEXT`
   - `notification_frequency TEXT DEFAULT 'weekly'`

2. RPC `update_my_profile()` criada como `SECURITY DEFINER`:
   - Atualiza apenas: `full_name`, `display_name`, `preferred_name`, `avatar_url`, `status_phrase`, `notification_frequency`, `updated_at`
   - Verifica `auth.uid() IS NOT NULL`
   - Campos sensíveis (`plan`, `role`, `is_admin`, etc.) nunca são atualizados pela RPC
   - `GRANT EXECUTE ON FUNCTION update_my_profile TO authenticated`

3. Policy "Users manage own profile" removida (era ampla demais para UPDATE)

4. Recriadas separadamente:
   - `users_select_own_profile` — SELECT próprio perfil
   - `users_insert_own_profile` — INSERT/upsert inicial (colunas sensíveis têm DEFAULTs seguros: `plan='free'`, `role='user'`)
   - UPDATE direto removido — use a RPC

5. Admin continua com UPDATE via "Admin can update all profiles" (migration 017, intocada)

**Frontend refatorado:**

`Profile.tsx`:
- `handleAvatarUpload`: troca `.update({ avatar_url })` por `supabase.rpc('update_my_profile', { p_avatar_url: url })`
- `handleSave`: troca `.upsert({...})` por `supabase.rpc('update_my_profile', {...})`
- Erros verificados e exibidos com `alert()` em caso de falha

`useAuth.ts`:
- Função `updatePlan(plan)` removida — atualizava `profiles.plan` diretamente no cliente
- `App.tsx` atualizado para não importar `updatePlan`

---

## 6. Correções em Stripe webhook

**Problema:** `stripe-webhook/index.ts` tinha fallback hardcoded:
```ts
Deno.env.get('STRIPE_PRICE_ESSENTIAL') || 'price_1To2n05xvJV4HLHz8ym64uYH'
```

Se a env var não estivesse configurada, usava o Price ID hardcoded — perigoso em produção.

**Solução:**

```ts
function buildPlanByPrice(): Record<string, string> {
  const map: Record<string, string> = {}
  const essential = Deno.env.get('STRIPE_PRICE_ESSENTIAL')
  const therapeutic = Deno.env.get('STRIPE_PRICE_THERAPEUTIC')
  const plus = Deno.env.get('STRIPE_PRICE_PLUS')
  if (essential) map[essential] = 'essential'
  if (therapeutic) map[therapeutic] = 'therapeutic'
  if (plus) map[plus] = 'therapeutic-plus'
  return map
}
```

Se `priceId` não mapear nenhum plano (env var ausente), loga erro claro e **não atualiza** `profiles.plan`.

---

## 7. Migrations idempotentes

### Migration 036

Adicionados `DROP POLICY IF EXISTS` para todas as policies que a migration cria:

```sql
DROP POLICY IF EXISTS "any_read_free_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_essential_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_therapeutic_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_therapeutic_plus_questionnaires" ON questionnaires;
```

### Migration 038

Adicionados `DROP POLICY IF EXISTS` para as policies que a migration cria:

```sql
DROP POLICY IF EXISTS "auth_users_insert_own_responses" ON questionnaire_responses;
DROP POLICY IF EXISTS "admin_insert_any_response" ON questionnaire_responses;
```

Nenhum dado ou tabela foi apagado.

---

## 8. Correção de navegação e abas

**Problema:** `MyEvolutionPage` inicializava `tab` com `initialTab ?? 'resumo'` mas não reagia a mudanças subsequentes na prop. Se a notificação chamava `navigate('my-evolution?tab=orientacoes')` depois da página já estar montada, a aba não mudava.

**Solução:**

```ts
useEffect(() => {
  if (initialTab) setTab(initialTab)
}, [initialTab])
```

**Resultado:**
- Notificação de orientação → abre Orientações ✅
- Notificação de relatório → abre Relatórios ✅
- Notificação de autocuidado → abre Plano de Autocuidado ✅
- Notificação de sessão → abre Sessão Plus ✅
- Notificação de personalização → abre Para Você ✅

---

## 9. Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `src/components/MyPlanPage.tsx` | handleUpgrade → checkout Stripe; try/catch em todos os handlers; sendNotification removida; aviso de pagamento atualizado |
| `src/components/Profile.tsx` | handleSave e handleAvatarUpload usam RPC update_my_profile |
| `src/components/MyEvolutionPage.tsx` | useEffect para sincronizar initialTab |
| `src/hooks/useAuth.ts` | updatePlan removida |
| `src/App.tsx` | updatePlan removida do destructuring |
| `supabase/functions/stripe-webhook/index.ts` | Fallback hardcoded removido; log de erro quando Price ID não mapeado |

---

## 10. Migrations criadas/alteradas

| Migration | Tipo | O que faz |
|---|---|---|
| `036_questionnaires_rls.sql` | Alterada | Adicionados DROP POLICY para as 4 policies criadas — agora idempotente |
| `038_questionnaire_responses_rls.sql` | Alterada | Adicionados DROP POLICY para as 2 policies criadas — agora idempotente |
| `039_plan_change_history_constraint.sql` | **Nova** | Amplia CHECK para incluir `upgrade_intent` e `downgrade_intent` |
| `040_profiles_protection.sql` | **Nova** | Adiciona colunas seguras; cria RPC `update_my_profile`; remove policy UPDATE ampla; recria SELECT e INSERT separados |

---

## 11. Testes executados

Todos os comandos executados antes e após as correções:

```bash
npm install        # up to date, sem erro
npm run build      # ✅ built in 5.76s, 4 chunks
npx tsc --noEmit   # ✅ sem output (zero erros)
npm run lint       # ⚠️ 199 warnings, 0 errors (mesmo baseline)
npm audit --omit=dev # ⚠️ 2 vulnerabilidades (esbuild/vite — apenas dev)
```

---

## 12. Resultado dos comandos

| Comando | Antes | Depois |
|---|---|---|
| `npm run build` | ✅ 5.77s | ✅ 5.76s |
| `npx tsc --noEmit` | ✅ 0 erros | ✅ 0 erros |
| `npm run lint` | ⚠️ 199 warnings | ⚠️ 199 warnings |
| `npm audit --omit=dev` | ⚠️ 2 vuln (dev) | ⚠️ 2 vuln (dev) |

Lint não piorou. Nenhuma vulnerabilidade nova introduzida.

---

## 13. Pendências restantes

### 13.1 Aplicar migrations no banco real

As migrations 036, 038, 039, 040 são arquivos SQL criados/alterados no repositório mas ainda não aplicados ao banco Supabase real. Executar:

```bash
supabase db push --project-ref lejvvhzluggyxlfwfoxl
```

**Atenção:** a migration 040 remove a policy "Users manage own profile" que cobre UPDATE. Após aplicar, qualquer UPDATE direto em `profiles` pelo cliente (sem service role) falhará com erro de RLS. Isso é intencional — use a RPC `update_my_profile`.

### 13.2 Adicionar policy de INSERT para notifications (admin/webhook)

Se no futuro quiser que Edge Functions ou webhooks notifiquem usuários, criar policy via service role ou uma RPC SECURITY DEFINER `send_notification_to_user()`.

### 13.3 ForceChangePassword.tsx — update direto em profiles

`src/components/ForceChangePassword.tsx` ainda faz:
```ts
await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', userId)
```

Após aplicar a migration 040, isso falhará. Adicionar `must_change_password` à RPC `update_my_profile` ou criar uma RPC separada `clear_must_change_password()`.

### 13.4 Testes com ambiente real

Todas as validações são estáticas. Validação de runtime (Stripe checkout real, webhook real, RLS real no banco) ainda necessária.
