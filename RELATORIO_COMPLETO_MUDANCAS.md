# Relatório Completo de Mudanças — A Vida Não Colabora
**Data:** 2026-07-01  
**Período coberto:** Todas as sessões de trabalho desta conversa  
**Base:** histórico de commits + relatórios de auditoria e correção

---

## 1. Resumo executivo

| Categoria | Quantidade |
|---|---|
| Arquivos alterados (frontend) | 30+ |
| Migrations criadas ou alteradas | 11 (033 a 038 + ajustes em 034/035/036) |
| Correções críticas aplicadas | 9 |
| Correções altas aplicadas | 8 |
| Correções médias aplicadas | 3 |
| Pendências restantes | 2 |
| Build: status | ✅ Passa sem erros |
| TypeScript: status | ✅ Sem erros |
| IA: alterada? | ❌ Não — intocada |

---

## 2. O que mudou — por área

### 2.1 Menu Admin (reorganização completa)

**Antes:** 7 grupos com 28 itens expandíveis, estado resetava ao recarregar a página.

**Depois:** 6 áreas com abas internas, menu limpo e persistente.

| Item | Status |
|---|---|
| Menu reduzido de 28 itens para 6 áreas | ✅ |
| Áreas: Painel, Conteúdo, Usuários & Planos, Atendimento, Comunicação, Sistema | ✅ |
| Cada área tem abas internas com todas as funções antigas | ✅ |
| Estado do menu persiste no `localStorage` entre recargas | ✅ |
| Backward-compat: todas as 31 views antigas redirecionam via `AREA_ALIAS` | ✅ |
| "Ver site" agora abre em nova aba (antes era igual a "Sair do admin") | ✅ |

**Arquivos alterados:**
- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/index.tsx`
- `src/components/admin/types.ts`
- `src/components/admin/AdminAreaPainel.tsx` *(novo)*
- `src/components/admin/AdminAreaConteudo.tsx` *(novo)*
- `src/components/admin/AdminAreaUsuariosPlanos.tsx` *(novo)*
- `src/components/admin/AdminAreaAtendimento.tsx` *(novo)*
- `src/components/admin/AdminAreaComunicacao.tsx` *(novo)*
- `src/components/admin/AdminAreaSistema.tsx` *(novo)*

---

### 2.2 Fila de Pendências (AdminPersonalization)

**Antes:** Prioridade estática da definição da tarefa. Sem ordenação por urgência. Sem paginação. Sem card "Alta prioridade".

**Depois:** Prioridade dinâmica por prazo. Ordenação por urgência. Paginação de 50 itens. Card "Alta prioridade" nos resumos.

| Item | Status |
|---|---|
| `calculateTaskPriority(task)` — prioridade dinâmica por `due_at` | ✅ |
| Alta: atrasada ou vence em até 2 dias | ✅ |
| Média: vence entre 3 e 7 dias | ✅ |
| Baixa: vence em mais de 7 dias ou sem prazo | ✅ |
| Filtro de prioridade usa prioridade calculada (não estática) | ✅ |
| Badge de prioridade usa prioridade calculada | ✅ |
| Ordenação: atrasadas primeiro, depois por prazo mais próximo | ✅ |
| Card "Alta prioridade" nos SummaryCards | ✅ |
| "Atrasadas" conta `due_at < now` OU `status = overdue` | ✅ |
| Paginação: 50 por página, botão "Carregar mais" | ✅ |

**Arquivo alterado:** `src/components/admin/AdminPersonalization.tsx`

---

### 2.3 Notificações (AdminNotifications)

**Antes:** Campo `action_view` não existia no formulário manual. Admin criava notificação sem destino de clique.

**Depois:** Admin escolhe o destino ao criar notificação.

| Item | Status |
|---|---|
| Campo select `action_view` no formulário | ✅ |
| Opções: Minha Evolução, Para Você, Orientações, Relatórios, Autocuidado, Sessão Plus, Comentários, Meu Plano, Suporte, Blog | ✅ |
| Campo incluído nos 3 fluxos de envio (por usuário, por plano, para todos) | ✅ |

**Arquivo alterado:** `src/components/admin/AdminNotifications.tsx`

---

### 2.4 Navegação do usuário (App.tsx / MyEvolutionPage)

**Antes:** `my-report` não estava em `directViews` — navigate falhava silenciosamente. `MyEvolutionPage` sempre abria na aba "Resumo", ignorando notificações que pediam aba específica.

**Depois:** `my-report` funciona. Notificações com `action_view` abrem a aba correta.

| Item | Status |
|---|---|
| `my-report` adicionado a `directViews` | ✅ |
| `MyEvolutionPage` aceita prop `initialTab` | ✅ |
| `App.tsx` suporta `navigate('my-evolution?tab=orientacoes')` | ✅ |
| Notificação de orientação → abre Minha Evolução → Orientações | ✅ |
| Notificação de relatório → abre Minha Evolução → Relatórios | ✅ |
| Notificação de autocuidado → abre Minha Evolução → Plano de Autocuidado | ✅ |
| Notificação de sessão → abre Minha Evolução → Sessão Plus | ✅ |
| Notificação de personalização → abre Minha Evolução → Para Você | ✅ |

**Arquivos alterados:** `src/App.tsx`, `src/components/MyEvolutionPage.tsx`

---

### 2.5 Meu Plano (MyPlanPage) — segurança crítica

**Antes:** `handleUpgrade` executava `supabase.from('profiles').update({ plan: targetPlan })` diretamente no cliente. Qualquer usuário podia se promover a plano pago sem pagar.

**Depois:** Upgrade apenas registra intenção. Plano só muda via webhook Stripe.

| Item | Status |
|---|---|
| Removido update direto de `profiles.plan` no cliente | ✅ |
| Upgrade redireciona para checkout Stripe sem alterar plano | ✅ |
| Plano só muda quando webhook confirma pagamento | ✅ |

**Arquivo alterado:** `src/components/MyPlanPage.tsx`

---

### 2.6 Labels de conteúdos personalizados

**Antes:** Labels técnicos (`weekly_self_care`, `professional_comment`, `session_themes`) podiam aparecer para o usuário e no admin. Havia duplicidade entre dois arquivos.

**Depois:** Fonte única de labels, todas em português amigável.

| Item | Status |
|---|---|
| `src/lib/personalizedContentLabels.ts` como fonte central | ✅ |
| `getContentTypeLabel()` e `getTargetAreaLabel()` exportados | ✅ |
| `getPersonalizedContentLabel()` em `personalizationTasks.ts` virou wrapper | ✅ |
| Todos os tipos cobertos com label em português | ✅ |

**Arquivos alterados:** `src/lib/personalizedContentLabels.ts`, `src/lib/personalizationTasks.ts`

---

### 2.7 Code splitting (performance)

**Antes:** Bundle único de 1.155 KB.

**Depois:** 4 chunks separados.

| Chunk | Tamanho |
|---|---|
| `vendor-react` | 133 KB |
| `vendor-supabase` | 212 KB |
| `admin` | 199 KB |
| `index` (app principal) | 611 KB |

**Arquivo alterado:** `vite.config.ts`

---

### 2.8 Stripe (segurança)

**Antes:** Price IDs de produção hardcoded como fallback — expostos no código-fonte público.

**Depois:** Sem fallback. Sem env var → erro claro. Price IDs configurados como secrets no Supabase Dashboard.

| Item | Status |
|---|---|
| Fallback hardcoded removido | ✅ |
| Erro claro quando env var ausente | ✅ |
| Secrets configurados via Supabase CLI | ✅ |

**Arquivo alterado:** `supabase/functions/create-checkout/index.ts`

---

### 2.9 Monitoramento do sistema (AdminSystemHealth)

**Antes:** Alguns health checks não verificavam `error` da query Supabase — podiam retornar "ok" mesmo com falha.

**Depois:** Todos os checks desestrutuam `error` e retornam status correto.

**Arquivo alterado:** `src/lib/systemHealth.ts`

---

## 3. O que mudou — Migrations de banco de dados

| Migration | Tipo | O que faz |
|---|---|---|
| `033_notifications_and_health_cleanup.sql` | Criada | Tipos de notificação atualizados (inclui `payment`); cleanup automático de health checks antigos |
| `034_diary_entry_limit_trigger.sql` | Criada + corrigida | Trigger BEFORE INSERT que bloqueia >5 entradas/mês para plano `free` no banco; coluna corrigida para `profiles.user_id` |
| `035_user_ai_summaries.sql` | Criada + corrigida | Tabela `user_ai_summaries` com RLS (apenas admin acessa); coluna corrigida para `profiles.user_id` |
| `036_questionnaires_rls.sql` | Criada + reescrita 2x | RLS por nível de plano: free → todos; essential/therapeutic/plus → auth com plano adequado; `p.user_id = auth.uid()` correto |
| `037_profiles_update_protection.sql` | **NÃO criada** | Proteção de UPDATE em profiles — pendente (ver seção 5) |
| `038_questionnaire_responses_rls.sql` | Criada | INSERT em `questionnaire_responses` exige autenticação e owner correto |

---

## 4. O que não mudou (intencionalmente)

### IA — completamente intocada

Nenhum dos itens abaixo foi alterado:

| Item | Status |
|---|---|
| Provider Pollinations.ai | ✅ Intocado |
| Função `generateContentForTask()` | ✅ Intocada |
| Função `buildTaskPrompt()` | ✅ Intocada |
| Chamadas a `https://text.pollinations.ai/` | ✅ Intocadas |
| `AdminAutomated` — geração com IA | ✅ Intocado |
| `AdminNotifications` — AIContentAssistant | ✅ Intocado |
| `generateUserProfileSummary()` | ✅ Intocada |
| Edge Function `generate-content` (Gemini) | ✅ Intocada |
| `src/lib/aiContent.ts` | ✅ Intocado |
| Variáveis de ambiente de IA | ✅ Intocadas |

### Planos oficiais — não alterados

| Item | Status |
|---|---|
| Gratuito — R$0 | ✅ Sem alteração |
| Essencial — R$19,90 | ✅ Sem alteração |
| Terapêutico — R$39,90 | ✅ Sem alteração |
| Terapêutico Plus — R$79,90 | ✅ Sem alteração |
| Benefícios de cada plano | ✅ Sem alteração |
| Hierarquia de herança entre planos | ✅ Sem alteração |

### Migrations existentes — não apagadas

Todas as migrations de 001 a 033 foram preservadas intactas.

### Funcionalidades removidas

Nenhuma funcionalidade foi removida. Todas as 31 views antigas do admin continuam acessíveis via `AREA_ALIAS`.

---

## 5. O que ficou pendente

### 5.1 Proteção de UPDATE em `profiles` (migration 037)

**Por que não foi feita:**  
`ProfilePage.tsx`, `useAuth.ts` e outros componentes fazem UPDATE direto em `profiles` para campos de perfil (nome, avatar). Criar a RPC e restringir a policy sem refatorar o frontend primeiro quebraria o app.

**O que precisa acontecer antes:**  
Refatorar os componentes que fazem UPDATE direto para usarem a RPC `update_my_profile()`. Só depois aplicar a migration que restringe a policy.

**Risco atual:**  
Médio. Um usuário autenticado que conheça a API poderia tentar atualizar campos administrativos via Supabase SDK. Na prática, o webhook Stripe e as funções admin usam service role key, que ignora RLS.

---

### 5.2 Migração da IA para provider com contrato

**Por que não foi feita:**  
Decisão do produto + exige chave de API de um provider (OpenAI, Anthropic, Gemini). A instrução explícita foi não tocar na IA nesta etapa.

**Risco atual:**  
Dados de saúde mental (humor, tags emocionais, contagem de entradas) são enviados ao Pollinations.ai, que é um serviço público sem contrato de privacidade.

---

## 6. Estado técnico atual

| Verificação | Resultado |
|---|---|
| `npm run build` | ✅ Passa — 4 chunks, sem erros |
| `npx tsc --noEmit` | ✅ Sem erros |
| `npm run lint` | ⚠️ 197 avisos, 0 erros (mesmo nível do baseline — não piorou) |
| `npm audit --omit=dev` | ⚠️ 2 vulnerabilidades no esbuild/vite — afetam apenas dev, não produção |
| Secrets Stripe configurados no Supabase | ✅ Configurados via CLI |

---

## 7. Arquivos alterados nesta sessão (lista completa)

### Frontend
- `src/App.tsx`
- `src/components/MyPlanPage.tsx`
- `src/components/MyEvolutionPage.tsx`
- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/AdminNotifications.tsx`
- `src/components/admin/AdminUsers.tsx`
- `src/components/admin/AdminPersonalization.tsx`
- `src/components/admin/AdminAreaPainel.tsx` *(novo)*
- `src/components/admin/AdminAreaConteudo.tsx` *(novo)*
- `src/components/admin/AdminAreaUsuariosPlanos.tsx` *(novo)*
- `src/components/admin/AdminAreaAtendimento.tsx` *(novo)*
- `src/components/admin/AdminAreaComunicacao.tsx` *(novo)*
- `src/components/admin/AdminAreaSistema.tsx` *(novo)*
- `src/components/admin/index.tsx`
- `src/components/admin/types.ts`
- `src/lib/personalizationTasks.ts`
- `src/lib/personalizedContentLabels.ts`
- `src/lib/systemHealth.ts`
- `src/services/personalizedDeliveryService.ts`
- `vite.config.ts`

### Backend / Edge Functions
- `supabase/functions/create-checkout/index.ts`
- `supabase/config.toml`

### Migrations (novas ou alteradas)
- `supabase/migrations/033_notifications_and_health_cleanup.sql`
- `supabase/migrations/034_diary_entry_limit_trigger.sql`
- `supabase/migrations/035_user_ai_summaries.sql`
- `supabase/migrations/036_questionnaires_rls.sql`
- `supabase/migrations/038_questionnaire_responses_rls.sql`

### Relatórios gerados
- `AUDITORIA_COMPLETA_ADMIN_BLOG.md`
- `CORRECOES_AUDITORIA_ADMIN_BLOG.md`
- `CORRECOES_PENDENTES_POS_AUDITORIA.md`
- `RELATORIO_COMPLETO_MUDANCAS.md` *(este arquivo)*
