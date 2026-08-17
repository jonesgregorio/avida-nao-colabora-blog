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
- Termos legados de banco são normalizados em `DailyContentWidget` antes da exibição.
- `personalizationTasks.ts` não deve sugerir relatório mensal para usuários Essencial.
- Essencial recebe leitura/relatório semanal.
- Plus recebe relatório mensal aprofundado.

## Requisitos operacionais

Para que as automações rodem em produção, confirmar no Supabase/GitHub:

1. Edge Functions publicadas.
2. `SUPABASE_ACCESS_TOKEN` configurado no GitHub Actions.
3. `GEMINI_API_KEY` configurada no Supabase para funções que usam IA.
4. Token de automação disponível via `get_automation_token`.
5. Cron/agendamento chamando `run-emotional-automations` nos dias corretos.
6. Workflows `.github/workflows/deploy-supabase-functions.yml` e `.github/workflows/apply-migrations.yml` ativos.

Segredos não devem ser expostos em código, logs ou respostas visíveis.
