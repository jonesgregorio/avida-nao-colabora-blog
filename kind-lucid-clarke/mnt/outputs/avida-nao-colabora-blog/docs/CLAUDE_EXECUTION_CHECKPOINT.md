# CLAUDE_EXECUTION_CHECKPOINT.md

> Memória operacional das missões de finalização/hardening do projeto.
> Ler este arquivo primeiro ao retomar. Não repetir etapas marcadas ✅.

## Missão atual — continuação ZIP 76
Ordem autorizada: P1 restante → P2 → P3 → validações live/documentação/auditoria final.
Regra principal: auditar a `main` real antes de cada item, trabalhar em PRs pequenos e só mesclar com gates verdes.

## Última `main` conhecida
- Commit: `9bee222df6c14af76ef3a783dc004c07569b5bb8`
- Merge: PR #177 — `feat(suporte): categorias oficiais nos chamados`
- Data: 2026-08-27/28 (America/Sao_Paulo)

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
   - `AdminPlans.tsx` mostra **Verificar estrutura**.
   - `src/lib/planStructureCheck.ts` cria somente features/vínculos ausentes usando `insert`.
   - nunca usa `upsert` sobre configurações existentes.
   - divergências existentes são contadas e preservadas para revisão.

8/9. ✅ Verificador de consistência e Stripe Audit dinâmico — PR #170.
   - `admin-plan-consistency` é read-only/AAL2.
   - Stripe Audit lê preço atual do banco em vez de 1990/3990 fixos.

10. ✅ Superfícies do catálogo + correção da mutação global real de Meu Plano — PR #173, merge `d8d63965e82ef99c4079954212ba12295ad54eea`.
   - `showOnPricing`, `showOnComparison`, `showOnUpgrade` e `showOnMyPlan` têm efeito real.
   - removida mutação global de `PUBLIC_PLAN_FEATURES`/`PLAN_COMPARE_ROWS` durante renderização.
   - `MyPlanPageCore.tsx` mantém handlers financeiros intactos.

## P2 — EM ANDAMENTO
11. ✅ Templates do Suporte com preços dinâmicos — PR #175, merge `daf468c5ffb1ec3ebd331589cd97d8da84c5a36f`.
   - fallbacks usam placeholders de preço.
   - preços são resolvidos pela fonte canônica `planPricing.ts` no momento de uso.
   - compatibilidade com templates antigos preservada.
   - sem migration/Edge Function e sem mudança em Stripe.

12. ✅ Suporte com anexos privados + RLS — PR #176, merge `38d4d636eeaf043cfbe8ae9947eaab2111dda551`.
   - bucket `support-attachments` privado, até 5 MB, JPG/PNG/WEBP/PDF.
   - até 3 anexos por mensagem.
   - RLS por usuário/ticket; Admin mantém acesso operacional.
   - metadados reutilizam `ticket_messages.attachments`.
   - downloads autenticados; nunca `getPublicUrl`.
   - migration e Edge Function validadas live; Vercel produção READY.

13. ✅ Categorias oficiais de Suporte — PR #177, merge `9bee222df6c14af76ef3a783dc004c07569b5bb8`.
   - fonte única compartilhada entre Suporte e Contato.
   - categorias: Uso do site, Problema técnico, Conta e acesso, Planos e assinatura, Pagamento, Privacidade e dados, Sugestão de melhoria e Outro.
   - Edge Function valida categoria e rejeita valor inventado.
   - prioridade `urgent` passa a ser aceita corretamente.
   - sem migration; Edge Function publicada e Vercel produção READY.

14. 🚧 Feedback estruturado por ação do Plano de Autocuidado, sem gamificação — branch `feat/plano-autocuidado-feedback-acoes`.
   - nova tabela `care_plan_action_feedback` com RLS.
   - percepções reversíveis: `helpful` = Fez sentido; `later` = Talvez depois; `not_for_me` = Não combinou comigo.
   - não existe conclusão, pontos, streak, ranking ou meta de produtividade.
   - UI delegada a `CarePlanActionFeedback.tsx`.
   - o próximo plano consulta somente o último roteiro enviado e feedbacks estruturados daquele roteiro.
   - feedback é tratado como preferência, nunca como eficácia, progresso, diagnóstico ou prova de melhora.
   - `not_for_me` orienta a evitar repetição literal; `later` sugere ajustar momento/intensidade; `helpful` pode inspirar ação semelhante.
   - contrato interno versionado para `self_care_plan_v3`.
   - migration ainda NÃO aplicada live antes dos gates/merge.

## P2 restante depois do item 14
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
PRs desta missão já concluídos: #164, #165, #167, #168, #170, #172, #173, #175, #176, #177.
PRs relevantes da missão anterior: #157 (SLA), #158 (limpeza + IA invisível), #159 (Base deste plano), #163 (previsão da Orientação).

## STATUS
**P0 ✅ completo | P1 ✅ completo | P2 🚧 item 14 em validação; próximo após merge: item 15 — feedback da Orientação Mensal.**
