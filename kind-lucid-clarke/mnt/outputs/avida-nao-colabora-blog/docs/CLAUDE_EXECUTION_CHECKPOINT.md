# CLAUDE_EXECUTION_CHECKPOINT.md

> Memória operacional da missão "Finalização, correções e hardening" (super-prompt de 26 seções / 22 etapas).
> Ler este arquivo primeiro ao retomar. Não repetir etapas marcadas ✅.

## Missão atual
Executar etapas do super-prompt de finalização em `kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog`,
priorizando correções críticas (preço, SLA), depois proveniência/acompanhamento, depois escala do Admin,
depois limpeza e documentação.

## Última `main` conhecida
- Commit: `5acbeed7f328323c7d1f24ce63c048d70a8c8374` ("feat(cuidado): expor 'Base deste plano' no Admin e resumo para o usuário (#159)")
- Sincronizada e deployada em produção em 2026-08-27 00:48 UTC (confirmado via API de deployments do GitHub).

## Branch atual
`claude/checkpoint-update-1` (só este arquivo). Nenhuma etapa de código em andamento no momento deste snapshot.

## PRs desta sessão (todos mesclados na `main`, CI verde, produção confirmada)
- [#157](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/157) — Etapa 2 (SLA de suporte unificado)
- [#158](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/158) — Etapa 9 parcial (remoção `UpgradeModal.tsx`) + Etapa 15 (cobertura de teste "IA invisível" ampliada)
- [#159](https://github.com/jonesgregorio/avida-nao-colabora-blog/pull/159) — Etapa 3 (exposição de "Base deste plano" no Admin/usuário)

## Achado importante (ainda válido)
Ao iniciar esta sessão, ~30 commits recentes na `main` já implementavam boa parte desta missão (mesmos títulos de
etapas do super-prompt), indicando execução paralela anterior por outra sessão/trabalho. Sempre auditar o código
real antes de reimplementar algo que já pode existir.

## Status por etapa (auditado no código real, não pelos nomes de commit)

| Etapa | Tema | Status | Evidência |
|---|---|---|---|
| 1 | Preço canônico Meu Plano | ✅ CONCLUÍDA | `src/lib/officialPlans.ts` (`OFFICIAL_PLANS`) consumido por `Pricing.tsx` e `MyPlanPage.tsx`; `tests/planSourceOfTruth.test.ts`, `tests/officialPlans.test.ts`. Obs.: Pricing ainda sobrepõe preço dinâmico via RPC `get_public_plan_pricing`, não comparado a MyPlanPage em teste — risco residual pequeno, não crítico. |
| 2 | SLA do suporte | ✅ CONCLUÍDA (PR #157) | `src/lib/supportSla.ts` (`SUPPORT_SLA_HOURS`, `getSupportSlaHours`, `getSupportSlaLabel`) consumido por `AdminSupport.tsx` e `SupportPage.tsx`. `tests/supportSla.test.ts`. |
| 3 | Proveniência do plano de autocuidado | ✅ CONCLUÍDA (PR #159) | Proveniência de método já existia (`generated_by_ai`, `fallback_used`, `edited_by_human/at`). Faltava exposição: criado `src/lib/carePlanBasis.ts` (normaliza `records_summary`, já persistido desde a migration 087, sem migration nova) + bloco "Base deste plano" no Admin + frase resumida no usuário. **Dívida técnica registrada**: os dois geradores (cron `run-emotional-automations` e manual `AdminMonthlyCarePlans.tsx`) gravam `records_summary` em formatos diferentes (snake_case vs camelCase) na mesma coluna — funciona hoje graças ao normalizador, mas idealmente devia ser unificado numa forma só (exigiria editar a Edge Function — não feito por ser mais arriscado). |
| 4 | Acompanhamento do plano (feedback por ação) | ❌ PENDENTE | Nenhuma tabela/coluna de feedback ("Quero tentar"/"Fiz"/"Não fez sentido") encontrada. Precisa de migration nova (tabela `care_plan_action_feedback` ou similar) + RLS + UI em `SelfCarePlanPage.tsx`. |
| 5 | Orientação mensal: timeline + previsão de data | ⚠️ PARCIAL | Timeline Enviada/Em análise/Respondida existe em `MonthlyGuidancePage.tsx:337-379`. Falta exibir data prevista de resposta ao usuário (SLA interno de 7 dias existe em `AdminGuidanceRequests.tsx` via `RESPONSE_SLA_DAYS`, não exposto ao usuário). Correção pequena: calcular `responseDueDate` (já existe a função) e mostrar na tela do usuário. |
| 6/7 | Admin Usuários escalável + refatorado | ❌ PENDENTE (maior item em aberto) | `AdminUsersImpl.tsx` tem 1809 linhas; comentário no próprio código (linha ~144-150) documenta que busca todos os `profiles` sem paginação "de propósito". Sem RPC de agregados, sem paginação server-side, sem split em sub-componentes/tabs (só `adminUsersModel.ts` foi extraído). Requer: (a) RPC(s) de agregados server-side, (b) paginação real da listagem, (c) split em sub-componentes — em várias migrations/PRs pequenos, não um só. |
| 8 | Refatoração de outros arquivos grandes | Parcialmente em andamento | Diário já teve extrações (`DiaryHistorySection.tsx`, `DiaryFormFields`, `DiarySavedReflection`). Demais arquivos grandes (AdminSupport, QuestionnairePlayer, MyReportPageContent, MyEvolutionPage etc.) não auditados linha a linha ainda. |
| 9 | Código morto/legado | ⚠️ PARCIAL | `UpgradeModal.tsx` removido (PR #158). `src/lib/careePlanAI.ts` (typo no nome) **está em uso ativo** por `AdminMonthlyCarePlans.tsx` e `SelfCarePlanPage.tsx` e por `carePlanBasis.ts` (novo) — não é morto, só mal nomeado; renomear exige atualizar 3+ imports, baixo risco mas não feito ainda. |
| 10 | Nomenclatura "Artigo diário" | Não auditado ainda | — |
| 11 | Contrato editorial | ✅ CONCLUÍDA | `src/lib/articleGenerationContract.ts` reexporta `supabase/functions/_shared/articleGenerationContract.ts`; `run-automations/index.ts` calcula `slug` e `plan_required` no sistema, não via IA. |
| 12 | Cache do Mapa Emocional | ✅ Aparenta concluída | `explain-emotional-map/index.ts` usa `source_hash`/fingerprint por período — não reauditado a fundo nesta sessão. |
| 13 | Rastreabilidade dos relatórios | ✅ Aparenta concluída | `ReportReadingBase.tsx` + `tests/reportReadingBase.test.ts` — não reauditado a fundo. |
| 14 | Notificações agrupadas/filtros | Não auditado | — |
| 15 | Testes "IA invisível ao usuário" | ✅ CONCLUÍDA (PR #158) | `tests/userFacingAiDisclosure.test.ts` agora cobre 9/9 superfícies do super-prompt (`DiaryExperience`, `DiarySavedReflection`, `MyEvolutionPage`, `MonthlyGuidancePage`, `SelfCarePlanPage`, `SupportPage`, `MyReportPageContent`, `QuestionnairesPage`, `LoggedHome`). |
| 16 | `docs/ARQUITETURA_ATUAL.md` | ✅ Já reflete 3 planos corretos, sem "Terapêutico" como nome principal | Não revisado se cobre todas as seções pedidas (SLA, proveniência, etc.) — atualização de doc é de baixa prioridade frente às Etapas 4/5/6/7. |
| 17-22 | Supabase/Stripe/Vercel/crons/auditoria final | Não iniciado | Exige acesso/validação fora do repo (dashboard Supabase, Vercel, Stripe) — não pode ser confirmado só por código. Deploys de produção das Etapas 2/3/9/15 já foram confirmados via API do GitHub (deployments), então a parte "Vercel produção" dessas etapas específicas está ok. |

## Testes executados (última rodada, após merge do PR #159)
- `npm test` completo: 3 falhas, todas pré-existentes desde o início da sessão, confirmadas via `git stash` como não relacionadas a nenhuma mudança feita:
  - `tests/speechRecognitionPermission.test.ts` — "permissão já concedida inicia reconhecimento diretamente e encerra esse ramo"
  - `tests/monthlyGuidanceContract.test.ts` — regex `main_focus:` não bate / "prompt da orientação usa somente contexto mensal compactado e permitido"
- `npm run typecheck`: limpo.
- `npm run lint`: limpo.
- `npm run build`: limpo.

## Erros encontrados e resolvidos
- Lock de git órfão (`index.lock`) apareceu 3 vezes durante a sessão, sempre de um processo de auto-push local que não estava mais rodando (ver memória `autopush_interferencia`). Removido com segurança após confirmar (via `Get-Process`) que nenhum processo git estava ativo. Se isso continuar acontecendo, vale investigar/desligar o loop de auto-push local em vez de remover o lock toda vez.
- `node --experimental-strip-types` (usado pelo `npm test`) exige extensão de arquivo explícita em imports relativos (ESM estrito), diferente do Vite. Módulos novos em `src/lib` que importam outros módulos de `src/lib` precisam do sufixo `.ts` no import (ex.: `supportSla.ts` importa `./officialPlans.ts` com extensão).
- PRs precisam estar atualizados com a `main` antes de mesclar (branch protection "BEHIND" bloqueia merge mesmo com CI verde) — usar `gh api .../pulls/N/update-branch -X PUT` e aguardar o CI rodar de novo.

## Decisões arquiteturais tomadas
- SLA de suporte tem fonte única (`supportSla.ts`); o SLA de 7 dias da Orientação Mensal (`AdminGuidanceRequests.tsx`) é um domínio diferente e não foi tocado.
- `records_summary` do Plano de Autocuidado não foi migrado/unificado entre os dois formatos (snake_case/camelCase) — resolvido por normalização na leitura (`carePlanBasis.ts`) para não arriscar a Edge Function de geração.
- Cada etapa vira um PR pequeno e focado, mesclado só depois de CI verde — nunca push direto na `main`, conforme CLAUDE.md.
- Merge de PR (mesmo com CI verde) segue pedindo confirmação explícita do usuário na primeira vez que uma nova categoria de risco aparece (aqui, o usuário já confirmou o padrão "várias etapas pequenas, PR por etapa, merge após CI verde" — próximas etapas do mesmo padrão de risco seguem sem reconfirmar a cada uma).

## PRÓXIMA AÇÃO A EXECUTAR
1. Mesclar este PR de atualização do checkpoint (baixíssimo risco, só doc).
2. Iniciar Etapa 6/7 (Admin Usuários escalável) — MAIOR item pendente e crítico segundo o super-prompt. Abordagem recomendada, em fatias pequenas e seguras:
   a. Criar migration com RPC(s) de agregados server-side (total de usuários, novos no mês, pagantes, bloqueados, com desconto, unlimited_access, tickets abertos, por plano, cancelados) — sem tocar a query atual ainda.
   b. Trocar só os cards de resumo do topo para consumir a nova RPC (PR pequeno, testável isoladamente).
   c. Implementar paginação server-side da listagem principal (page/pageSize/totalCount/busca/filtros) — PR separado, maior risco, testar bem.
   d. Só depois, se ainda houver orçamento, começar a extrair sub-componentes/tabs do drawer (`AdminUserDrawer`, tabs por área) — puramente mecânico, comportamento idêntico.
3. Alternativa mais rápida caso Etapa 6/7 se mostre grande demais para a sessão atual: Etapa 5 (mostrar data prevista de resposta na Orientação Mensal — pequena, já tem a função `responseDueDate` pronta) ou Etapa 4 (feedback por ação do plano — precisa de 1 migration nova + RLS + UI, tamanho médio).
4. Etapas 17-22 (Supabase/Stripe/Vercel/crons ao vivo, auditoria final) ficam por último, quando o código estiver mais estável.

## STATUS: MISSÃO EM ANDAMENTO (não concluída) — 4 de 22 etapas concluídas nesta sessão (2, 3, 9-parcial, 15), 3 PRs mesclados e deployados em produção.
