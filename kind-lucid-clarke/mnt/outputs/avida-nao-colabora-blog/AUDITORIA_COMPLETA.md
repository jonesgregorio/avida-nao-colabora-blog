# Auditoria Completa — A Vida Não Colabora
**Data:** 18 de junho de 2026  
**Versão analisada:** ZIP `avida-nao-colabora-blog-main (1).zip`  
**Stack:** React 18 + TypeScript + Vite · Supabase · Tailwind CSS · Vercel

---

## 🔴 RESUMO EXECUTIVO

O projeto está em estágio de **protótipo funcional avançado**, porém com falhas críticas que impedem uso em produção real. Os problemas mais graves são: chave secreta do banco exposta no repositório Git, sistema de questionários completamente quebrado por falta de tabelas, e ausência total de gateway de pagamento (qualquer usuário pode se autopromover para qualquer plano gratuitamente).

**Notas por área:**

| Área | Nota |
|------|------|
| Segurança | 🔴 2/10 |
| Banco de dados | 🟠 4/10 |
| Blog / Conteúdo | 🟡 6/10 |
| Painel Admin | 🟡 5/10 |
| Questionários | 🔴 1/10 |
| Diário | 🟠 4/10 |
| Planos / Checkout | 🔴 2/10 |
| SEO / Roteamento | 🟠 4/10 |
| Performance | 🟡 6/10 |
| UX Geral | 🟢 7/10 |
| **Produção real** | 🔴 **3/10** |
| **Protótipo** | 🟡 **6/10** |

---

## 1. 🔴 SEGURANÇA — CRÍTICO

### 1.1 Service Role Key exposta no Git
**Gravidade: MÁXIMA — ação imediata necessária.**

A chave `SERVICE_KEY` do Supabase (que bypassa 100% das políticas RLS) está hardcoded e commitada em **7 arquivos** no repositório:

```
supabase/insert_missing_category_articles.py
supabase/insert_new_articles.py
supabase/expand_short_articles.py
supabase/update_unique_images.py
scripts/create_new_articles.py
scripts/fix_images.py
scripts/expand_articles.py
```

A chave começa com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` e termina em `...yfQaMFSumWQfTDDPpH6UJJdvGKVifSQz8EuhQWo-NZg`.

**O que isso significa:** qualquer pessoa que clonou o repositório tem acesso total ao banco de dados — pode ler, escrever, deletar qualquer dado sem autenticação.

**Ação necessária:**
1. Rotacionar a chave IMEDIATAMENTE em `Supabase Dashboard → Settings → API → Reset service_role key`
2. Mover as chaves para variáveis de ambiente (`.env`) e adicionar `.env` ao `.gitignore`
3. Considerar o histórico Git comprometido — usar `git filter-repo` ou `BFG Repo-Cleaner` para remover a chave dos commits antigos

### 1.2 Ausência de rate limiting no analytics
A tabela `analytics_events` aceita inserções de qualquer usuário anônimo (`WITH CHECK (true)`) sem limite. Alguém pode enviar milhões de eventos e inflar o banco.

### 1.3 RLS inconsistente — analytics vs outros
A política admin de `analytics_events` verifica `profiles.id = auth.uid()`, mas todas as outras políticas admin do projeto verificam `profiles.user_id = auth.uid()`. A coluna `id` é a PK (UUID próprio da tabela profiles), enquanto `user_id` é a FK para `auth.users`. Se o admin fez login via `auth.users`, `auth.uid()` retorna o `user_id`, não o `id` — a política do analytics pode bloquear o próprio admin.

### 1.4 Sem validação de entrada nos questionários admin
`AdminQuestionnaires.tsx` insere diretamente o conteúdo dos campos de texto sem sanitização.

---

## 2. 🔴 BANCO DE DADOS — PROBLEMAS CRÍTICOS

### 2.1 Migration 003 ausente
A sequência de migrations é: `001 → 002 → 004 → 005`. A migration 003 nunca foi criada. Isso pode causar problemas de ordenação se o Supabase ou outra ferramenta tentar aplicá-las em sequência.

### 2.2 Tabelas referenciadas pelo frontend que não existem em nenhuma migration

As seguintes tabelas são consultadas pelo código mas **nunca foram criadas**:

| Tabela | Usada em |
|--------|----------|
| `questionnaires` | QuestionnairesPage, QuestionnairePlayer, AdminQuestionnaires |
| `questionnaire_questions` | QuestionnairePlayer |
| `questionnaire_options` | QuestionnairePlayer |
| `questionnaire_results` | QuestionnairePlayer |
| `questionnaire_answers` | QuestionnairePlayer |
| `trails` | TrailsPage, AdminTrails |
| `trail_articles` | TrailsPage, AdminTrails |
| `scheduled_contents` | AdminScheduled |
| `admin_logs` | AdminLogs |
| `notifications` | AdminNotifications |
| `support_tickets` | AdminSupport |
| `testimonials` | AdminSocialProof |
| `professionals` | AdminProfessionals |
| `site_metrics` | AdminDashboard |
| `saved_articles` | SavedItemsPage (usa `saved_articles`, migration tem `saved_items`) |

**Resultado:** componentes inteiros falham silenciosamente com dados vazios, ou lançam erros 42P01 (relation does not exist) em produção.

> **Nota:** as migrations em `supabase/interactive_schema.sql` e `supabase/new_features_schema.sql` criam `article_trails` e `article_trail_items` — mas o código usa `trails` e `trail_articles`. Nome errado.

### 2.3 Restrição CHECK bloqueia o plano `therapeutic-plus`

```sql
-- migration 001:
plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'essential', 'therapeutic'))
```

O tipo TypeScript define `Plan = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'` e a tela de preços exibe o plano "Terapêutico Plus" por R$ 79,90. Qualquer tentativa de salvar esse plano no banco retorna erro de constraint — o usuário nunca consegue ter o plano mais caro.

### 2.4 DiaryPage salva 14 colunas que não existem no banco

A tabela `diary_entries` (migration 001) tem as colunas: `id, user_id, date, mood, mood_score, text, sleep_quality, pain_intensity, food_compulsion, emotional_triggers, markers, entry_type, questionnaire_score, questionnaire_category, notes, created_at`.

O `DiaryPage.tsx` tenta salvar:

| Campo salvo pelo frontend | Existe no banco? |
|--------------------------|-----------------|
| `energy` | ❌ NÃO |
| `anxiety_level` | ❌ NÃO |
| `stress_level` | ❌ NÃO |
| `gratitude` | ❌ NÃO |
| `small_pride` | ❌ NÃO |
| `free_note` | ❌ NÃO |
| `emotional_tags` | ❌ NÃO |
| `self_esteem` | ❌ NÃO |
| `irritability` | ❌ NÃO |
| `overload` | ❌ NÃO |
| `recurring_thoughts` | ❌ NÃO |
| `emotional_need` | ❌ NÃO |
| `relationships` | ❌ NÃO |
| `habits` | ❌ NÃO |
| `emotional_triggers` | ✅ existe |

**Resultado:** o formulário de diário tem 15 campos visíveis, mas ao salvar, apenas `mood_score`, `text`, `emotional_triggers` e poucos outros campos são de fato persistidos. Os demais são silenciosamente descartados pelo Supabase (colunas desconhecidas são ignoradas ou retornam erro dependendo da configuração). O usuário acredita que salvou, mas a maioria dos dados é perdida.

### 2.5 Conflito de schema entre migrations

`articles` é definida em `001_initial_schema.sql` (com colunas `excerpt`, `cover_image`) e redefinida em `admin_schema.sql` (com `summary`, `cover_image_url`, `status`, `plan_required`). São schemas incompatíveis. O código usa `cover_image_url`, `status` e `plan_required`, que só existem se `admin_schema.sql` foi executado manualmente — não é uma migration numerada.

### 2.6 `automated_contents` — campo errado

`automation_schema.sql` cria a coluna `is_active`, mas `DailyContentWidget.tsx` filtra com `.eq('active', true)`. O nome correto é `is_active`. Resultado: o widget nunca encontra conteúdo mesmo que haja dados cadastrados.

---

## 3. 📝 BLOG / ARTIGOS

### O que funciona
- Listagem de artigos com filtros por categoria
- Busca por texto
- Artigo individual com conteúdo completo
- Controle de acesso por plano (free vê apenas certos artigos)
- Salvamento de artigos (limitado a 3 para plano free)
- Rastreamento de cliques via `useAnalytics`

### Problemas
- **Sem URL canônica por artigo:** não existe `/blog/slug-do-artigo`. Compartilhar um artigo específico compartilha apenas a home, perdendo SEO e UX de compartilhamento.
- **`cover_image_url` vs `cover_image`:** o schema antigo usa `cover_image`, o novo usa `cover_image_url`. Se a migration antiga está ativa sem a `admin_schema.sql`, todas as imagens de capa aparecem quebradas.
- **`saved_articles` vs `saved_items`:** `SavedItemsPage.tsx` busca da tabela `saved_articles`, mas a migration cria `saved_items`. Tabela errada — página de salvos está sempre vazia.
- **Sem paginação:** a query busca todos os artigos de uma vez (sem `limit`/`range`). Com muitos artigos, será lento.
- **Sem busca full-text no banco:** a busca filtra no cliente (JS) sobre todos os artigos já carregados — ineficiente e não escala.

---

## 4. ⚙️ PAINEL ADMIN

### Componentes e status real

| Componente | Dados reais do banco? | Status |
|---|---|---|
| AdminAnalytics | ✅ Sim (analytics_events) | Funcional |
| AdminArticles | ✅ Parcial (2 queries) | Funcional básico |
| AdminCategories | ✅ Sim | Funcional |
| AdminUsers | ✅ Sim | Funcional básico |
| AdminSocialProof | ✅ Sim | Tabela `testimonials` não existe → vazio |
| AdminScheduled | ✅ Sim | Tabela `scheduled_contents` não existe → quebrado |
| AdminTrails | ✅ Sim | Tabelas `trails`/`trail_articles` não existem → quebrado |
| AdminQuestionnaires | ✅ Sim | Tabelas não existem → quebrado |
| AdminProfessionals | ✅ Parcial | Tabela `professionals` não existe → quebrado |
| AdminNotifications | ✅ Parcial | Tabela `notifications` não existe → quebrado |
| AdminSupport | ✅ Parcial | Tabela `support_tickets` não existe → quebrado |
| AdminLogs | ❌ Não | Tabela `admin_logs` não existe → quebrado |
| AdminPlans | ❌ Não | 100% mock (DEFAULT_PLANS hardcoded) |
| AdminDiaryConfig | ❌ Não | 100% mock (DEFAULT_CONFIGS hardcoded) |
| AdminSEO | ✅ Sim | Funcional (lista artigos) |
| AdminFinancial | ✅ Parcial | Conta usuários reais mas MRR é estimativa manual (sem Stripe) |
| AdminPDF | ✅ Parcial | Funcional, gera PDF do diário |
| AdminDashboard | ✅ Parcial | `site_metrics` não existe → seção de métricas quebrada |

**Resumo:** dos 18 painéis admin, apenas ~6 funcionam completamente. Os demais ou usam dados mock ou dependem de tabelas que não existem.

---

## 5. 🔴 QUESTIONÁRIOS — COMPLETAMENTE QUEBRADO

O sistema de questionários é a funcionalidade mais elaborada do projeto e está **totalmente inoperante em produção** porque nenhuma das tabelas necessárias foi criada em migrations oficiais:

- `questionnaires` — não existe
- `questionnaire_questions` — não existe  
- `questionnaire_options` — não existe
- `questionnaire_results` — não existe
- `questionnaire_answers` — não existe

O `QuestionnairePlayer.tsx` faz queries sequenciais nessas 5 tabelas. Todas retornam `relation does not exist`. A página pública de questionários mostra lista vazia; o player nunca carrega.

**Agravante:** `AdminQuestionnaires.tsx` usa o campo `min_plan` para controle de acesso, mas `QuestionnairesPage.tsx` usa `plan_required`. Mesmo que as tabelas existissem, a lógica de restrição por plano estaria inconsistente.

---

## 6. 📔 DIÁRIO EMOCIONAL

### O que funciona
- Interface visual rica (sliders, tags, campos de texto)
- Proteção de rota (redireciona para auth se não logado)
- Histórico de entradas existe na tela

### Problemas críticos
- **14 de 15 campos não são salvos** (detalhado na seção 2.4 acima)
- O usuário vê um formulário completo e acredita que está registrando seu bem-estar, mas quase nada é persistido
- Sem migration para adicionar as colunas faltantes
- `AdminDiaryConfig` é 100% mock — as configurações visuais (quais campos aparecem por plano) não são salvas em lugar nenhum

---

## 7. 🌿 CAIXA DE CUIDADO (DailyContentWidget)

### Status
O widget existe e está integrado na home, mas:

- Busca conteúdo com `.eq('active', true)` sendo que a coluna se chama `is_active` → **sempre retorna vazio**
- A Edge Function `generate-content` para gerar conteúdo via Pollinations.ai foi criada, mas depende de `scheduled_contents` (tabela inexistente)
- O widget mostra uma mensagem de fallback padrão quando não há conteúdo — isso é o que os usuários estão vendo hoje
- `track('daily_content_view')` e `track('daily_content_expand')` funcionam corretamente

---

## 8. 🔴 PLANOS / CHECKOUT — SEM PAGAMENTO REAL

### Problema central
`useAuth.ts` → `updatePlan()`:
```typescript
const updatePlan = async (plan: Plan) => {
  if (!user) return
  const { data } = await supabase
    .from('profiles')
    .update({ plan })
    .eq('user_id', user.id)
    .select()
    .single()
  if (data) setProfile(data)
}
```

Esta função é chamada diretamente ao clicar em qualquer plano na tela de preços (`App.tsx` linha 79: `await updatePlan(plan)`). **Não há verificação de pagamento, nenhum webhook, nenhuma confirmação externa.** Qualquer usuário logado pode abrir o DevTools e chamar essa função para se tornar "Terapêutico Plus" sem pagar.

A tela de preços exibe valores (R$ 19,90 / R$ 39,90 / R$ 79,90) mas o botão apenas chama `onSubscribe(plan.id)` → `updatePlan()`. É teatro de checkout.

### Outros problemas
- Plano `therapeutic-plus` é rejeitado pelo banco (constraint, seção 2.3)
- `AdminFinancial` estima MRR multiplicando nº de usuários por preço fixo — não reflete receita real
- Sem integração com Stripe, Pagar.me, Mercado Pago, ou qualquer gateway

---

## 9. 🌐 SEO / ROTEAMENTO

### Arquitetura de roteamento
O app usa roteamento baseado em estado (`useState<View>`) sem React Router. As URLs são `?view=admin`, `?view=diary` etc. Isso significa:

- Nenhuma URL de artigo individual existe (`/blog/ansiedade` → 404)
- Botão Voltar do navegador não navega entre views — vai para a página anterior no histórico real
- Compartilhar um artigo específico é impossível (link leva sempre à home)
- Google não indexa conteúdo de artigos individuais (sem URL única, sem SSR/SSG)

### Sitemap vs rotas reais
`public/sitemap.xml` lista URLs como `/blog`, `/planos`, `/sobre` — mas essas rotas **não existem** no Vercel. O `vercel.json` não tem rewrites configurados, então `/blog` retorna 404. Apenas `/` (raiz) funciona.

### Meta tags
`index.html` tem meta tags estáticas corretas para a home. Porém:
- Sem meta tags dinâmicas por artigo (Open Graph por artigo, título SEO individual)
- Sem canonical URLs por artigo
- `robots.txt` existe e está correto (`Allow: /`)
- Sem Schema.org / JSON-LD para artigos

### `vercel.json` incompleto
```json
{
  "buildCommand": "npm install && vite build",
  "outputDirectory": "dist"
}
```
Falta o rewrite essencial para SPA:
```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```
Sem isso, qualquer URL além de `/` que o usuário acessar diretamente (ou for compartilhada) retorna 404.

---

## 10. ⚡ PERFORMANCE

### Pontos positivos
- Vite com tree-shaking → bundle otimizado
- Tailwind CSS purge ativo
- Lucide-react (ícones SVG inline, sem sprite)
- `useAnalytics` é fire-and-forget, nunca bloqueia a UI
- Lazy loading de componentes admin via renderização condicional

### Pontos de atenção
- **Sem paginação nas queries:** `articles`, `diary_entries`, `analytics_events` são carregados sem `limit`. Com crescimento de dados, queries vão demorar.
- **Sem React.lazy / Suspense:** todos os componentes (incluindo admin completo) são importados estaticamente no bundle principal.
- **Recharts** é uma dependência pesada (~300KB) carregada para todos os usuários, não apenas admins.
- **Sem cache de queries:** cada montagem de componente refaz queries idênticas ao Supabase.
- **Sem CDN para imagens:** imagens de artigos são URLs externas (não gerenciadas pelo Storage do Supabase).

---

## 11. 🎨 UX / DESIGN

### Pontos positivos
- Design visual coeso e acolhedor (paleta sage/stone, tipografia serif)
- Componentes consistentes (cards, sliders, botões)
- Mensagens de estado vazias bem feitas
- Fluxo de auth claro
- Mobile-first via Tailwind

### Pontos de melhoria
- **Sem feedback de erro para o usuário:** quando o diário falha ao salvar (colunas inexistentes), o usuário não vê mensagem de erro — só "salvo!" silencioso ou nada.
- **Botão Voltar inconsistente:** em alguns componentes usa `onBack()` (props), em outros `window.history.back()` — comportamento imprevisível.
- **Tela de pricing sem CTA claro pós-login:** usuário logado vê botão que faz upgrade sem confirmação de pagamento — experiência estranha.
- **QuestionnairePlayer:** sem estado de loading/erro claro quando tabelas não existem — tela fica em branco.
- **Header:** link "Caixa de Cuidado" no menu depende de `view === 'meditations'` em alguns pontos — inconsistência de nomenclatura no código vs UI.
- **AdminDiaryConfig e AdminPlans são 100% mock:** admin salva configurações que somem ao recarregar a página.

---

## 12. 📦 DEPENDÊNCIAS E BUILD

```
react 18.3.1          ✅ atual
@supabase/supabase-js  ✅ 2.39.0
typescript 5.5.3      ✅ recente
vite 5.3.1            ✅ estável
recharts 2.12.7       ✅ ok
lucide-react 0.383.0  ✅ ok
tailwindcss 3.4.4     ✅ ok
```

Sem vulnerabilidades críticas conhecidas nas dependências listadas. Sem dependências desnecessárias. Stack moderna e adequada.

Build via Vercel (`npm install && vite build`) funcionaria normalmente se as variáveis de ambiente estiverem configuradas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

---

## 13. 🏗️ ARQUITETURA GERAL

### O que está bem
- Separação clara entre componentes de UI, hooks e tipos
- `useAuth` centraliza estado de autenticação
- `useAnalytics` é bem projetado (fire-and-forget, session ID, silencioso)
- Supabase RLS cobre os casos principais
- Estrutura de pastas intuitiva

### O que precisa melhorar
- **Roteamento:** migrar para React Router v6 (URLs reais, navegação por histórico, deep links)
- **Migrations:** todas as tabelas usadas pelo código devem ter migrations numeradas sequencialmente
- **Gestão de estado:** sem Zustand/Jotai/Context estruturado — props drilling em alguns pontos
- **Tratamento de erros:** ausência quase total de try/catch com feedback ao usuário
- **Tipos:** `View` em `types/index.ts` tem `'admin'` duplicado na union type

---

## 14. 🎯 LISTA DE PRIORIDADES

### 🔴 Urgente (antes de qualquer usuário real)

1. **Rotacionar a service role key** no Supabase Dashboard agora
2. **Criar migration para adicionar colunas faltantes em `diary_entries`** (energy, anxiety_level, stress_level, gratitude, small_pride, free_note, emotional_tags, self_esteem, irritability, overload, recurring_thoughts, emotional_need, relationships, habits)
3. **Criar migrations para todas as tabelas faltantes** (questionnaires, trails, notifications, support_tickets, etc.)
4. **Corrigir CHECK constraint do `plan`** para incluir `'therapeutic-plus'`
5. **Corrigir campo `active` → `is_active`** no `DailyContentWidget.tsx`
6. **Corrigir `saved_articles` → `saved_items`** no `SavedItemsPage.tsx`
7. **Adicionar rewrite no `vercel.json`** para SPA

### 🟠 Alta prioridade (para lançamento)

8. **Integrar gateway de pagamento** (Stripe ou Mercado Pago) antes de cobrar qualquer usuário
9. **Corrigir inconsistência `active` vs `is_active`** e `cover_image` vs `cover_image_url`
10. **Alinhar nomes de tabelas** (`trails` vs `article_trails`, `trail_articles` vs `article_trail_items`)
11. **Corrigir RLS de analytics** (`profiles.id` → `profiles.user_id`)
12. **Migrar para React Router v6** para URLs reais e SEO de artigos

### 🟡 Média prioridade (pós-lançamento)

13. Paginação nas queries de artigos e diário
14. React.lazy para componentes admin
15. Meta tags dinâmicas por artigo
16. Adicionar `admin_logs` para auditoria de ações admin
17. Rate limiting no endpoint de inserção de analytics
18. Tratamento de erros com feedback visual ao usuário

---

## 15. 🏆 NOTAS FINAIS

| Critério | Nota | Justificativa |
|----------|------|---------------|
| **Protótipo** | 🟡 6/10 | Visualmente completo, fluxos principais navegáveis, mas muita coisa quebra ao interagir |
| **Produção real** | 🔴 3/10 | Chave secreta exposta, pagamento sem gateway, diário não salva, questionários inexistentes |
| **Segurança** | 🔴 2/10 | Service key no Git é um bloqueador absoluto |
| **Blog / Conteúdo** | 🟡 6/10 | Funciona, mas sem URLs canônicas e busca no cliente |
| **Painel Admin** | 🟡 5/10 | 1/3 funcional, 1/3 mock, 1/3 quebrado |
| **SEO** | 🟠 4/10 | Sitemap errado, sem URLs de artigo, sem meta tags dinâmicas, SPA sem rewrite |

O projeto tem uma **base sólida de UI/UX** e uma visão clara do produto. Com as correções críticas listadas acima — especialmente a rotação da chave, as migrations faltantes, e a integração de pagamento — ele pode chegar a um estado de produção real em algumas semanas de trabalho focado.
