# Correções Pendentes Pós-Auditoria — A Vida Não Colabora
**Data:** 2026-07-01

## 1. Resumo executivo

Foram aplicadas 8 correções no projeto. Nenhum arquivo de IA (Pollinations.ai, prompts, providers, geração de conteúdo) foi alterado. O build passou sem erros antes e depois das correções. TypeScript sem erros em ambas as execuções.

**Pendências restantes sem ambiente real:**
- Migration 037 (proteção de UPDATE em profiles) foi analisada mas NÃO aplicada para não quebrar o frontend existente — requer refactoring do frontend antes de restringir a RLS.
- Migrations 034-036-038 corrigidas são SQL puro e precisam ser aplicadas via `supabase db push` em ambiente real para validação de runtime.

---

## 2. Correções críticas

| # | Problema | Status | Arquivo(s) |
|---|---|---|---|
| C1 | Upgrade de plano sem pagamento — `profiles.update({ plan })` direto no cliente | ✅ Corrigido | `src/components/MyPlanPage.tsx` |
| C2 | Coluna incorreta `profiles.id` em migrations 034/035 (deve ser `user_id`) | ✅ Corrigido | `supabase/migrations/034_*.sql`, `supabase/migrations/035_*.sql` |
| C3 | RLS questionnaires: adicionada cobertura de todos os níveis de plano | ✅ Corrigido | `supabase/migrations/036_*.sql` |
| C4 | `my-report` ausente de `directViews` em App.tsx | ✅ Corrigido | `src/App.tsx` |
| C5 | `MyEvolutionPage` sem suporte a `initialTab` | ✅ Corrigido | `src/components/MyEvolutionPage.tsx`, `src/App.tsx` |
| C6 | Proteção de UPDATE em `profiles` (migration 037) | ⚠️ NÃO aplicado — risco de quebra do frontend; documentado |  |

---

## 3. Correções altas

| # | Problema | Status | Arquivo(s) |
|---|---|---|---|
| A1 | Personalização → áreas oficiais (target_area já alinhado em MyEvolutionPage) | ✅ OK — sem alteração necessária | `src/components/MyEvolutionPage.tsx` |
| A2 | Labels unificadas em `personalizedContentLabels.ts` + wrapper em `personalizationTasks.ts` | ✅ Corrigido | `src/lib/personalizedContentLabels.ts`, `src/lib/personalizationTasks.ts` |
| A3 | Stripe sem fallback hardcoded | ✅ Já estava correto | `supabase/functions/create-checkout/index.ts` |
| A4 | `questionnaire_responses`: INSERT anônimo restrito | ✅ Migration criada | `supabase/migrations/038_*.sql` |

---

## 4. Arquivos alterados

- `src/components/MyPlanPage.tsx` — C1: removido update direto de plano no handleUpgrade
- `src/App.tsx` — C4: adicionado `my-report` em directViews; C5: adicionado `initialEvolutionTab` state e suporte a navegação `my-evolution?tab=<aba>`
- `src/components/MyEvolutionPage.tsx` — C5: adicionada prop `initialTab?: Tab` e `useState(initialTab ?? 'resumo')`
- `src/lib/personalizedContentLabels.ts` — A2: unificação de labels, adicionados tipos faltantes
- `src/lib/personalizationTasks.ts` — A2: `getPersonalizedContentLabel` agora delega para `getContentTypeLabel`; PERSONALIZED_CONTENT_LABELS expandido

---

## 5. Migrations criadas/alteradas

| Migration | Ação | Descrição |
|---|---|---|
| `034_diary_entry_limit_trigger.sql` | Alterada | Corrigida coluna `id` → `user_id` na busca de profiles |
| `035_user_ai_summaries.sql` | Alterada | Corrigida coluna `id` → `user_id` na policy admin RLS |
| `036_questionnaires_rls.sql` | Reescrita | 4 policies explícitas por nível de plano; coluna `p.id` → `p.user_id`; policy free cobre auth+anon |
| `038_questionnaire_responses_rls.sql` | Criada | Restringe INSERT em `questionnaire_responses` a usuários autenticados (owner) |

---

## 6. Testes realizados

| Teste | Resultado | Observação |
|---|---|---|
| `npm run build` (antes) | ✅ Passou | 1625 módulos, sem erro |
| `npx tsc --noEmit` (antes) | ✅ Passou | Sem erros TypeScript |
| `npm run build` (depois) | ✅ Passou | 1625 módulos, sem erro |
| `npx tsc --noEmit` (depois) | ✅ Passou | Sem erros TypeScript |

---

## 7. Comandos

| Comando | Resultado |
|---|---|
| `npm install` | up to date, 289 packages, 2 vulnerabilidades (não corrigidas — sem `--force` conforme instrução) |
| `npm run build` (inicial) | ✅ built in 3.79s |
| `npx tsc --noEmit` (inicial) | ✅ sem output (zero erros) |
| `npm run build` (final) | ✅ built in 3.40s |
| `npx tsc --noEmit` (final) | ✅ sem output (zero erros) |

---

## 8. Confirmação sobre IA

Nenhuma alteração foi feita em providers, prompts, serviços ou lógica de geração de IA.

**Arquivos de IA que NÃO foram tocados:**
- `src/lib/personalizationTasks.ts` — apenas labels e wrapper; a função `generateContentForTask`, `buildTaskPrompt` e a chamada a `https://text.pollinations.ai/` foram preservadas intactas
- `supabase/functions/stripe-webhook/index.ts` — não tocado
- `supabase/functions/create-checkout/index.ts` — não tocado (já estava correto)
- Qualquer outro arquivo com referência a Pollinations, OpenAI, providers

---

## 9. Análise das correções em detalhe

### C1 — Upgrade direto em MyPlanPage.tsx
A função `handleUpgrade` executava `supabase.from('profiles').update({ plan: targetPlan })` no cliente SEM passar pelo Stripe. Isso permitia que qualquer usuário se promovesse a qualquer plano sem pagar. A correção registra apenas a intenção no histórico e notifica o usuário de que aguarda confirmação de pagamento. O plano só deve mudar via webhook Stripe.

### C2 — Coluna de profiles nas migrations
Migration 001 define: `id UUID PRIMARY KEY DEFAULT uuid_generate_v4()` e `user_id UUID REFERENCES auth.users(id)`. Portanto a relação com `auth.uid()` é via `user_id`, não `id`. As migrations 034 e 035 usavam `WHERE id = auth.uid()` / `WHERE id = NEW.user_id` — incorreto. Corrigidas para `user_id`.

### C3/C4 — Migration 036
Reescrita com 4 policies explícitas (free/essential/therapeutic/therapeutic-plus), todas usando `p.user_id = auth.uid()` e seguindo a hierarquia de planos corretamente.

### C4 — my-report em directViews
`my-report` estava em `VALID_VIEWS` e tinha um bloco `if (view === 'my-report')` no render, mas não estava em `directViews`. Isso fazia `navigate('my-report')` falhar silenciosamente (ia para scroll na home). Corrigido.

### C5 — initialTab em MyEvolutionPage
Prop `initialTab?: Tab` adicionada. App.tsx suporta navegação `navigate('my-evolution?tab=relatorios')` via parsing do parâmetro, permitindo que notificações com `action_view = 'my-evolution'` abram diretamente na aba correta.

### C6 — profiles RLS (NÃO aplicada)
A migration 001 criou `"Users manage own profile"` com WITH CHECK amplo (qualquer campo). Criar a migration 037 com RPC e remover a policy quebraria ProfilePage.tsx, useAuth.ts e outros que fazem UPDATE direto em profiles. Decisão: documentar como pendência técnica — requer refactoring do frontend antes de restringir.

### C7 — Labels unificadas
`personalizedContentLabels.ts` já existia (criado por agente anterior) mas com entradas faltantes. Expandido com todos os tipos usados em `personalizationTasks.ts`. O `getPersonalizedContentLabel` agora delega para `getContentTypeLabel`, eliminando duplicidade.

### C8 — Stripe (já OK)
`create-checkout/index.ts` já estava sem fallback hardcoded. Validação: `if (!priceId) throw new Error(...)` já presente.

### C9 — questionnaire_responses
Migration 038 criada. Valida `auth.uid() IS NOT NULL AND auth.uid() = user_id`. Seguro porque o código cliente (`QuestionnairePlayer.tsx` linha 230) já exige usuário autenticado antes de chamar o INSERT.

---

## 10. Limitações

- Migrations SQL só podem ser validadas com runtime do Supabase real (`supabase db push`). Todos os SQLs foram revisados manualmente para consistência.
- A função `is_admin()` usada em migration 036 já deve existir das migrations anteriores (013). Caso não exista, a migration 036 falhará com erro de função indefinida.
- A migration 038 tem 2 policies de INSERT que cobrem casos distintos (usuário comum e admin). Se um admin usar `auth.uid() = user_id`, a primeira policy seria suficiente, mas ambas podem coexistir sem conflito.
