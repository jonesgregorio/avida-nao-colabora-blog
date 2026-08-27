# CLAUDE_EXECUTION_CHECKPOINT.md

> Memória operacional das missões de finalização/hardening do projeto.
> Ler este arquivo primeiro ao retomar. Não repetir etapas marcadas ✅.
> Duas missões já passaram por esta sessão — ver "Histórico" no fim. Este topo
> documenta a missão ATUAL (a mais recente, baseada na auditoria do ZIP 76,
> foco em Planos/Preços/Admin), que é a que deve ser continuada agora.

## Missão atual (ZIP 76 — preços/planos/admin)
Super-prompt de 35 etapas, prioridade P0 em: fonte canônica de preço, remover
preço-texto manual no Admin, plano ativo/inativo bloqueando checkout de
verdade, permissões técnicas honestas no Admin (read-only ou remover).

## Última `main` conhecida
- Commit: `f2762ac` ("fix(planos): tornar permissões técnicas somente leitura no Admin (Etapa 4) (#168)")
- Sincronizada e deployada em produção em 2026-08-27 23:34 UTC (confirmado via API de deployments do GitHub).
- **Todos os 4 itens P0 do novo super-prompt (ZIP 76) estão concluídos, mesclados e em produção.**

## Achado importante desta missão
Ao começar, dois PRs de uma sessão paralela ("feat(planos): catálogo central
editável de funcionalidades" e "feat(planos): refletir catálogo editável em
Meu Plano") tinham acabado de mesclar. Um agente de auditoria confirmou, lendo
o código real (não os nomes dos PRs), que 4 dos 7 itens críticos do novo
super-prompt AINDA eram problemas reais mesmo depois desses PRs. Sempre
auditar o código atual antes de assumir que algo já foi corrigido.

## Status por item do novo super-prompt (auditado no código real)

| Item | Tema | Status | Evidência / PR |
|---|---|---|---|
| Etapa 1 (P0) | Fonte canônica de preço (Home/Pricing/MeuPlano/Admin) | ✅ CONCLUÍDA — [PR #165](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/165) (CI em andamento, não mesclado ainda) | Criado `src/lib/planPricing.ts` (`loadPlanPricing`/`usePlanPricing`), lê `get_public_plan_pricing`. `HomeContent.tsx` tinha preço 100% hardcoded (`'R$ 19,90'`) — corrigido. `MyPlanPageCore.tsx` (`PLAN_PRICES` estático usado em valor atual/comparação/proração) — corrigido, vira `FALLBACK_PLAN_PRICES` só para antes da RPC responder. `Pricing.tsx` e `AdminPlanosPage.tsx` cada um chamava a RPC separadamente — consolidado. |
| Etapa 2 (P0) | Remover "Preço (texto)" manual em AdminPlans.tsx | ✅ CONCLUÍDA — [PR #164](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/164) (mesclado) | `plan_configs.price` já era sincronizado automaticamente pelo Stripe via `admin-plan-pricing/index.ts:97`, mas `AdminPlans.tsx` tinha um input de texto livre ligado à mesma coluna, permitindo dessincronizar manualmente. Campo virou somente leitura; `savePlans()` não envia mais `price` no upsert. |
| Etapa 3 (P0) | `plan_configs.active` bloqueando novas assinaturas/upgrades de verdade | ✅ CONCLUÍDA — [PR #167](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/167) (mesclado) | `create-checkout`/`manage-subscription` agora consultam `plan_configs.active` e recusam com erro claro. `'free'` nunca é bloqueado (downgrade pra Gratuito passa por `cancel`, não por este helper). Frontend (`Pricing.tsx`/`MyPlanPageCore.tsx`) mostra "Indisponível agora" pra quem ainda não está no plano; assinante atual não é afetado. Sem migration. |
| Etapa 4 (P0/P1) | Permissões técnicas honestas no Admin (read-only ou remover) | ✅ CONCLUÍDA — [PR #168](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/168) (mesclado) | Confirmado: `loadPlanAccess()` realmente nunca era chamada. `toggleOwnFeature()`/`saveAllAccess()` removidos; as duas visões (cards + tabela técnica) do Admin agora mostram sempre `OWN_FEATURE_KEYS` (fonte real) como indicador somente leitura, com selo "🔒 regra técnica do produto". "Visualização comercial" e "Sincronizar com Supabase" intactos. |
| Etapa 7 (P1) | MyPlanPage/Core sem mutação global (`splice` em `PUBLIC_PLAN_FEATURES`/`PLAN_COMPARE_ROWS`) | ✅ JÁ ESTAVA OK (não precisou de correção) | Auditoria confirmou: `PLAN_COMPARE_ROWS` (`planComparison.ts`) e `PUBLIC_PLAN_FEATURES` são derivados via `.map`/função pura, nunca mutados com `splice`. O medo da auditoria original (ZIP 76) não se confirmou no código atual. |
| Etapa 9 (P1) | Verificador de consistência dos planos no Admin | ❌ NÃO EXISTE | Nenhum bloco "Verificação de consistência" (crítico/atenção/informativo) encontrado em `AdminPlans.tsx`/`AdminPlanosPage.tsx`/`AdminPlanFeatureCatalog.tsx`. |
| Etapa 10 (P1) | Stripe Audit sem valor fixo hardcoded | ⚠️ PARCIAL — risco baixo | `AdminBillingPriceEditor.tsx:10` tem `FALLBACK = { essential: 1990, plus: 3990 }`, mas só como estado inicial de exibição; `load()` sempre busca o preço real via `admin-plan-pricing`. Não há um "Stripe Audit" dedicado separado — não confundir com o editor de preços, que já está correto. |
| Etapas 11–35 | Templates de suporte, anexos, categorias, feedback do plano/orientação, evolução de questionários, personalização negativa, senha 8+, MFA opcional, exportação, mapa emocional, modularização, docs, gates, Supabase/Stripe/Vercel, auditoria final | Não auditado ainda nesta sessão | P2/P3 — depois dos P0/P1 acima. |

## Itens concluídos nesta sessão (contando as duas missões)
Ver tabela "Histórico" no fim para a missão anterior (22 etapas). Nesta
missão nova (ZIP 76): **Etapas 1, 2, 3 e 4 concluídas — todo o P0** (4 PRs:
#164, #165, #167, #168), mais Etapa 5 da missão anterior fechada no meio do
caminho (PR #163). 8 PRs mesclados no total nesta sessão, todos com CI verde
e deploy de produção confirmado via API do GitHub.

## Arquivos modificados nesta missão (ZIP 76)
- `src/lib/planPricing.ts` (novo — fonte canônica de preço + flag `active`)
- `src/components/HomeContent.tsx`
- `src/components/MyPlanPageCore.tsx`
- `src/components/Pricing.tsx`
- `src/components/admin/AdminPlanosPage.tsx`
- `src/components/admin/AdminPlans.tsx` (preço read-only + permissões read-only)
- `supabase/functions/create-checkout/index.ts` (checa `plan_configs.active`)
- `supabase/functions/manage-subscription/index.ts` (`planIsActive()` helper)
- `tests/canonicalPlanPricing.test.ts` (novo)
- `tests/adminPlansPriceReadOnly.test.ts` (novo)
- `tests/planInactiveBlocksCheckout.test.ts` (novo)
- `tests/adminTechnicalPermissionsReadOnly.test.ts` (novo)
- `tests/billing-price-admin-sync.test.ts` (atualizado, não quebrado)

## Migrations criadas nesta missão
Nenhuma. Todos os itens P0 foram resolvidos usando colunas/tabelas que já
existiam (`plan_configs.active`, `plan_configs.price`/`price_cents`,
`plan_feature_access`) — o problema era sempre "ninguém lê/escreve isso
direito", nunca "falta coluna".

## Edge Functions modificadas nesta missão
- `create-checkout/index.ts` — recusa checkout de plano inativo.
- `manage-subscription/index.ts` — recusa upgrade/downgrade pra plano inativo.
Ambas validadas com `deno check` local antes do push, além do CI.

## Testes executados (última rodada, após merge do PR #168)
- `npm test` completo: 3 falhas, todas pré-existentes desde o início da
  sessão, não relacionadas a nenhuma mudança feita:
  - `tests/speechRecognitionPermission.test.ts`
  - `tests/monthlyGuidanceContract.test.ts` (2 asserts)
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.
- `deno check` local em `create-checkout/index.ts` e `manage-subscription/index.ts`: limpo.

## Erros encontrados e resolvidos
- Lock de git órfão (`index.lock`) apareceu repetidas vezes durante a sessão
  (auto-push local, ver memória `autopush_interferencia`). Sempre confirmado
  com `Get-Process git` (PowerShell) que nenhum processo estava vivo antes de
  remover. Se continuar acontecendo com frequência, vale desligar esse loop.
- PRs precisam estar atualizados com a `main` antes de mesclar (branch
  protection "BEHIND" bloqueia merge mesmo com CI verde) — usar
  `gh api repos/OWNER/REPO/pulls/N/update-branch -X PUT` e aguardar o CI
  rodar de novo antes de tentar `gh pr merge`.
- `node --experimental-strip-types` exige extensão `.ts` explícita em imports
  relativos entre módulos de `src/lib` (ESM estrito, diferente do Vite).

## Decisões arquiteturais tomadas nesta missão
- `planPricing.ts` é a ÚNICA camada que chama `get_public_plan_pricing`;
  todo consumidor (Home/Pricing/MeuPlano/Admin) usa `usePlanPricing()`/
  `loadPlanPricing()`, nunca a RPC direto.
- Fallback de preço deriva sempre de `OFFICIAL_PLANS` (nunca um número
  paralelo hardcoded) — evita reintroduzir o mesmo bug de divergência.
- `AdminPlans.tsx` não escreve mais `price` no upsert — a única via de
  escrita legítima do preço real é `admin-plan-pricing` (Stripe).

## PRÓXIMA AÇÃO A EXECUTAR
Todo o P0 está fechado. Ordem sugerida para continuar (P1 → P2 → P3):
1. **Etapa 9 (P1)** — Verificador de consistência dos planos no Admin. Não
   existe ainda. Criar bloco "Verificação de consistência" com botão
   "Verificar planos" em Admin → Planos e Assinaturas, comparando: catálogo
   (feature_key ausente/duplicado), planos (recurso anunciado onde não
   deveria, plano inativo aparecendo), preços (Admin vs banco vs Stripe vs
   público vs Meu Plano — agora que a Etapa 1 unificou a leitura, isso deve
   bater; o verificador serve pra provar isso continuamente), Stripe (Price
   ID inexistente/arquivado/moeda errada). Importante: **só aponta, não
   corrige automaticamente** (regra explícita do super-prompt).
2. **Etapa 10 (P1)** — Stripe Audit dinâmico. Auditoria já encontrou que
   `AdminBillingPriceEditor.tsx:10` tem um `FALLBACK` hardcoded, mas só usado
   como estado inicial antes da carga real — risco baixo, mas vale confirmar
   se existe (ou deveria existir) uma tela "Stripe Audit" dedicada separada
   do editor de preços, e se ela usa valor fixo em algum lugar.
3. **Etapa 7 já estava OK** (não precisa de trabalho) — só confirmar de novo
   se algo mudar na área de MyPlanPage no futuro.
4. Etapas 11-20 (P2): templates de suporte com preço dinâmico, anexos no
   suporte, categorias de suporte, feedback do plano de autocuidado (mesma
   pendência da missão anterior), feedback da orientação, evolução de
   questionários, personalização negativa, senha 8+, exportação melhor.
5. Etapas 20-22 (P3): MFA opcional, comparação livre no mapa, modularização
   gradual (Admin Usuários — mesma pendência antiga, agora é P3 aqui).
6. Etapas 31-35: gates de CI, Supabase, Stripe, Vercel, documentação e
   auditoria final — fazer por último, com o código já estável.

## STATUS: MISSÃO ATUAL EM ANDAMENTO (não concluída) — todo o P0 do novo super-prompt fechado nesta sessão (Etapas 1-4). Próximo: P1 (Etapas 9-10).

---

## Histórico — missão anterior (super-prompt de 22 etapas, "ZIP 75")

Concluída parcialmente nesta mesma sessão, antes do novo super-prompt chegar.
PRs mesclados: [#157](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/157) (SLA suporte),
[#158](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/158) (limpeza UpgradeModal + testes IA invisível),
[#159](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/159) (Base deste plano),
[#163](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/163) (previsão de data na Orientação Mensal).

Pendências que NÃO foram retomadas pelo novo super-prompt (ainda válidas, retomar quando o novo super-prompt permitir):
- Etapa 4 (feedback por ação do plano de autocuidado — "Quero tentar/Fiz/Não fez sentido") — o novo super-prompt também pede isso (sua Etapa 14), então quando chegar lá, é a mesma pendência.
- Etapa 6/7 (Admin Usuários escalável — `AdminUsersImpl.tsx` 1809 linhas, busca todos os `profiles` sem paginação "de propósito") — o novo super-prompt não prioriza isso tão alto (é sua Etapa 24, "modularização gradual", P3); adiado.
- `src/lib/careePlanAI.ts` com typo no nome — cosmético, baixo risco, não priorizado.
