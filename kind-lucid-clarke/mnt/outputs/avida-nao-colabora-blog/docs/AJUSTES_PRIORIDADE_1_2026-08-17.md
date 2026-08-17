# Ajustes Prioridade 1 — 17/08/2026

## Regra de colaboração

Esta rodada foi feita de forma incremental sobre o ZIP 64, preservando o trabalho existente de Claude/Codex. Nenhum arquivo de Stripe, checkout, webhook ou cobrança foi alterado.

## 1. Primeiro ciclo de relatórios após ativação

`run-emotional-automations` agora lê `profiles.plan_activated_at` e limita o início do primeiro ciclo fechado à data de ativação:

- semanal: ativação no meio da semana → início na ativação, fim no sábado;
- mensal Plus: ativação no meio do mês → início na ativação, fim no último dia;
- se a ativação ocorreu depois do período fechado, o artefato não é gerado;
- comparação com mês anterior não usa dados de antes da ativação premium;
- o primeiro plano de autocuidado segue o mesmo recorte mensal.

## 2. Acesso ilimitado como entitlement Plus

Foi criado um conceito de plano efetivo sem alterar o plano comercial/cobrança:

- `has_active_unlimited_access()` e `effective_plan_for_user()` no banco;
- `getEffectivePlan()` no frontend;
- `unlimited_access_until` é respeitado;
- relatórios, plano de autocuidado, orientação, artigos premium, questionários e diário usam o entitlement efetivo;
- automação emocional inclui usuários com acesso ilimitado ativo como Plus;
- personalização mensal e rascunhos personalizados também reconhecem o entitlement Plus;
- o Admin preserva e edita corretamente data de validade e motivo do acesso ilimitado.

## 3. Notificação apenas após relatório persistido

O ZIP 64 já continha a correção `20260816060131_notify_reports_only_after_persist.sql`. Ela foi auditada e preservada:

- trigger notifica somente após `reports.status = 'generated'`;
- os crons antigos atuam apenas como backfill de relatórios já existentes;
- um relatório que falhou antes de ser salvo não pode gerar aviso de “disponível”.

## 4. Personalização com tags modernas do Diário

`run-automations` agora agrega:

- `emotional_tags`;
- `context_tags`;
- `need_tags`;
- `care_action_tags`;
- `trigger_tags` apenas para Plus;
- `mood_score`/`mood`.

Os prompts recebem somente dados agregados, sem texto íntimo livre do Diário.

## 5. Automações editoriais sem executor

A UI de Automações do Blog só permite criar/ativar tipos com executor real em `run-automations`:

- `generate_daily`;
- `generate_weekly_package`;
- `generate_pauta`;
- `monthly_pauta`.

Tipos legados sem executor ficam identificados como legados, não podem ser executados/reativados e uma migration pausa regras antigas ativas desse grupo.

## 6. Auto-publicação de artigos com validação

A geração automática agora solicita pacote editorial estruturado e valida antes de publicar:

- mínimo de 1000 palavras;
- excerpt;
- SEO title;
- meta description;
- palavra-chave principal e secundárias;
- tags e temas emocionais;
- imagem de capa via Pexels;
- alt da imagem;
- pergunta para diário e CTA;
- tempo estimado de leitura.

Quando `auto_publish` está ativo, o artigo só recebe `published` se todos os requisitos críticos passarem. Caso contrário, é salvo como `draft` com `internal_notes` explicando por que a auto-publicação foi bloqueada.

## Validações executadas nesta rodada

- parser TypeScript em todos os arquivos `.ts/.tsx` de `src` e `supabase/functions`: **164 arquivos, 0 erros de sintaxe**;
- testes determinísticos do recorte do primeiro ciclo: **4/4 casos passaram**;
- checklist estático Prioridade 1: **14/14 verificações passaram**;
- `officialPlans.ts` e `types/index.ts` passaram no compilador TypeScript global isoladamente;
- `npm ci --offline` não pôde concluir porque o cache local não contém todas as dependências; `npm ci` online excedeu o tempo do ambiente. Portanto build/lint completos ainda precisam ser executados em ambiente com dependências instaláveis.

## Arquivos alterados

- `src/App.tsx`
- `src/components/admin/AdminAutomacoesBlog.tsx`
- `src/components/admin/AdminUsers.tsx`
- `src/lib/officialPlans.ts`
- `src/lib/personalizationTasks.ts`
- `src/types/index.ts`
- `supabase/functions/run-automations/index.ts`
- `supabase/functions/run-emotional-automations/index.ts`
- `supabase/migrations/20260817190000_unlimited_access_effective_plus.sql` (novo)

## Arquivo auditado e preservado

- `supabase/migrations/20260816060131_notify_reports_only_after_persist.sql`
