# Handoff — Estado atual (Blog do usuário × Admin)

Este projeto está sendo tocado em **dois trilhos paralelos**:
- **Chat "Blog" (novo):** foca só na **parte pública/usuário** (home, /planos, diário, mapa emocional, conteúdos, área logada do usuário).
- **Chat "Admin" (atual):** foca só na **área administrativa**.

> A **memória persistente** do projeto (`MEMORY.md` + arquivos em `.claude/.../memory/`) é carregada automaticamente em qualquer chat novo aberto **nesta mesma pasta**. Este documento é um resumo explícito para dar contexto rápido.

## Contexto técnico (vale para os dois trilhos)
- **App aninhada:** o código real fica em `kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/`.
- **Auto-push:** um watcher commita + empurra pro `main` continuamente; **Vercel** publica o frontend sozinho; a CI `apply-migrations.yml` aplica migrations no Supabase (ref `lejvvhzluggyxlfwfoxl`) e `deploy-supabase-functions.yml` sobe as edge functions.
- **Validação:** `npx tsc --noEmit`, `npm run lint` (max-warnings 0), `npx vite build`, `npm audit --omit=dev`.
- **Modelo oficial:** 3 planos (Gratuito R$0 / Essencial R$19,90 / Plus R$39,90) e 5 funcionalidades (Diário emocional, Mapa emocional, Conteúdos guiados, Plano de autocuidado, Orientação profissional).
- **Stripe (go-live pendente do usuário):** o price de R$39,90 hoje mora no secret `STRIPE_PRICE_THERAPEUTIC`; criar `STRIPE_PRICE_PLUS_3990` = price de 39,90. `STRIPE_PRICE_PLUS` é o antigo 79,90 (não usar em checkout).
- **Segurança:** o remote do git tem um **PAT do GitHub embutido** — rotacionar.
- **Screenshots** ficam bloqueados no ambiente do agente; para ver telas logadas, usar a extensão **claude-in-chrome** no navegador do usuário já logado.

---

## TRILHO BLOG (parte do usuário) — para o chat novo
**Referências visuais:** `Desktop.pdf` e `Mobile.pdf` (o usuário precisa **reanexar** no chat novo). Relatório: `RELATORIO_CORRECAO_VISUAL_FIDELIDADE_PRINTS.md`.

**Pronto:** identidade (Playfair Display + paleta `#1A4A3A`/`#FBFAF7`/etc.), home reestruturada (hero + still-life SVG `HeroArt.tsx`, três caminhos, "Tudo em um fluxo simples", "Planos que crescem com você", "Um apoio não um diagnóstico"), **footer claro**, header desktop/mobile, check-in com estado selecionado, `/planos` (ícones, botão Plus contornado, tabela em card), `LoggedHome.tsx` (dashboard das 5 funcionalidades com bloqueio por plano). Legado do usuário removido (Terapêutico/Sessão Plus/R$79,90).

**Pendente do blog:** conferência visual fina no deploy; alias de rota `mapa-emocional` (hoje `my-evolution`); **questionário inicial** (onboarding) funcional; check-in real persistido (visitante → localStorage; logado → banco); consolidar Conteúdos guiados como hub (blog/trilhas/meditações/práticas).

**Arquivos-chave do blog:** `src/components/Hero.tsx`, `HeroArt.tsx`, `HomeContent.tsx`, `Footer.tsx`, `Header.tsx`, `Logo.tsx`, `Pricing.tsx`, `LoggedHome.tsx`, `DiaryPage.tsx`, `MyEvolutionPage.tsx`, `GuidedContent.tsx`, `App.tsx`.

---

## TRILHO ADMIN — para este chat
**Referências visuais:** `Imagem 4 gerada (2).pdf` (10 telas: admin_1..admin_10).

**Pronto:** shell novo `AdminLayout.tsx` (sidebar 10 áreas + topbar + busca + perfil), desync corrigido (abre na Visão geral, sidebar sincroniza), página `AdminOverview.tsx` (Visão geral com dados reais), **recolor completo** dos ~40 painéis (esmeralda/stone → verde da marca) + títulos serif, Usuários (título serif + 5 cards + linhas na paleta + painel de detalhe funcional), legado removido (Sessões Plus, labels Terapêutico), **logs de auditoria instrumentados** (`logAdminAction` em troca/cancelamento de plano, envio de notificação, salvar planos).

**Pendente do admin:** rebuild de layout rico das telas cujo mockup é mais completo que o componente atual — **Orientação profissional** (admin_2, 3 colunas: fila + contexto + IA + resposta) e **Usuários tabela colunar** exata (admin_3) [precisa expor "último acesso"/contagem de diário]; refinar cada painel interno ao pixel do respectivo print (admin_5..10: Conteúdos, Diário/mapa, Autocuidado, Comunicação, Suporte, Sistema).

**Arquivos-chave do admin:** `src/components/admin/AdminLayout.tsx`, `index.tsx`, `AdminOverview.tsx`, `AdminUsers.tsx`, `AdminPlans.tsx`, `AdminArea*.tsx`, `AdminGuidanceRequests.tsx`, `AdminSelfCarePlans.tsx`, `AdminLogs.tsx`, `AdminSystemHealth.tsx`, `lib/adminAudit.ts`, `lib/officialPlans.ts`.
