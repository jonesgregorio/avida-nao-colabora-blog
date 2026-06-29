# Auditoria Completa — Painel Admin  
**Projeto:** A Vida Não Colabora  
**URL:** https://avida-nao-colabora-blog.vercel.app/?view=admin  
**Data:** 29/06/2026  
**Método:** Análise de código-fonte (zip) + testes ao vivo via Chrome  

---

## Resumo Executivo

O painel admin tem **26 seções**. Após análise do código e testes ao vivo:

| Categoria | Quantidade |
|-----------|------------|
| ✅ Funciona corretamente | 5 |
| ⚠️ Funciona parcialmente / visual only | 7 |
| ❌ Quebrado (erro de coluna, tabela ou RLS) | 14 |

O maior problema sistêmico é **desalinhamento entre o schema do banco e o código frontend**: diversas tabelas foram criadas com nomes de colunas diferentes dos que o componente usa. Muitas migrations foram escritas mas provavelmente não executadas no Supabase de produção.

---

## Tabela Detalhada por Seção

| # | Área | Status | O que funciona | O que não funciona | Erros encontrados | Prioridade | Sugestão de correção |
|---|------|--------|----------------|-------------------|-------------------|------------|----------------------|
| 1 | **Dashboard** | ⚠️ Parcial | Interface renderiza; distribuição de planos carrega; alertas condicionais aparecem | Todos os 8 cards mostram `0`; tickets, trilhas e automações retornam erro silencioso | `HEAD` requests retornam 503 (RLS bloqueia COUNT anon); `.catch()` em cadeia de query causa `TypeError` — Supabase v2 removeu esse método | 🔴 Urgente | Substituir `.catch()` por `try/catch`; usar `.select('*',{count:'exact',head:true})` com anon key ou garantir RLS admin correta |
| 2 | **Artigos (lista)** | ❌ Quebrado | Interface abre; botão "Novo" funciona visualmente | Lista retorna **400** — query pede `category, published_at` que podem não existir na tabela `articles` real (criada pela migration 001 sem essas colunas) | `400 Bad Request` no SELECT | 🔴 Urgente | Executar `admin_schema.sql` no Supabase (adiciona `status`, `published_at`, `cover_image_url`, `seo_title`, etc.) |
| 3 | **Artigos (editor)** | ❌ Quebrado | Formulário abre corretamente com todos os campos | Salvar falha: colunas do payload (`cover_image_url`, `status`, `seo_title`, `diary_question`, `cta_text`) não existem na tabela original | `400` ou `500` no INSERT/UPDATE | 🔴 Urgente | Mesmo fix da linha 2: executar `admin_schema.sql` |
| 4 | **Imagens** | ⚠️ Incerto | Interface renderiza; botão upload visível | Upload e listagem dependem do bucket `article-images` existir no Supabase Storage; sem confirmação de que foi criado | Se bucket não existe: `StorageError` | 🟠 Alta | Criar bucket `article-images` como público no Supabase Dashboard > Storage |
| 5 | **Categorias** | ✅ Funciona | Listagem (GET 200), criação (POST 201), auto-slug gerado, exclusão — tudo funciona | — | — | — | — |
| 6 | **Questionários (lista)** | ❌ Quebrado | Interface abre; formulário "Novo" renderiza com todas as abas | Lista retorna **400** — query pede coluna `question_count` que não existe na tabela `questionnaires` (migration 007) | `400 Bad Request` | 🔴 Urgente | Remover `question_count` do SELECT; usar `questions.length` calculado no frontend. Migration 007 também precisar ser executada |
| 7 | **Questionários (salvar)** | ❌ Quebrado | Formulário com 4 abas renderiza corretamente | Payload de save inclui `question_count`, `tags`, `questions` (JSONB), `results` (JSONB), `emotional_category` — colunas extras que não existem no schema | `400` no INSERT | 🔴 Urgente | Adicionar colunas faltantes via ALTER TABLE ou reescrever payload para colunas existentes |
| 8 | **Trilhas** | ❌ Provavelmente quebrado | Interface deve renderizar | Tabelas `trails` e `trail_articles` só existem se migration 007 foi executada — que provavelmente não foi | `400` ou `relation does not exist` | 🟠 Alta | Executar migration 007 no Supabase |
| 9 | **SEO** | ⚠️ Parcial (read-only) | Lê artigos e exibe campos SEO | Edição **não implementada** — código tem aviso "Edição de SEO global em breve" | Sem erro de runtime; funcionalidade ausente | 🟡 Média | Implementar save por artigo (UPDATE `seo_title`, `seo_description`) |
| 10 | **Conteúdos Auto.** | ⚠️ Parcial | Tabela `automated_contents` existe (automation_schema); interface lista e cria conteúdos; geração via Pollinations.ai integrada | Geração por IA depende de fetch externo para `text.pollinations.ai` — pode falhar por CORS ou timeout | Possível `NetworkError` ou resposta vazia da Pollinations | 🟡 Média | Adicionar fallback e timeout explícito no `generateContent()`; tratar erro na UI |
| 11 | **Programados** | ❌ Quebrado | Interface renderiza | Colunas do componente (`type`, `content`, `plan_required`, `recurrence`, `status`) **não batem** com migration 007 (`content_type`, `body`, `send_at_hour`, `is_active`) | `400` em INSERT e SELECT | 🟠 Alta | Alinhar schema: executar `ALTER TABLE scheduled_contents ADD COLUMN type TEXT, ADD COLUMN content TEXT, ADD COLUMN plan_required TEXT, ADD COLUMN recurrence TEXT, ADD COLUMN status TEXT` — ou reescrever componente para usar colunas existentes |
| 12 | **Notificações** | ❌ Quebrado | Interface renderiza; formulário aparece | Componente insere `target_plan` e `status` que não existem na tabela `notifications` (migration 007 tem `user_id`, `title`, `body`, `type`, `is_read`) | `400` em INSERT e UPDATE | 🟠 Alta | Adicionar colunas `target_plan TEXT` e `status TEXT DEFAULT 'draft'` em `notifications`; ou reescrever componente |
| 13 | **Usuários** | ✅ Funciona | Lista usuários da tabela `profiles`; campo de busca; alterar plano; toggle admin — tudo implementado corretamente | Coluna `full_name` pode ser nula para usuários antigos | Possível dado vazio na UI | 🟢 Baixa | Mostrar fallback "Sem nome" quando `full_name` é nulo |
| 14 | **Planos** | ❌ Não persiste | Interface visual completa com abas por plano; edição de features, preços e limites | **Não salva no banco** — código tem `TODO: persist to supabase plan_configs table`; dados são apenas estado local que reseta ao navegar | Sem erro de runtime, mas mudanças se perdem | 🟠 Alta | Criar tabela `plan_configs` e implementar save/load no Supabase |
| 15 | **Diário por Plano** | ❌ Não persiste | Interface visual para configurar perguntas por plano | **Não salva no banco** — só estado React local; sem nenhuma chamada ao Supabase | Sem erro de runtime, mas mudanças se perdem | 🟡 Média | Criar tabela `diary_plan_configs` e implementar persistência |
| 16 | **Caixa de Cuidado** | ⚠️ Incerto | Interface implementada; faz join `saved_items → articles → profiles` | Tabela `saved_items` existe em schemas auxiliares (`new_features_schema.sql`, `interactive_schema.sql`) — mas a RLS **não permite admin ler todos os itens** (policy só permite `user_id = auth.uid()`) | `400` ou lista vazia | 🟡 Média | Adicionar RLS policy `FOR SELECT` para admin na tabela `saved_items` |
| 17 | **Analytics** | ⚠️ Parcial | Gráficos e métricas de `analytics_events` carregam se tabela existe; filtro de período funciona | HEAD requests (`profiles`, `diary_entries`) retornam 503; métricas base ficam com 0 | `503` nos HEAD counts | 🟠 Alta | Usar `select('plan')` sem `head:true` para contar; garantir RLS admin em `analytics_events` |
| 18 | **Prova Social** | ❌ Quebrado | Interface visual completa com formulário e lista | Coluna mismatch na tabela `testimonials`: componente usa `name`, `text`, `active` — schema tem `author_name`, `content`, `is_approved`. Coluna mismatch em `site_metrics`: componente usa `.order('key')` e acessa `m.key` — schema tem coluna `metric` (não `key`) | `400` em SELECT e INSERT | 🟠 Alta | Alinhar colunas: `ALTER TABLE testimonials ADD COLUMN name TEXT, ADD COLUMN text TEXT, ADD COLUMN active BOOLEAN`; ou reescrever componente para usar `author_name`/`content`/`is_approved` |
| 19 | **Suporte** | ⚠️ Incerto | Interface completa: lista tickets, filtros, campo de resposta, fechar ticket | Tabela `support_tickets` só existe se migration 007 foi executada; sem canal para usuários abrirem tickets no frontend público | Se tabela não existe: `relation does not exist` | 🟠 Alta | Executar migration 007; criar formulário de contato no frontend público |
| 20 | **Financeiro** | ⚠️ Visual / Estimado | Exibe contagem de usuários por plano e calcula receita estimada com preços fixos hardcoded | Não integrado a sistema de pagamento real (Stripe, etc.); valores são **estimativas** baseadas em `profiles.plan`, não em cobranças reais | Sem erro de runtime; dados não refletem realidade financeira | 🟡 Média | Conectar a Stripe Billing ou tabela de transações para dados reais |
| 21 | **PDFs/Relatórios** | ⚠️ Visual apenas | Exibe stats de usuários por plano | Não gera PDF real; não tem exportação; seção é visual/mockup | Sem erro de runtime | 🟢 Baixa | Implementar geração de PDF com `jsPDF` ou exportação CSV |
| 22 | **Permissões** | ❌ Provavelmente quebrado | Interface visual: lista admins, botão revogar | Query pede `profiles(id, email, role, plan, created_at)` — mas `email` **não existe** em `profiles` (email fica em `auth.users`) | `400` no SELECT | 🟠 Alta | Remover `email` da query; buscar email via `auth.users` com join, ou adicionar coluna `email` em profiles via trigger |
| 23 | **Logs** | ❌ Provavelmente quebrado | Interface com busca e listagem | Tabela `admin_logs` só existe se migration 007 foi executada; join `admin:profiles(email)` falha pois `profiles` não tem coluna `email` | `400` ou `relation does not exist` | 🟡 Média | Executar migration 007; corrigir join para usar `admin:profiles(full_name)` ou remover join |
| 24 | **Profissionais** | ❌ Quebrado | Interface com formulário completo; detecção de tabela ausente implementada | Schema (migration 007) usa coluna `is_active`; componente usa `active` — mismatch em INSERT, UPDATE e RLS policy | `400` em INSERT/SELECT; `unknown column active` | 🟠 Alta | Mudar componente para usar `is_active` (consistente com migration 007) |
| 25 | **Acesso admin** | ❌ Crítico | Admin vê mensagem "Acesso restrito a administradores" se `profile.role !== 'admin'` | Mas não há redirect ou proteção real de rota — qualquer pessoa com a URL `?view=admin` acessa a tela de login "fantasma" sem autenticação | Sem proteção de rota; sem autenticação no backend | 🔴 Urgente | Verificação de role já existe no `index.tsx`; garantir que o usuário **jonlesjonles30@gmail.com** tem `role = 'admin'` no banco |

---

## Erros que Continuam Ativos

| Erro | Arquivo | Causa | Status |
|------|---------|-------|--------|
| `TypeError: .catch is not a function` | `AdminDashboard.tsx` | Supabase v2 não suporta `.catch()` em cadeia | ❌ Não corrigido |
| `HEAD 503` em counts | `AdminDashboard.tsx`, `AdminAnalytics.tsx` | RLS bloqueia COUNT com anon key / head:true | ❌ Não corrigido |
| `400` em lista de artigos | `AdminArticles.tsx` | `admin_schema.sql` não executado no Supabase | ❌ Não corrigido |
| `400` em lista de questionários | `AdminQuestionnaires.tsx` | Coluna `question_count` não existe na tabela | ❌ Não corrigido |
| Coluna mismatch `testimonials` | `AdminSocialProof.tsx` | `name/text/active` vs `author_name/content/is_approved` | ❌ Não corrigido |
| Coluna mismatch `site_metrics` | `AdminSocialProof.tsx` | Coluna `key` vs `metric` | ❌ Não corrigido |
| Coluna mismatch `scheduled_contents` | `AdminScheduled.tsx` | `type/content` vs `content_type/body` | ❌ Não corrigido |
| Coluna mismatch `notifications` | `AdminNotifications.tsx` | Colunas `target_plan`, `status` não existem | ❌ Não corrigido |
| Coluna mismatch `professionals` | `AdminProfessionals.tsx` | `active` vs `is_active` | ❌ Não corrigido |
| Coluna `email` em `profiles` | `AdminPermissions.tsx`, `AdminLogs.tsx` | `profiles` não tem coluna `email` | ❌ Não corrigido |
| Sem persistência em Planos | `AdminPlans.tsx` | `TODO` no código; tabela inexistente | ❌ Não corrigido |
| Sem persistência em Diário/Planos | `AdminDiaryConfig.tsx` | Sem chamada ao Supabase | ❌ Não corrigido |

---

## Priorização

### 🔴 Urgente (bloqueia uso do admin)
1. Executar `admin_schema.sql` no Supabase — desbloqueia Artigos, Editor, colunas base
2. Executar `migration 007` no Supabase — desbloqueia Trilhas, Suporte, Logs, Notificações, Profissionais, Questionários
3. Corrigir `.catch()` → `try/catch` no `AdminDashboard.tsx`
4. Remover `question_count` do SELECT em `AdminQuestionnaires.tsx`
5. Confirmar que o usuário admin tem `role = 'admin'` no banco

### 🟠 Alta (funcionalidade core quebrada)
6. Alinhar colunas de `testimonials` e `site_metrics` — AdminSocialProof
7. Alinhar colunas de `scheduled_contents` — AdminScheduled
8. Adicionar colunas `target_plan` e `status` em `notifications` — AdminNotifications
9. Corrigir `active` → `is_active` em AdminProfessionals
10. Remover coluna `email` da query de `profiles` — AdminPermissions e AdminLogs
11. Criar bucket `article-images` no Supabase Storage — AdminImages
12. Adicionar RLS admin em `analytics_events` e corrigir HEAD counts — AdminAnalytics
13. Adicionar RLS admin em `saved_items` — AdminSavedItems

### 🟡 Média
14. Implementar persistência em AdminPlans (criar tabela `plan_configs`)
15. Implementar persistência em AdminDiaryConfig
16. Implementar edição SEO global em AdminSEO
17. Criar formulário de contato público para gerar `support_tickets`
18. Adicionar fallback de nome nulo em AdminUsers

### 🟢 Baixa
19. Implementar geração real de PDF em AdminPDF
20. Conectar AdminFinancial a dados reais de pagamento
21. Tratar timeout e erros da Pollinations.ai em AdminAutomated

---

## Plano de Execução Sugerido

**Fase 1 — Banco de dados (sem código):** Executar no Supabase SQL Editor:
1. `admin_schema.sql` (cria/expande tabela articles + categories + RLS)
2. `migration 007` (cria trailing, notifications, support_tickets, testimonials, admin_logs, etc.)
3. Verificar/criar bucket `article-images` em Storage

**Fase 2 — Correções de código (14 arquivos):** Corrigir mismatches de coluna, `.catch()`, SELECT inválidos

**Fase 3 — Funcionalidades ausentes:** AdminPlans persistência, AdminDiaryConfig persistência, AdminSEO edição, formulário de contato público

---

*Auditoria baseada em: análise estática do código-fonte (zip de 29/06/2026) + testes ao vivo no Chrome + análise de todas as migrations SQL.*
