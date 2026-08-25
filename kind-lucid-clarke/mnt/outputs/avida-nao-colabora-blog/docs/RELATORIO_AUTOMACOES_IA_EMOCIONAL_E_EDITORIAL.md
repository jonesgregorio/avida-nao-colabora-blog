# Relatório técnico — Automações e prompts de IA

## Parceria Claude + Codex

Este documento registra o estado das automações após a rodada de ajustes. O projeto é mantido em parceria entre Claude e Codex; alterações futuras devem preservar os contratos abaixo e evitar recriar fluxos paralelos.

## Relatórios emocionais automáticos

### Relatório semanal

- Gerado por: `supabase/functions/run-emotional-automations/index.ts`.
- Planos: `essential` e `plus`.
- Tabela: `reports`.
- Tipo: `weekly`.
- Plano exigido: `essential`.
- Período: semana fechada, domingo a sábado, disponibilizada no ciclo seguinte.
- Idempotência: a função verifica `user_id + report_type + period_start + period_end` antes de gerar novamente.
- Conteúdo: números da semana, marcadores emocionais, contextos, necessidades, ações de cuidado, séries por dia, padrões observados, próximos passos leves e aviso de qualidade dos dados.

### Relatório mensal aprofundado

- Gerado por: `supabase/functions/run-emotional-automations/index.ts`.
- Planos: somente `plus`.
- Tabela: `reports`.
- Tipo: `monthly`.
- Plano exigido: `plus`.
- Período: mês fechado anterior.
- Idempotência: a função verifica `user_id + report_type + period_start + period_end` antes de gerar novamente.
- Conteúdo: linha do tempo do mês, padrões emocionais, marcadores, contextos, necessidades, ações de cuidado, gatilhos reais, indicadores avançados, comparação com mês anterior, dias de atenção, sinais de melhora, perguntas de reflexão e pontes curtas para plano/orientação.
- O relatório mensal não deve conter plano completo nem orientação final.

## Mapa emocional

- Não depende de geração de IA salva.
- É calculado automaticamente a partir dos registros do usuário.
- Fonte principal: `diary_entries`.
- Essencial e Plus veem o mapa completo.
- Plus vê também `trigger_tags` como gatilhos reais e “Conexões do mês”.
- `emotional_tags` são marcadores emocionais, nunca gatilhos.
- `trigger_tags` são gatilhos reais.

## Plano de autocuidado

- Gerado por IA para usuários Plus.
- Tabela: `monthly_care_plans`.
- Fluxo correto atual: IA gera → Admin revisa → Admin envia → usuário visualiza.
- A página do usuário deve exibir apenas planos liberados/enviados conforme status usado pelo sistema.
- Não deve ser enviado automaticamente sem revisão.

## Orientação mensal

- Usuário Plus solicita uma orientação mensal.
- IA gera rascunho estruturado.
- Admin/profissional revisa.
- A resposta final estruturada é salva em `monthly_guidance_requests.final_response_json`.
- `response` textual e `ai_draft_json.final_response` continuam como fallbacks para compatibilidade.
- A tela do usuário prioriza: `final_response_json` → `ai_draft_json.final_response` → `response` textual.

## Prompts emocionais

- Fonte conceitual: `src/lib/aiPrompts/emotionalPrompts.ts`.
- Espelho server-side: `supabase/functions/run-emotional-automations/index.ts`.
- Versões ativas:
  - `weekly_report_v2`;
  - `monthly_deep_report_v2`;
  - `self_care_plan_v2`;
  - `professional_guidance_v1`.
- Todos os prompts devem ser não clínicos, não diagnósticos e em português brasileiro.

## Conteúdos guiados e personalização

- Conteúdos guiados devem usar nomes atuais: exercício de escrita, reflexão guiada, pausa emocional, organização emocional, limites e rotina, autocuidado prático, conteúdo educativo, pequena prática guiada, sequência de cuidado e recurso de apoio emocional.
- `personalizationTasks.ts` não deve sugerir relatório mensal para usuários Essencial.
- Essencial recebe leitura/relatório semanal.
- Plus recebe relatório mensal aprofundado.
- `DailyContentWidget.tsx` e a tabela `automated_contents`/Edge Function `send-automated-emails` (envio do mesmo conteúdo por e-mail para todo usuário elegível todo dia) foram removidos — violavam a regra de não haver "Conteúdo Diário" automático para todos. Conteúdos Guiados (catálogo real, `get_guided_catalog()`) são um sistema diferente e continuam ativos.

## Automações agendadas (cron)

Inventário atual (fonte de verdade: `supabase/migrations/*.sql`, última definição de cada job vence). Nenhum cron aqui distribui o mesmo conteúdo para todo mundo — cada um roda uma tarefa por usuário/plano ou uma tarefa de manutenção.

| Job (`cron.job.jobname`) | Frequência | Dispara | Finalidade | Necessidade atual |
|---|---|---|---|---|
| `run-content-automations` | a cada hora (`0 * * * *`) | Edge Function `run-automations` | Executa as automações editoriais ativas (geração de artigo/pacote semanal/pauta) configuradas em `content_automations`; valida tamanho/SEO/imagem/clichê de IA antes de auto-publicar | Ativo — único caminho de geração automática de artigos |
| `publish-due-scheduled` | a cada 10 min (`*/10 * * * *`) | RPC `publish_due_scheduled()` | Publica artigos com `status='scheduled'` cujo `scheduled_at` já chegou (agendamento decidido previamente por humano/automação, não gera conteúdo novo) | Ativo |
| `run-lifecycle-emails` | diário, 12:00 UTC | Edge Function `run-lifecycle-emails` | E-mails de ciclo de vida por usuário (ex.: inatividade) — não é o mesmo conteúdo pra todos, depende do estado de cada conta | Ativo |
| `run-emotional-automations` | diário, 03:20 UTC | Edge Function `run-emotional-automations` | Gera relatório semanal/mensal e plano de autocuidado por usuário elegível (idempotente por período) | Ativo |
| `sync-monthly-personalization` | mensal, dia 1 às 03:00 UTC | RPC `sync_monthly_personalization()` | Alimenta a fila de personalização por IA (conteúdo recomendado por usuário, não um broadcast) | Ativo |
| `purge-analytics-events` | diário, 03:30 UTC | RPC `purge_old_analytics_events()` | Retenção/expurgo de eventos antigos de analytics | Ativo — manutenção, sem geração de conteúdo |
| `notify-weekly-reports` | domingo, 11:00 UTC | RPC `notify_weekly_reports()` | Notifica cada usuário Essencial+ que seu relatório semanal ficou disponível | Ativo |
| `notify-monthly-reports` | dia 1, 11:00 UTC | RPC `notify_monthly_reports()` | Notifica cada usuário Plus que seu relatório mensal ficou disponível | Ativo |

Status/última execução/último erro de cada job: consultar `cron.job_run_details` (via `get_editorial_automation_health()` para o cron editorial, exposta no Admin) — não reproduzido aqui por ser estado ao vivo, não estático de código.

## Requisitos operacionais

Para que as automações rodem em produção, confirmar no Supabase/GitHub:

1. Edge Functions publicadas.
2. `SUPABASE_ACCESS_TOKEN` configurado no GitHub Actions.
3. `GEMINI_API_KEY` configurada no Supabase para funções que usam IA.
4. Token de automação disponível via `get_automation_token`.
5. Cron/agendamento chamando `run-emotional-automations` nos dias corretos.
6. Workflows `.github/workflows/deploy-supabase-functions.yml` e `.github/workflows/apply-migrations.yml` ativos.

Segredos não devem ser expostos em código, logs ou respostas visíveis.
