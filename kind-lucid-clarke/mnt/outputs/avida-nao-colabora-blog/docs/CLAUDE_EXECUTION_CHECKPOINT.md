# CLAUDE_EXECUTION_CHECKPOINT.md

> Memória operacional das missões de finalização/hardening do projeto.
> Ler este arquivo primeiro ao retomar. Não repetir etapas marcadas ✅.

## Missão atual — continuação ZIP 76
Ordem autorizada: P1 restante → P2 → P3 → validações live/documentação/auditoria final.
Regra principal: auditar a `main` real antes de cada item, trabalhar em PRs pequenos e só mesclar com gates verdes.

## Última `main` conhecida
- Commit: `5f937d4827779a4e79658a7048aefea67081d225`
- Merge: PR #181 — `hotfix(auth): impedir carregamento infinito no bootstrap`
- Data: 2026-08-27/28 (America/Sao_Paulo)
- Sincronizada e validada nesta sessão: `npm test`/`typecheck`/`lint`/`build` limpos
  (mesmas 3 falhas pré-existentes de sempre, sem novas). Hash do bundle local
  bate com o servido em produção (`index-B6xdtYGT.js`) — confirmado ao vivo.

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
8/9. ✅ Verificador de consistência e Stripe Audit dinâmico — PR #170.
10. ✅ Superfícies do catálogo + correção da mutação global real de Meu Plano — PR #173, merge `d8d63965e82ef99c4079954212ba12295ad54eea`.

## P2 — EM ANDAMENTO
11. ✅ Templates do Suporte com preços dinâmicos — PR #175, merge `daf468c5ffb1ec3ebd331589cd97d8da84c5a36f`.
12. ✅ Suporte com anexos privados + RLS — PR #176, merge `38d4d636eeaf043cfbe8ae9947eaab2111dda551`.
13. ✅ Categorias oficiais de Suporte — PR #177, merge `9bee222df6c14af76ef3a783dc004c07569b5bb8`.

14. ✅ Feedback estruturado por ação do Plano de Autocuidado, sem gamificação.
   - PR #178, merge `035c605edd60f4a85e13eeb45642d6ec67d90e8c`.
   - tabela `care_plan_action_feedback` com RLS, trigger e feedback reversível por microação.
   - opções: `helpful` = Fez sentido; `later` = Talvez depois; `not_for_me` = Não combinou comigo.
   - sem conclusão, pontos, streak, ranking ou meta de produtividade.
   - próximo roteiro usa somente feedback estruturado do último plano enviado como preferência, nunca como eficácia/progresso.
   - `self_care_plan_v3` ativo no runner `run-emotional-automations` v65.
   - migration aplicada live e Vercel produção READY.
   - validação live detectou grants excessivos herdados em `authenticated`; corrigidos no PR #179, merge `ee2059d4d8a03e8ed487b7e8483e5e592b14d078`.
   - banco live confirmado: `authenticated` possui somente SELECT/INSERT/UPDATE/DELETE; `anon` sem acesso; RLS/policies/trigger ativos.
   - `main` CI verde; domínio oficial HTTP 200; sem error/fatal recente no Vercel.

15. ✅ Feedback da Orientação Mensal, sem virar chat infinito — PR #180, merge `adf244509f723ef5f4404540664a3360fe2006d2`.
   - `monthly_guidance_requests` já limita o produto a uma solicitação mensal e uma resposta final revisada.
   - nova tabela `monthly_guidance_feedback` guarda uma única avaliação por orientação respondida.
   - avaliação reversível e estruturada: `helpful`, `partial`, `not_for_me` + até 3 tags permitidas.
   - sem textarea, mensagem livre, réplica ou reabertura do atendimento.
   - UI só aparece depois de `answered` e deixa explícito que o retorno não abre nova conversa.
   - grants mínimos definidos na migration: authenticated somente CRUD; anon sem acesso.
   - correção associada: aviso do mês deixa de dizer “em análise” quando a orientação já está respondida.
   - CI verde, merge confirmado, produção deployada.

## Incidente resolvido nesta sessão (fora da lista de etapas, prioridade máxima)
**Loading infinito no bootstrap de autenticação** — usuário reportou blog e Admin travados em “Carregando...” sem conseguir logar. Diagnóstico: chamadas de sessão/token do Supabase Auth com latência anormal, e `useAuth()` mantinha `loading=true` indefinidamente até `getSession()`+perfil terminarem, sem timeout algum.
- Correção: PR #181, merge `5f937d4827779a4e79658a7048aefea67081d225`. Timeout defensivo de 8s libera o shell mesmo se o Auth travar; quando a sessão já é conhecida, o perfil termina de carregar em segundo plano sem bloquear a tela.
- Doc do incidente: `docs/incident-auth-loading-20260827.md`.
- Verificado ao vivo nesta sessão (Browser): `/diario` e `/admin` carregam normalmente, telas de login renderizam, zero erro no console, todas as requisições 200. **Confirmado resolvido.**

## P2 restante depois do item 15
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
PRs desta missão já concluídos: #164, #165, #167, #168, #170, #172, #173, #175, #176, #177, #178, #179, #180, #181.
PRs relevantes da missão anterior: #157 (SLA), #158 (limpeza + IA invisível), #159 (Base deste plano), #163 (previsão da Orientação).

## PRÓXIMA AÇÃO A EXECUTAR
1. Item 16 (P2) — evolução longitudinal dos questionários, linguagem não clínica.
2. Depois, itens 17-19 (P2) na ordem do prompt de continuação.
3. Depois, P3 (itens 20-22).
4. Por último, validações fora do código (Supabase live, Stripe estrutural, Vercel, docs, auditoria final de 40 áreas).

## STATUS
**P0 ✅ completo | P1 ✅ completo | P2: itens 11-15 ✅ completos, restam 16-19 | Incidente de produção (loading infinito) ✅ resolvido e verificado ao vivo.**
