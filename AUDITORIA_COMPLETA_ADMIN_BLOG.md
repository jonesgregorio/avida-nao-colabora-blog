# AUDITORIA COMPLETA — A Vida Não Colabora
**Data:** 2026-07-01  
**Auditor:** Análise estática automatizada + execução de comandos  
**Versão do código:** zip `avida-nao-colabora-blog-main (20).zip` / branch `main`  
**Pasta analisada:** `kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/`

---

## 1. Resumo executivo

O projeto é um blog/app React + Vite + TypeScript + Supabase com área admin bem estruturada, 33 migrations e integração Stripe real. O **build passa sem erros** e o **TypeScript não reporta erros**. Os pontos críticos são:

1. **Segurança de pagamento**: Price IDs do Stripe estão hardcoded no código como fallback — se env vars não estiverem configuradas, IDs de produção ficam expostos no bundle público.
2. **Notificações sem `action_view`** na maior parte dos envios manuais: o admin não configura `action_view` ao criar notificações manualmente, então o botão de ação não funciona para o usuário.
3. **IA da Fila de Pendências usa Pollinations.ai** (serviço público gratuito, sem autenticação) — dados parciais do usuário são enviados, sem contrato de privacidade.
4. **AdminAutomated usa Pollinations.ai diretamente no cliente** — a chave não existe (o serviço é aberto), mas a função `generate-content` usa Gemini com `GEMINI_API_KEY` não configurada como obrigatória.
5. **RLS bem implementada** nas tabelas críticas: `diary_entries`, `profiles`, `personalized_content_deliveries`, `notifications`.
6. **197 avisos de lint** (nenhum erro), bundle de 1,15 MB (acima do recomendado de 500 KB).

---

## 2. Resultado dos comandos

### `npm install`
✅ Sem erros. 289 pacotes, up to date.

### `npm run build`
✅ **Build passou.** 1625 módulos transformados em 6,49s.  
⚠️ Aviso: bundle `index-DIeQgF3P.js` com 1.155,69 KB (278 KB gzip) — acima do limite de 500 KB. Causa: não há code splitting. Todos os componentes admin e usuário estão no mesmo chunk.

### `npx tsc --noEmit`
✅ **Sem erros de TypeScript.** (saída vazia = sem erros)

### `npm run lint`
⚠️ **197 avisos, 0 erros.** O ESLint foi configurado com `max-warnings: 0`, portanto o comando retorna exit code 1, mas não há nenhum *erro* real. Principais avisos:
- `@typescript-eslint/no-explicit-any`: múltiplos arquivos (AdminUsers.tsx, personalizationTasks.ts, systemHealth.ts, funções Stripe)
- `react-hooks/exhaustive-deps`: AdminUsers.tsx linha 285 (useEffect com dependências faltando)

### `npm audit --omit=dev`
⚠️ **2 vulnerabilidades (1 moderada, 1 alta):**
- `esbuild <= 0.24.2` — permite que qualquer site envie requisições ao servidor de desenvolvimento e leia a resposta (GHSA-67mh-4wv8-2f99). **Afeta apenas o servidor de dev, não produção.**
- `vite <= 6.4.2` — depende da versão vulnerável do esbuild.
- Correção: `npm audit fix --force` (atualiza para vite@8, mudança major).

---

## 3. Admin — por área e função

### 3.1 Menu e estrutura
✅ As 6 áreas existem e estão implementadas em `AdminLayout.tsx` e `index.tsx`:
- **Painel** → `AdminAreaPainel` (3 abas: Visão Geral, Métricas, Saúde do Sistema)
- **Conteúdo** → `AdminAreaConteudo` (7 abas: Artigos, Categorias, Imagens, Questionários, Trilhas, SEO, Home e Depoimentos)
- **Usuários & Planos** → `AdminAreaUsuariosPlanos` (abas: Usuários, Planos, Financeiro, Relatórios, Permissões, Diário, Itens Salvos)
- **Atendimento** → `AdminAreaAtendimento` (7 abas: Fila de Pendências, Suporte, Orientações, Sessões Plus, Comentários Profissionais, Planos de Autocuidado, Equipe Profissional)
- **Comunicação** → `AdminAreaComunicacao` (notificações + automação)
- **Sistema** → `AdminAreaSistema` (saúde, logs)

✅ Sistema de aliases (`AREA_ALIAS`) garante backward-compat com URLs e localStorage antigos.  
✅ Menu lateral responsivo (desktop sidebar + mobile overlay).  
⚠️ "Sair do admin" e "Ver site" executam a mesma ação (`onExit → window.location.href = pathname`). Não há diferença funcional entre os dois botões — ambos apenas recarregam a URL sem o parâmetro `?view=admin`.

### 3.2 Fila de Pendências (AdminPersonalization)
✅ **Prioridade dinâmica implementada**: `calculateTaskPriority(task)` em `personalizationTasks.ts` calcula prioridade em tempo de execução com base em status e prazo.  
✅ **Filtros completos**: busca por nome/email, plano, tipo de tarefa, prioridade, prazo.  
✅ **Geração de IA existe**: `generateContentForTask()` via Pollinations.ai (ver seção 7 — IA).  
✅ **Fluxo rascunho → revisão → envio**: conteúdo gerado salva como `draft` antes de qualquer envio. Admin deve aprovar/editar explicitamente.  
✅ **Geração em massa** com progresso por item, sem envio automático.  
✅ **Histórico de envios** por mês com filtro.  
⚠️ Ao carregar, executa `doRefreshTasks()` sempre (pode ser lento se houver muitos usuários).  
⚠️ `loadData()` busca até 500 profiles e 1000 deliveries por chamada — pode ser insuficiente com crescimento.

### 3.3 Usuários (AdminUsers)
📋 Validado por análise estática:  
✅ Lista de usuários com busca.  
✅ Alterar plano (update em `profiles`).  
✅ Bloquear/desbloquear (campo `account_status`).  
✅ Notas de admin por usuário.  
✅ Histórico de mudança de plano.  
✅ Subscriptions (Stripe).  
✅ Geração de resumo de perfil com IA (`generateUserProfileSummary`).  
⚠️ `useEffect` com dependências faltando (linha 285 de AdminUsers.tsx) — pode causar comportamento inesperado ao abrir detalhes de usuário após troca de usuário.

### 3.4 Planos (AdminPlans)
✅ **Planos oficiais corretos**: Gratuito (R$0), Essencial (R$19,90), Terapêutico (R$39,90), Terapêutico Plus (R$79,90) — definidos em `officialPlans.ts` e usados por `AdminPlans`.  
✅ Editor visual de features por plano com herança.  
✅ `plan_feature_access` como fonte de verdade em runtime (com fallback estático).  
✅ Herança entre planos implementada e gerenciável pelo admin.

### 3.5 Notificações (AdminNotifications)
✅ Criar, enviar para todos / por plano / usuário específico.  
✅ Tipos de notificação múltiplos.  
✅ Geração de conteúdo com IA integrada (AIContentAssistant).  
❌ **`action_view` não está disponível no formulário de criação manual**. O admin não consegue definir para onde o usuário é levado ao clicar na notificação. O campo `action_view` só é preenchido automaticamente na Fila de Pendências (`ACTION_VIEW_MAP`). Notificações criadas manualmente não têm `action_view`, então o botão de ação não aparece para o usuário.

### 3.6 Automação (AdminAutomated)
✅ Criação de conteúdo automatizado com tipo, frequência e plano.  
✅ Ativar/desativar conteúdos.  
✅ Geração com IA.  
⚠️ A IA aqui usa **Pollinations.ai diretamente no cliente** (não usa a Edge Function `generate-content` que usa Gemini). Há **divergência de provider**: AdminAutomated e AdminPersonalization → Pollinations.ai; `generate-content` Edge Function → Gemini.  
⚠️ Não há verificação de duplicata antes de disparar: se `is_active` é verdadeiro e o trigger roda várias vezes, pode duplicar conteúdo. Porém, a entrega manual parece ser controlada pela Fila de Pendências, não pelo módulo de automação em si.

### 3.7 Sistema (AdminSystemHealth / AdminLogs)
✅ `systemHealth.ts` com funções de quick check, intermediate check, full diagnostic.  
✅ Incidentes, relatórios, histórico de checks.  
✅ Cleanup de logs via `cleanup_old_health_checks()` (migration 033).  
🔍 Logs e health checks dependem de dados reais do Supabase — não testável sem ambiente.

### 3.8 Conteúdo (AdminArticleEditor / AdminArticles / AdminCategories / AdminSEO)
✅ Editor de artigos com publicação/rascunho.  
✅ SEO, categorias, depoimentos.  
📋 Validado por análise estática.

---

## 4. Blog/app do usuário — por área, função e plano

### 4.1 Diário (DiaryPage)
✅ **Limite de 5 entradas/mês para Gratuito** implementado:
```tsx
const freeAtLimit = plan === 'free' && freeEntryCount >= freeEntryLimit  // freeEntryLimit = 5
```
✅ Campos básicos para Gratuito, campos extras (scores, tags) para Essencial+, campos avançados (sono, autoestima, irritabilidade) para Terapêutico+.  
✅ Contador do mês atual baseado em `created_at` (mês + ano correntes).  
⚠️ O limite é verificado apenas no cliente — **não há RLS ou trigger no banco impedindo inserção** de quem está no plano gratuito além de 5 entradas. Um usuário malicioso com acesso direto à API pode inserir ilimitadamente.

### 4.2 Minha Evolução (MyEvolutionPage)
✅ Abas por plano: `resumo`, `graficos`, `relatorios`, `autocuidado`, `orientacoes`, `comentarios`, `sessao`, `para-voce`.  
✅ `LockedSection` exibida quando o plano não é suficiente, com botão para Pricing.  
✅ Conteúdos personalizados visíveis apenas com `status = 'sent'` (ver seção 5).

### 4.3 Notificações (NotificationsPage)
✅ Sino com contador de não-lidas.  
✅ Abas: todas, não-lidas, lidas.  
✅ Marcar como lida / marcar todas como lidas.  
✅ Navega para `action_view` ao clicar na ação da notificação.  
⚠️ O `navigate` é passado como prop — se o componente pai não passar `navigate`, o botão de ação fica inativo sem aviso ao usuário.

### 4.4 Questionários (QuestionnairesPage)
📋 Validado por análise estática: tabela `questionnaires` tem campo `plan_required` com check constraint.  
⚠️ A restrição de plano nos questionários é verificada no cliente (via `plan_required`). Não há RLS na tabela `questionnaires` que impeça usuário de acessar questionários de planos superiores via API.

### 4.5 Trilhas (TrailsPage)
📋 Validado por análise estática. Não verificado em profundidade.

### 4.6 Itens Salvos (SavedItemsPage)
📋 Validado por análise estática.

### 4.7 Meu Plano (MyPlanPage)
📋 Validado por análise estática. Inclui `UpgradeModal` e integração com `create-checkout`.

### 4.8 Suporte (SupportPage / SupportTicketDetail)
📋 Validado por análise estática.

### 4.9 Perfil (Profile)
📋 Validado por análise estática. Usa `useAuth.updatePlan` localmente.

---

## 5. Reflexo admin → usuário

### Conteúdos personalizados
✅ **Fluxo correto**: Admin gera → salva como `draft` → revisa → envia (`status = 'sent'`).  
✅ **Usuário só vê `status = 'sent'`**: verificado tanto na RLS (migration 029 e 031):
```sql
CREATE POLICY "users_view_own_sent_content" ON personalized_content_deliveries
  FOR SELECT USING (auth.uid() = user_id AND status = 'sent');
```
✅ Ao enviar, notificação é gerada automaticamente com `action_view` correto via `ACTION_VIEW_MAP`.  
✅ `sendPersonalizedDelivery` reflete em `monthly_guidance_requests` ou `professional_comments` conforme `content_type`.  
⚠️ Conteúdos com `status = 'draft'` ou `'generated'` **não aparecem para o usuário** — correto.

### Notificações manuais
❌ Notificações criadas pelo admin via "Nova notificação" não incluem `action_view` — usuário vê a notificação mas sem botão de ação.

---

## 6. Permissões por plano

### Arquivo central
✅ `src/lib/officialPlans.ts` — fonte única de verdade para planos, features e hierarquia.  
✅ `src/lib/permissions.ts` — `canAccessFeature(plan, featureKey)` com fallback estático e cache em runtime do banco.

### Hierarquia oficial
| Plano | Preço | Herda de |
|---|---|---|
| free | R$0 | — |
| essential | R$19,90/mês | free |
| therapeutic | R$39,90/mês | essential |
| therapeutic-plus | R$79,90/mês | therapeutic |

✅ **Preços corretos** conforme solicitado.

### Implementação de limites

| Feature | Controle | Local | Banco |
|---|---|---|---|
| Diário: 5/mês para Gratuito | ✅ Cliente | DiaryPage.tsx L103 | ❌ Sem RLS/trigger |
| Questionários por plano | ⚠️ Cliente | QuestionnairesPage | ❌ Sem RLS |
| Conteúdos personalizados | ✅ RLS | migration 029/031 | ✅ |
| Notificações | ✅ RLS | migration 007 | ✅ |
| Perfil | ✅ RLS | migration 001 | ✅ |
| Diário | ✅ RLS (acesso) | migration 001 | ✅ (só próprio) |

---

## 7. IA

### Onde é chamada
1. **Fila de Pendências** (`AdminPersonalization` + `personalizationTasks.ts`): `generateContentForTask()` → `callAI()` → **Pollinations.ai** (serviço público, sem autenticação)
2. **AdminAutomated**: `generateContent()` → **Pollinations.ai** diretamente no cliente
3. **AdminNotifications** (AIContentAssistant): via componente assistente (Pollinations.ai)
4. **AdminUsers**: `generateUserProfileSummary()` → **Pollinations.ai**
5. **Edge Function `generate-content`**: **Google Gemini** (`GEMINI_API_KEY`) — chamada do servidor

### Fallback
✅ `callAI()` em `aiContent.ts` tem timeout de 35s e lança erro amigável.  
✅ `generateContentForTask()` captura erros e exibe mensagem ao admin.  
✅ `AdminAutomated.generateContent()` tem timeout de 30s.  
✅ Falha no `sendPersonalizedDelivery` não cancela o envio principal (try/catch com warn).

### Dados enviados à IA
⚠️ **Pollinations.ai é um serviço público gratuito**, sem termos de privacidade para dados pessoais. O `buildSnapshot()` envia ao prompt:
- Quantidade de entradas no diário
- Humor médio
- Tags emocionais mais frequentes (ex: "ansiedade", "tristeza")
- Quantidade de questionários respondidos

Esses dados são anonimizados (sem nome/email), mas são dados de saúde mental. **Recomendação crítica**: migrar para um provider com contrato de privacidade (OpenAI, Anthropic, Google via API gerenciada) ou usar a própria Edge Function `generate-content` (que usa Gemini com chave de servidor).

### Rascunho antes de enviar
✅ **Sim**: todo conteúdo gerado pela Fila de Pendências salva como `draft` no banco antes de qualquer envio. O admin deve revisar e aprovar explicitamente.

### Divergência de provider
⚠️ `AdminAutomated` usa Pollinations.ai (cliente), enquanto a Edge Function `generate-content` usa Gemini. Há dois sistemas de IA paralelos sem unificação.

---

## 8. Pagamentos

### Implementação
✅ **Stripe implementado** com Edge Functions:
- `supabase/functions/create-checkout/index.ts` — cria sessão de checkout
- `supabase/functions/stripe-webhook/index.ts` — processa eventos

### Eventos tratados no webhook
✅ `checkout.session.completed` → ativa plano pelo `metadata.plan`  
✅ `invoice.payment_succeeded` → renova plano via `stripe_customer_id`  
✅ `customer.subscription.deleted` → reverte para `free`

### Ambiente
⚠️ **Price IDs hardcoded como fallback**:
```typescript
essential:          Deno.env.get('STRIPE_PRICE_ESSENTIAL')    || 'price_1To2n05xvJV4HLHz8ym64uYH',
therapeutic:        Deno.env.get('STRIPE_PRICE_THERAPEUTIC')  || 'price_1To2n15xvJV4HLHzqQWylm4W',
'therapeutic-plus': Deno.env.get('STRIPE_PRICE_PLUS')        || 'price_1To2n15xvJV4HLHz2BoMO7ie',
```
Isso indica que o ambiente atual usa Stripe de **produção real**. Se as env vars não forem configuradas no Supabase, os IDs de produção expostos no código source serão usados. Risco: se alguém descobrir esses IDs, pode tentar criar checkouts com preços alterados.

### Upgrade/downgrade
✅ Webhook atualiza `profiles.plan` via service role key (bypass de RLS correto).  
⚠️ Não há tabela `subscriptions` robusta para rastreamento de histórico (migration 022 tem `subscriptions` parcial). O campo `plan` em `profiles` é a única fonte de verdade do plano atual.

---

## 9. Segurança / RLS

| Tabela | RLS ativa | Política usuário | Política admin |
|---|---|---|---|
| `profiles` | ✅ migration 001 | Vê/edita só próprio | ✅ migration 017 (`is_admin()`) |
| `diary_entries` | ✅ migration 001 | Vê/edita só próprios | ❌ Não há política admin explícita |
| `notifications` | ✅ migration 007 | Vê próprias ou `user_id IS NULL` | ✅ via service role no webhook |
| `personalized_content_deliveries` | ✅ migration 029 | Só `status='sent'` e próprias | ✅ `is_admin()` migration 029 |
| `user_personalization_tasks` | ✅ migration 030 | Vê próprias | ✅ `is_admin()` |
| `questionnaires` | ❌ Não verificada | Pública (SELECT sem auth) | — |
| `articles` | ✅ migration 013 | Só `status='published'` | ✅ `is_admin()` |
| `questionnaire_responses` | ✅ migration 001 | Vê próprias | INSERT público |

### Função `is_admin()`
✅ Definida em migration 013:
```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;
```
✅ Usada em 14+ migrations para proteção de dados sensíveis.

### Problemas de segurança identificados
1. **Diário sem limite no banco** (Crítico para integridade): Usuário `free` pode inserir mais de 5 entradas/mês via API direta. O limite existe apenas no cliente.
2. **Notificações com `user_id IS NULL`** visíveis para todos os usuários autenticados (política: `USING (user_id = auth.uid() OR user_id IS NULL)`). Isso pode ser intencional para notificações broadcast, mas não há validação de que isso seja desejado.
3. **Price IDs Stripe hardcoded** no código das Edge Functions (ver seção 8).
4. **INSERT em `questionnaire_responses` é público** (migration 001, linha ~98): `WITH CHECK (true)` — qualquer pessoa, mesmo não autenticada, pode inserir respostas.

---

## 10. Duplicidades

### Duplicidades identificadas
1. **Dois providers de IA**: Pollinations.ai (cliente, múltiplos componentes) e Gemini (Edge Function `generate-content`). A Edge Function existe mas não é usada pelos componentes admin.
2. **`monthKey()` duplicado**: definida tanto em `personalizationTasks.ts` quanto em `MyEvolutionPage.tsx` com implementação idêntica. Deveria ser extraída para um helper compartilhado.
3. **`PLAN_LABELS` e `PLAN_COLORS`** redefinidos em `AdminPersonalization.tsx` e `AdminAutomated.tsx` e `AdminUsers.tsx` — poderia ser um módulo compartilhado.
4. **`hasPlan()`** redefinida localmente em `MyEvolutionPage.tsx` e em `personalizationTasks.ts` com a mesma lógica de `PLAN_RANK`.
5. **`DISCLAIMER`** definido em `aiContent.ts` e repetido como constante local em `AdminPersonalization.tsx`.
6. **`inputCls`** (classe CSS de input) definida em vários componentes admin separadamente.
7. **Lógica de plano no diário** (`isEssential`, `isTherapeutic`) calculada localmente em `DiaryPage.tsx` em vez de usar `canAccessFeature()` de `permissions.ts`.

---

## 11. Lista priorizada de correções

### 🔴 Crítico

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| C1 | Price IDs Stripe hardcoded como fallback | `supabase/functions/create-checkout/index.ts` L9-11, `stripe-webhook/index.ts` L10-12 | Se env vars faltarem, IDs de produção reais ficam expostos |
| C2 | Limite de diário (5/mês gratuito) não existe no banco | `DiaryPage.tsx` L103 + ausência de trigger/RLS | Contorna limite via API |
| C3 | INSERT em `questionnaire_responses` público sem auth | `migration 001_initial_schema.sql` L97-98 | Qualquer pessoa pode inserir respostas |

### 🟠 Alto

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| A1 | `action_view` ausente nas notificações manuais | `AdminNotifications.tsx` | Botão de ação inativo para o usuário |
| A2 | IA envia dados de saúde mental para Pollinations.ai (sem contrato) | `aiContent.ts`, `AdminAutomated.tsx` | Possível violação de privacidade |
| A3 | `useEffect` com dependências faltando em AdminUsers | `AdminUsers.tsx` L285 | Comportamento inesperado ao navegar entre usuários |
| A4 | Bundle de 1,15 MB — sem code splitting | `vite.config.*` | Carregamento lento, especialmente em mobile |
| A5 | Dois providers de IA sem unificação | `aiContent.ts` + `generate-content/index.ts` | Inconsistência de qualidade e privacidade |

### 🟡 Médio

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| M1 | `monthKey()` duplicada em múltiplos arquivos | `personalizationTasks.ts`, `MyEvolutionPage.tsx` | Risco de divergência futura |
| M2 | `PLAN_LABELS`/`PLAN_COLORS` redefinidas em 3+ componentes | Vários admin | Manutenção difícil |
| M3 | `hasPlan()` duplicada | `MyEvolutionPage.tsx`, `personalizationTasks.ts` | Pode divergir |
| M4 | DiaryPage usa lógica de plano local em vez de `canAccessFeature()` | `DiaryPage.tsx` L93-94 | Inconsistência com sistema de permissões |
| M5 | `loadData()` em Fila de Pendências busca 500 profiles + 1000 deliveries sempre | `AdminPersonalization.tsx` L1051-1055 | Pode ser lento com escala |
| M6 | "Ver site" e "Sair do admin" têm a mesma ação | `AdminLayout.tsx` L70-82 | Confuso para o admin |
| M7 | Notificações `user_id IS NULL` visíveis para todos | migration 007 L143-144 | Depende se é intencional |

### 🔵 Baixo

| # | Problema | Arquivo | Impacto |
|---|---|---|---|
| B1 | 197 avisos de lint (any, hooks) | Vários | Qualidade de código |
| B2 | `DISCLAIMER` duplicado | `aiContent.ts` + `AdminPersonalization.tsx` | Inconsistência cosmética |
| B3 | `inputCls` CSS duplicado em vários componentes | Vários admin | DRY violation |
| B4 | vulnerabilidades esbuild/vite (dev only) | package.json | Risco apenas em `npm run dev` |

### 💡 Melhoria futura

| # | Sugestão | Benefício |
|---|---|---|
| F1 | Migrar IA para provider com contrato (OpenAI/Anthropic/Gemini via gateway) e unificar | Privacidade + qualidade |
| F2 | Code splitting com `React.lazy()` para área admin | Bundle 60-70% menor |
| F3 | Trigger PostgreSQL para limitar entradas de diário por plano | Segurança no banco |
| F4 | Paginação em `loadData()` da Fila de Pendências | Performance com escala |
| F5 | Adicionar campo `action_view` no formulário de Nova Notificação | Melhor UX de notificações |
| F6 | Centralizar constantes de plano (labels, cores) em um módulo shared | DRY |

---

## 12. Testes executados

| Teste | Resultado | Método |
|---|---|---|
| Extração do zip | ✅ | PowerShell `Expand-Archive` |
| `npm install` | ✅ sem erros | PowerShell |
| `npm run build` | ✅ build gerado | PowerShell |
| `npx tsc --noEmit` | ✅ sem erros TS | PowerShell |
| `npm run lint` | ⚠️ 197 avisos | PowerShell |
| `npm audit --omit=dev` | ⚠️ 2 vulnerabilidades | PowerShell |
| Análise do Admin (estrutura, menu, rotas) | 📋 estático | Leitura de código |
| Análise da Fila de Pendências | 📋 estático | Leitura de código completa |
| Análise do fluxo IA (geração → rascunho → envio) | 📋 estático | Leitura de código |
| Análise das migrations (RLS, policies, constraints) | 📋 estático | Leitura das 33 migrations |
| Análise das Edge Functions (Stripe, IA) | 📋 estático | Leitura de código |
| Análise de permissões por plano | 📋 estático | officialPlans.ts, permissions.ts |
| Análise do diário (limites por plano) | 📋 estático | DiaryPage.tsx |
| Análise de notificações (usuário + admin) | 📋 estático | NotificationsPage.tsx, AdminNotifications.tsx |
| Teste funcional no navegador | ❌ Não realizado | Servidor de dev não iniciado durante auditoria |
| Teste de integração com Supabase real | 🔍 Não testável | Requer ambiente configurado |
| Teste de pagamento Stripe | 🔍 Não testável | Requer ambiente configurado |

---

## 13. Limitações

1. **Sem execução no navegador**: O relatório é baseado inteiramente em análise estática do código. Comportamentos de UI, fluxos de login e telas reais não foram testados com browser.
2. **Sem acesso ao Supabase em produção**: RLS, dados reais, migrations aplicadas e Edge Functions foram analisados pelo código-fonte, não pelo banco em operação.
3. **Sem acesso ao Stripe**: Price IDs e webhook foram analisados pelo código. Não foi possível confirmar se os IDs hardcoded são de sandbox ou produção real.
4. **Zip contém apenas arquivos do agente remoto**: O arquivo zip analisado é a estrutura de arquivos do ambiente `kind-lucid-clarke`, que espelha o repositório Git. O código analisado é o mesmo do repositório `main`.
5. **Playwright não instalado**: Não há `playwright.config.*` no projeto. Testes de browser automatizados não foram executados conforme previsto.
6. **Arquivos não encontrados**: Os arquivos a seguir listados no escopo da auditoria **não existem** no projeto:
   - `src/components/admin/AdminDiaryConfig.tsx` — existe como importação mas não encontrado como arquivo separado (possivelmente integrado a `AdminAreaUsuariosPlanos`)
   - `src/hooks/usePlan.ts` — não existe; lógica de plano está em `useAuth.ts` e `permissions.ts`
   - `src/services/notificationService.ts` — não existe como serviço separado

---

*Relatório gerado por análise estática automatizada em 2026-07-01. Validação final requer testes em ambiente real.*
