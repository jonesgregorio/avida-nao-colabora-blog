# Relatório — Admin como CMS editorial (A Vida Não Colabora)

Transformação do admin em central editorial com geração de conteúdo por IA **server‑side**,
executada em 10 fases, cada uma validada (`tsc` + `lint` + `vite build`) e deployada pela CI.

> Honestidade: build compila e a lógica está conectada ao banco/Edge Functions. **Não houve
> clique ao vivo** em cada tela — a verificação final é no admin após o deploy. Vários recursos
> dependem das **migrations 059–062** aplicarem pela CI (ver seção 11).

---

## 1. Arquivos criados
- `supabase/functions/generate-content/index.ts` — **reescrita**: proxy seguro de IA (admin‑only).
- `supabase/migrations/059_articles_content_type.sql` — `content_type` (artigo/prática/meditação).
- `supabase/migrations/060_articles_paywall_3plans.sql` — paywall de 3 planos + RLS + `get_article_teaser`.
- `supabase/migrations/061_editorial_cms.sql` — 7 tabelas do CMS + 19 templates de IA semeados.
- `supabase/migrations/062_articles_editorial_fields.sql` — 12 campos editoriais/SEO.
- `src/components/admin/AdminFabricaIA.tsx` — geração única + em massa (rascunhos).
- `src/components/admin/AdminTemplatesIA.tsx` — CRUD dos prompts de IA.
- `src/components/admin/AdminCalendarioEditorial.tsx` — calendário (kanban + lista).
- `src/components/admin/AdminAutomacoesBlog.tsx` — regras de automação + gatilho manual.
- `src/components/admin/AdminSEOCockpit.tsx` — diagnóstico de SEO + gerar SEO IA.
- `src/components/admin/AdminMediaLibrary.tsx` — estúdio de mídia.
- `src/components/admin/AdminPerformanceEditorial.tsx` — desempenho editorial.
- `scripts/cleanup_test_data.sql` — limpeza de dados de teste (aplicar manual).

## 2. Arquivos alterados
- `src/lib/aiContent.ts` — toda geração via Edge Function; **removidas** as chaves `VITE_*` do cliente.
- `src/components/ArticleView.tsx` — paywall (teaser) para conteúdo exclusivo por plano.
- `src/components/admin/AdminArticleEditor.tsx` — versões/rollback, checklist de publicação,
  pontuação de qualidade, campos SEO/editoriais, `origin=ia`, save resiliente.
- `src/components/admin/AdminArticles.tsx` — colunas (plano/SEO/imagem/origem), filtros de
  qualidade, seleção e **ações em massa** (publicar/rascunho/arquivar/gerar SEO/excluir).
- `src/components/admin/AdminAreaConteudo.tsx` — abas Práticas/Meditações/Recomendações/Templates.
- `src/components/admin/AdminLayout.tsx`, `index.tsx`, `types.ts` — 4 áreas novas de 1º nível.
- `src/lib/systemHealth.ts`, `AdminSystemHealth.tsx`, `AdminGuidanceRequests.tsx`, `AdminSelfCarePlans.tsx`,
  `AdminOverview.tsx` — textos, planos legados → 3 planos, saúde básica.

## 3. Funcionalidades criadas
Fábrica IA (único + massa) · Templates de IA editáveis · Calendário editorial (kanban/lista) ·
Automações (CRUD + gatilho "publicar agendados vencidos") · SEO cockpit · Estúdio de mídia ·
Performance editorial · Editor com versões/rollback/checklist/score · Painel de artigos com ações em massa ·
Paywall real de 3 planos no artigo público.

## 4. Funcionalidades reaproveitadas
`callAI`/`generate*` (aiContent) · AIContentAssistant · AdminArticles/Editor · AdminPersonalization
(Recomendações IA) · AdminEmails/Notifications (Comunicação) · sistema de e‑mail/notificações existente.

## 5. Removido / escondido
- Chaves de IA no frontend (`VITE_GEMINI_API_KEY`/`VITE_GROQ_API_KEY`) — **eliminadas**.
- Planos legados (`therapeutic*`, R$ 79,90) em selects/RLS de artigos → **free/essential/plus**.
- `AdminSEO.tsx` e `AdminImages.tsx` — **órfãos** (substituídos por cockpit/estúdio); podem ser apagados.

## 6. Fluxos corrigidos
- IA 100% server‑side (chaves só em secret).
- `ArticleView` não vaza rascunho/agendado; premium mostra paywall (antes: "não encontrado").
- Paywall de 3 planos: usuário `plus` lê `essential`; artigos `plus` funcionam (CHECK + RLS).
- Editor não quebra se as colunas novas ainda não migraram (fallback).

## 7. Tabelas / migrations
- **059** `articles.content_type` · **060** paywall 3 planos + `get_article_teaser()` ·
  **061** `content_versions`, `editorial_calendar`, `ai_prompt_templates`, `content_generation_jobs`,
  `content_automations`, `content_performance`, `media_library` (RLS admin) + seed de 19 templates ·
  **062** 12 campos editoriais em `articles`.

## 8. Edge Functions
- `generate-content` — **reescrita**: valida admin (JWT + `profiles.role`), usa `GEMINI_API_KEY`/
  `GROQ_API_KEY` do servidor, failover pollinations→gemini→groq, loga em `ai_generation_logs`.

## 9. Testes executados
`npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npx vite build` ✅ — em **todas** as fases.

## 10. O que passou / 11. O que depende de ambiente real
Passou: compilação, tipos, lint, bundle (chaves de IA fora do bundle confirmado).
Depende de ambiente:
- **Rotacionar** chaves Gemini/Groq (ficaram públicas em bundles antigos) + configurá‑las como
  **secrets do Supabase**; **remover** `VITE_*` da Vercel.
- Migrations **059–062** aplicarem pela CI (senão Fábrica/Calendário/Templates/campos ficam parciais,
  com avisos graciosos).
- **Execução automática** das automações precisa de **cron/Edge Function** (não incluída) — só o
  gatilho manual "publicar agendados vencidos" funciona já.
- Upload direto de imagem para o **Storage** (a mídia hoje é cadastro por URL).

## 12. Como acessar cada área (sidebar do admin)
Visão geral · Usuários · Planos · **Conteúdos guiados** (Artigos/Práticas/Meditações/Recomendações
IA/Templates IA/Categorias/Mídia/SEO/Home e Depoimentos) · **Fábrica IA** · **Calendário editorial** ·
**Automações** · **Desempenho** · Diário e mapa · Autocuidado · Orientação · Comunicação · Suporte · Sistema.

## 13–15. Confirmações
- **Design conforme imagens**: sidebar verde escuro, topbar com busca/notificações/perfil, cards,
  tabelas, kanban, painéis laterais e badges seguem o padrão. Ajuste fino contínuo.
- **Administrar 100% do blog**: pauta→IA→revisão→SEO→imagem→checklist→publicar/agendar→desempenho
  cobertos por telas reais conectadas ao banco.
- **IA server‑side segura**: confirmado — nenhuma chave de IA no cliente; geração validada como admin
  na Edge Function.
