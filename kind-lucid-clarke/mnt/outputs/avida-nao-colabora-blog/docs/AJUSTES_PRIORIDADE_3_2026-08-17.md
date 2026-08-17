# Prioridade 3 — Robustez e validação contínua

## Implementado

- Testes automatizados com o runner nativo do Node 22, sem adicionar dependências de teste.
- Matriz de planos Gratuito/Essencial/Plus, legados e acesso ilimitado.
- Testes de paywall e períodos semanal/mensal com ativação no meio do ciclo.
- Testes de contrato para cron emocional, notificações após persistência, personalização e thresholds do mensal.
- Workflow oficial `.github/workflows/ci.yml` com `npm ci`, testes, typecheck, lint e build.
- RPC administrativa `get_emotional_automation_health()` para consultar cron real, agenda, trigger de notificação e última execução sem expor segredos.
- A própria migration falha explicitamente se `run-emotional-automations` ou `reports_notify_after_persist` não estiverem ativos no Supabase.
- `monthly_summary` do Essencial corrigido no servidor para `target_area = resumo`, inclusive tarefas já existentes.
- O primeiro CI encontrou apenas um resíduo de lint (`const tipo` sem uso) na automação editorial; ele foi removido antes da publicação.

## Regra de colaboração

Claude, Codex e ChatGPT devem tratar a `main` como fonte de verdade e preservar estes testes. Qualquer mudança futura em planos, períodos, crons, notificações ou automações deve atualizar os testes no mesmo commit.
