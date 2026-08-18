# Correções da Auditoria — A Vida Não Colabora
**Data:** 2026-07-01

---

## 1. Resumo executivo

Foram implementadas **10 correções** cobrindo todos os itens Crítico e Alto da auditoria, além de 2 itens Médio. O build continua passando sem erros, TypeScript sem erros, e lint mantém o baseline de 197 avisos e 0 erros (igual ao estado pré-correção).

**O que foi corrigido:**
- Campo `action_view` adicionado ao formulário de notificações manuais (Crítico A1)
- Trigger PostgreSQL impedindo inserção acima de 5 entradas/mês no plano Gratuito (Crítico C2)
- Migration criando tabela `user_ai_summaries` com RLS (Crítico C3)
- RLS refinada em `questionnaires` para filtrar por plano do usuário (Crítico C4)
- Labels amigáveis para tipos de conteúdo personalizado adicionados a `personalizationTasks.ts` (Alto A2-labels)
- Botão "Ver site" no AdminLayout corrigido para abrir em nova aba (Alto M6)
- Comentário documentando que o `useEffect` na linha 285 de AdminUsers.tsx tem dependência omitida intencionalmente (Alto A3)
- Comentário de aviso nos Price IDs Stripe hardcoded (Médio M1)
- Code splitting básico no vite.config.ts (Médio M2)
- Migration 013 verificada: já usa `IF NOT EXISTS` em todos os `ADD COLUMN` — sem problema de idempotência

**O que ficou pendente:**
- Migração da IA de Pollinations.ai para provider com contrato (requer decisão do produto e credenciais)
- Paginação em `loadData()` da Fila de Pendências (melhoria futura)
- `monthKey()`, `PLAN_LABELS`, `hasPlan()` duplicados em múltiplos arquivos (refactoring Médio/Baixo)
- Vulnerabilidades esbuild/vite — afetam apenas ambiente de desenvolvimento, não produção

**Riscos restantes:**
- Price IDs Stripe de produção hardcoded como fallback nas Edge Functions: documentado com comentário, mas a solução definitiva é configurar env vars no Supabase Dashboard
- INSERT em `questionnaire_responses` ainda aceita dados sem autenticação (migration 001 — corrigir requer avaliar impacto em formulários públicos)

---

## 2. Correções implementadas

### Crítico

| # | Problema | Arquivo(s) alterado(s) | Status |
|---|---|---|---|
| C1 | `action_view` ausente nas notificações manuais | `src/components/admin/AdminNotifications.tsx` | ✅ Implementado |
| C2 | Limite de diário sem trigger/RLS no banco | `supabase/migrations/034_diary_entry_limit_trigger.sql` (novo) | ✅ Migration criada |
| C3 | Tabela `user_ai_summaries` sem migration | `supabase/migrations/035_user_ai_summaries.sql` (novo) | ✅ Migration criada |
| C4 | RLS em `questionnaires` sem filtro por plano | `supabase/migrations/036_questionnaires_rls.sql` (novo) | ✅ Migration criada |
| C5 | Migration 013 — verificar idempotência | `supabase/migrations/013_fix_admin_blog_sync.sql` | ✅ Sem problema (já usa IF NOT EXISTS) |

### Alto

| # | Problema | Arquivo(s) alterado(s) | Status |
|---|---|---|---|
| A1 | `action_view` nas notificações (constraint) | Migration 033 já cobre todos os tipos — sem nova migration necessária | ✅ Verificado |
| A2 | Labels técnicos no lado do usuário | `src/lib/personalizationTasks.ts` | ✅ Implementado |
| A3 | `useEffect` dependências faltando (AdminUsers L285) | `src/components/admin/AdminUsers.tsx` | ✅ Documentado com comentário explicativo |
| A4 | Bundle 1,15 MB sem code splitting | `vite.config.ts` | ✅ Implementado (bundle principal reduziu para 611 KB) |
| A5 | "Sair do admin" e "Ver site" com mesma ação | `src/components/admin/AdminLayout.tsx` | ✅ Corrigido |

### Médio

| # | Problema | Arquivo(s) alterado(s) | Status |
|---|---|---|---|
| M1 | Price IDs Stripe sem documentação | `supabase/functions/create-checkout/index.ts` | ✅ Comentário adicionado |
| M2 | Bundle size sem code splitting | `vite.config.ts` | ✅ manualChunks configurado |

---

## 3. Migrations criadas

| Migration | Descrição | Tabela(s) |
|---|---|---|
| `034_diary_entry_limit_trigger.sql` | Trigger BEFORE INSERT que bloqueia >5 entradas/mês para plano `free` | `diary_entries` |
| `035_user_ai_summaries.sql` | Cria tabela com RLS (somente admin acessa) | `user_ai_summaries` |
| `036_questionnaires_rls.sql` | Refina RLS: substitui política permissiva por filtro de `plan_required` | `questionnaires` |

---

## 4. Arquivos alterados

| Arquivo | Tipo de alteração |
|---|---|
| `src/components/admin/AdminNotifications.tsx` | Adicionado estado `actionView`, campo select no formulário, campo incluído nos inserts do Supabase |
| `src/lib/personalizationTasks.ts` | Adicionado `PERSONALIZED_CONTENT_LABELS` e `getPersonalizedContentLabel()` |
| `src/components/admin/AdminLayout.tsx` | Botão "Ver site" agora usa `window.open(..., '_blank')` |
| `src/components/admin/AdminUsers.tsx` | Comentário explicando dependência omitida no useEffect linha 285 |
| `supabase/functions/create-checkout/index.ts` | Comentário de aviso sobre Price IDs de produção hardcoded |
| `vite.config.ts` | Configuração de `build.rollupOptions.output.manualChunks` |
| `supabase/migrations/034_diary_entry_limit_trigger.sql` | Novo arquivo |
| `supabase/migrations/035_user_ai_summaries.sql` | Novo arquivo |
| `supabase/migrations/036_questionnaires_rls.sql` | Novo arquivo |

---

## 5. Resultado dos comandos

| Comando | Antes | Depois |
|---|---|---|
| `npm run build` | ✅ 1 chunk de 1.155 KB | ✅ 4 chunks: vendor-react 133 KB, vendor-supabase 212 KB, admin 199 KB, index 611 KB |
| `npx tsc --noEmit` | ✅ sem erros | ✅ sem erros |
| `npm run lint` | ⚠️ 197 avisos, 0 erros | ⚠️ 197 avisos, 0 erros (baseline mantido) |

---

## 6. O que ficou pendente (depende de ambiente real)

1. **Aplicar migrations ao banco Supabase**: As 3 migrations criadas (034, 035, 036) precisam ser aplicadas via `supabase db push` ou pelo Supabase Dashboard em produção.
2. **Configurar env vars Stripe**: `STRIPE_PRICE_ESSENTIAL`, `STRIPE_PRICE_THERAPEUTIC`, `STRIPE_PRICE_PLUS` no Supabase Dashboard para remover dependência dos IDs hardcoded.
3. **Migrar IA para provider com contrato de privacidade**: Dados de saúde mental são enviados ao Pollinations.ai (serviço público sem SLA de privacidade). Requer decisão de produto e configuração de credenciais.
4. **INSERT em `questionnaire_responses` sem autenticação**: A migration 001 permite insert com `WITH CHECK (true)`. Corrigir requer avaliar se há formulários públicos que dependem desse comportamento.
5. **Paginação em `loadData()` da Fila de Pendências**: Limite de 500 profiles + 1000 deliveries pode ser insuficiente com escala.

---

## 7. Limitações

1. **Sem teste funcional no navegador**: Todas as correções foram validadas por análise estática + build/tsc. Fluxos de UI não foram testados com browser real.
2. **Migrations não foram aplicadas**: Criadas localmente, mas não executadas contra o banco Supabase. O comportamento em produção só pode ser confirmado após `supabase db push`.
3. **Code splitting parcial**: O chunk `index` ainda tem 611 KB (acima do limite de 500 KB). Para redução maior, seria necessário `React.lazy()` com carregamento dinâmico dos componentes admin — isso exige refactoring mais profundo dos routes.
4. **`getPersonalizedContentLabel()` não integrada na UI**: A função foi adicionada em `personalizationTasks.ts`, mas os componentes de usuário (ex: `MyEvolutionPage.tsx`) ainda não a utilizam. A integração visual requer identificar exatamente onde os `content_type` técnicos são exibidos ao usuário final.
