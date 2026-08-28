# CLAUDE_EXECUTION_CHECKPOINT.md

> Memória operacional das missões de finalização/hardening do projeto.
> Ler este arquivo primeiro ao retomar. Não repetir etapas marcadas ✅.

## Missão atual — continuação ZIP 76
Ordem autorizada: P1 restante → P2 → P3 → validações live/documentação/auditoria final.
Regra principal: auditar a `main` real antes de cada item, trabalhar em PRs pequenos e só mesclar com gates verdes.

## Última `main` conhecida
- Commit: `d8d63965e82ef99c4079954212ba12295ad54eea`
- Merge: PR #173 — `fix(planos): concluir superfícies do catálogo sem mutação global`
- Data: 2026-08-27 (America/Sao_Paulo)

## Regras invariáveis
- Planos comerciais: somente `free`, `essential`, `plus`.
- `unlimited_access` é entitlement administrativo, não plano.
- `emotional_tags` e `trigger_tags` nunca são equivalentes.
- IA pode existir internamente, mas não é exposta ao usuário final.
- Stripe/cobrança não pode ser refatorado como efeito colateral.
- PR que alterar fluxo real de cobrança/Stripe exige confirmação explícita do usuário antes do merge.
- Migration destrutiva/ação irreversível exige confirmação explícita antes de executar.

## P0 — CONCLUÍDO
1. ✅ Fonte canônica de preço — `src/lib/planPricing.ts`; Home, Pricing, Meu Plano e Admin usam a mesma fonte. PR #165.
2. ✅ Campo de preço textual livre removido/tornado somente leitura. PR #164.
3. ✅ Plano inativo bloqueia checkout e troca no backend e UI, preservando assinante atual. PR #167.
4. ✅ Permissões técnicas do Admin são honestas/read-only; runtime continua governado pelas regras oficiais. PR #168.

## P1 — CONCLUÍDO
7. ✅ Sincronização não destrutiva — PR #172, merge `daf1bb17f56bbc4fe3069a12fca310e63fea4baf`.
   - `AdminPlans.tsx` agora mostra **Verificar estrutura**.
   - novo `src/lib/planStructureCheck.ts` cria somente features/vínculos ausentes usando `insert`.
   - nunca usa `upsert` sobre configurações existentes.
   - divergências existentes são contadas e preservadas para revisão.
   - teste: `tests/adminPlanStructureCheck.test.ts`.
   - gates: testes, TypeScript, Deno, ESLint, build, migrations-guard, Chromium/Axe verdes.

8/9. ✅ Verificador de consistência e Stripe Audit dinâmico — PR #170.
   - `admin-plan-consistency` é read-only/AAL2.
   - Stripe Audit lê preço atual do banco em vez de 1990/3990 fixos.

10. ✅ Superfícies do catálogo + correção da mutação global real de Meu Plano — PR #173, merge `d8d63965e82ef99c4079954212ba12295ad54eea`.
   - AUDITORIA DO CÓDIGO REAL CORRIGIU O CHECKPOINT ANTERIOR: a `main` ainda possuía `applyCatalogPresentation()` e `PLAN_COMPARE_ROWS.splice(...)`; portanto a afirmação anterior de que a mutação global já estava resolvida estava errada.
   - `showOnPricing` governa cards de Pricing.
   - `showOnComparison` governa tabelas de comparação.
   - `showOnUpgrade` governa listas de benefício em downgrade/cancelamento.
   - `showOnMyPlan` agora tem efeito real na seção **O que está incluído no seu plano**.
   - descrições do catálogo passam a aparecer nessa seção quando configuradas.
   - novo helper puro `src/lib/planCatalogPresentation.ts`.
   - `MyPlanPage.tsx` deriva apresentação com `useMemo` e passa por props.
   - `MyPlanPageCore.tsx` mantém checkout/manage-subscription/pró-rata/cancelamento/reativação, mas não depende de mutação de arrays globais.
   - testes: `tests/planCatalogSurfaces.test.ts` + `tests/myPlanFeatureCatalogBridge.test.ts` atualizado.
   - primeira rodada do PR falhou somente porque 2 testes antigos exigiam explicitamente a mutação removida; testes foram atualizados para o novo contrato seguro.
   - rodada final: 382/382 testes verdes + TypeScript + Deno + ESLint + build + migrations-guard + Chromium/Axe verdes.

## Estado de banco/migrations no P1 atual
- PR #172: sem migration.
- PR #173: sem migration.
- Nenhuma mudança de Stripe/cobrança foi feita nesses dois PRs.

## P2 — PRÓXIMA AÇÃO EXATA
### Item 11 — Templates do Suporte com preços dinâmicos
Achado confirmado novamente na `main`:
- `src/components/admin/AdminSupport.tsx`
- fallback `REPLY_TEMPLATES_FALLBACK` ainda contém preços fixos:
  - f05: Essencial R$ 19,90 / Plus R$ 39,90
  - f07: Essencial R$ 19,90
  - f08: Plus R$ 39,90
A correção deve consumir `src/lib/planPricing.ts` no momento em que a resposta pronta é aplicada, usando placeholders ou substituição dinâmica. Não deixar preço reutilizável hardcoded.

## P2 restante depois do item 11
12. Suporte com anexos privados + RLS.
13. Categorias de suporte e métricas/filtros.
14. Feedback estruturado por ação do Plano de Autocuidado, sem gamificação.
15. Feedback da Orientação Mensal, sem virar chat infinito.
16. Evolução longitudinal dos questionários com linguagem não clínica.
17. Personalização negativa reversível para conteúdos.
18. Padronizar senha mínima em 8 caracteres após auditar código real.
19. Exportação de dados mais legível, preservando JSON.

## P3
20. MFA opcional para usuário comum via Supabase, sem afetar MFA Admin.
21. Comparação livre no Mapa Emocional + resumo textual acessível.
22. AdminUsers escalável: agregados server-side + paginação real + atividade agregada; NÃO adicionar `.limit()` simples. Modularização somente depois.

## Validações finais fora do código
- Supabase live: migrations/RLS/índices/functions/triggers/crons.
- Stripe estrutural: checkout/upgrade/downgrade/pró-rata/cancelamento/reativação/webhook/idempotência sem cobrança real.
- Vercel: produção READY + domínio oficial HTTP 200 + runtime error/fatal.
- Atualizar `docs/ARQUITETURA_ATUAL.md`.
- Auditoria final das 40 áreas com nota 0–10.

## Histórico útil
PRs desta missão já concluídos: #164, #165, #167, #168, #170, #172, #173.
PRs relevantes da missão anterior: #157 (SLA), #158 (limpeza + IA invisível), #159 (Base deste plano), #163 (previsão da Orientação).

## STATUS
**P0 ✅ completo | P1 ✅ completo | P2 🚧 próximo: item 11 — templates do suporte com preço dinâmico.**
