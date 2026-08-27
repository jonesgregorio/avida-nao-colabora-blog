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
- Commit: verificar com `git log origin/main -1` — no momento deste snapshot,
  `main` já inclui os PRs #157–#164 mesclados (missão anterior + Etapa 2 desta).
- PR #165 (Etapa 1 desta missão) aberto, CI em andamento no momento deste snapshot.

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
| Etapa 3 (P0) | `plan_configs.active` bloqueando novas assinaturas/upgrades de verdade | ❌ AINDA PENDENTE | Auditoria confirmou: `create-checkout/index.ts` e `manage-subscription/index.ts` **nunca leem `active`** — só buscam `stripe_price_id`. Um plano marcado inativo no Admin não impede checkout nem troca de plano hoje. **Próxima etapa a atacar.** |
| Etapa 4 (P0/P1) | Permissões técnicas honestas no Admin (read-only ou remover) | ❌ AINDA PENDENTE | A tela "Permissões" do Admin (`plan_feature_access`, `toggleOwnFeature`) grava no banco, mas `loadPlanAccess()` (que leria esse cache para o runtime) **nunca é chamada em nenhum outro lugar do código** — `canAccessFeature` sempre usa o fallback estático de `officialPlans.ts`. A tela edita algo que não tem efeito real; precisa virar read-only com aviso, ou ser removida. |
| Etapa 7 (P1) | MyPlanPage/Core sem mutação global (`splice` em `PUBLIC_PLAN_FEATURES`/`PLAN_COMPARE_ROWS`) | ✅ JÁ ESTAVA OK (não precisou de correção) | Auditoria confirmou: `PLAN_COMPARE_ROWS` (`planComparison.ts`) e `PUBLIC_PLAN_FEATURES` são derivados via `.map`/função pura, nunca mutados com `splice`. O medo da auditoria original (ZIP 76) não se confirmou no código atual. |
| Etapa 9 (P1) | Verificador de consistência dos planos no Admin | ❌ NÃO EXISTE | Nenhum bloco "Verificação de consistência" (crítico/atenção/informativo) encontrado em `AdminPlans.tsx`/`AdminPlanosPage.tsx`/`AdminPlanFeatureCatalog.tsx`. |
| Etapa 10 (P1) | Stripe Audit sem valor fixo hardcoded | ⚠️ PARCIAL — risco baixo | `AdminBillingPriceEditor.tsx:10` tem `FALLBACK = { essential: 1990, plus: 3990 }`, mas só como estado inicial de exibição; `load()` sempre busca o preço real via `admin-plan-pricing`. Não há um "Stripe Audit" dedicado separado — não confundir com o editor de preços, que já está correto. |
| Etapas 11–35 | Templates de suporte, anexos, categorias, feedback do plano/orientação, evolução de questionários, personalização negativa, senha 8+, MFA opcional, exportação, mapa emocional, modularização, docs, gates, Supabase/Stripe/Vercel, auditoria final | Não auditado ainda nesta sessão | P2/P3 — depois dos P0/P1 acima. |

## Itens concluídos nesta sessão (contando as duas missões)
Ver tabela "Histórico" no fim para a missão anterior (22 etapas). Nesta
missão nova (ZIP 76): Etapas 1 e 2 concluídas (2 PRs), Etapa 5 da missão
anterior também fechada no meio do caminho (PR #163, já mesclado).

## Arquivos modificados nesta missão (ZIP 76)
- `src/lib/planPricing.ts` (novo)
- `src/components/HomeContent.tsx`
- `src/components/MyPlanPageCore.tsx`
- `src/components/Pricing.tsx`
- `src/components/admin/AdminPlanosPage.tsx`
- `src/components/admin/AdminPlans.tsx`
- `tests/canonicalPlanPricing.test.ts` (novo)
- `tests/adminPlansPriceReadOnly.test.ts` (novo)
- `tests/billing-price-admin-sync.test.ts` (atualizado, não quebrado)

## Migrations criadas nesta missão
Nenhuma ainda. A próxima etapa (Etapa 3 — plano inativo) NÃO deve precisar de
migration nova (`plan_configs.active` já existe) — só lógica nas Edge
Functions `create-checkout`/`manage-subscription`.

## Edge Functions modificadas nesta missão
Nenhuma ainda (Etapa 3, próxima, vai mexer em `create-checkout` e
`manage-subscription` — CUIDADO: são fluxos Stripe, testar bem, não fazer
cobrança real de teste).

## Testes executados (última rodada, branch claude/etapa1-preco-canonico antes do merge)
- `npm test` completo: 3 falhas, todas pré-existentes (mesmas desde o início
  da sessão, não relacionadas a preço/planos):
  - `tests/speechRecognitionPermission.test.ts`
  - `tests/monthlyGuidanceContract.test.ts` (2 asserts)
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.

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
1. Confirmar CI verde e mesclar [PR #165](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/165) (Etapa 1 — fonte canônica de preço).
2. Iniciar Etapa 3 do novo super-prompt (P0): `plan_configs.active` bloqueando
   checkout/upgrade de verdade.
   - Backend primeiro: `create-checkout/index.ts` e `manage-subscription/index.ts`
     devem consultar `plan_configs.active` e recusar com erro claro
     (`"Este plano não está disponível para novas assinaturas."`) se `false`.
     NÃO afetar assinantes já ativos no plano (eles continuam normalmente).
   - Frontend depois: esconder CTA de upgrade/checkout para plano inativo em
     `Pricing.tsx`/`MyPlanPageCore.tsx` (a UI já lê `plan.active` em algum
     lugar do Admin — verificar se o front público também precisa ler isso).
   - Testes: cenário completo (Etapa 26 do super-prompt) — plano inativo não
     aparece p/ novas assinaturas, checkout recusa, manage-subscription
     recusa, assinante atual mantém acesso, Admin continua vendo o plano.
   - CUIDADO: são Edge Functions de Stripe — não fazer cobrança real de
     teste; testar estruturalmente (validação de payload/erro), não
     end-to-end contra o Stripe de produção.
3. Depois: Etapa 4 (permissões técnicas honestas no Admin — provavelmente só
   read-only na UI + texto explicativo, baixo risco).
4. Etapas 9/10 (verificador de consistência, Stripe Audit dinâmico) são P1,
   ficam depois dos P0.
5. Etapas 11+ (P2/P3) só depois de fechar P0/P1.

## STATUS: MISSÃO ATUAL EM ANDAMENTO (não concluída) — Etapas 1 e 2 do novo super-prompt fechadas nesta sessão.

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
