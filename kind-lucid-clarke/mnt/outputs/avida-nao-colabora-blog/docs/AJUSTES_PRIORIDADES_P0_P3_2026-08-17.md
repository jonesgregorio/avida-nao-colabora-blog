# Ajustes consolidados — P0 a P3 — 17/08/2026

Esta rodada continua o trabalho conjunto Claude + Codex + ChatGPT sobre a base atual, sem alterar Stripe, checkout, webhook, assinaturas ou cobrança.

## P0 — críticos

- `run-automations` agora possui comportamentos reais distintos:
  - `generate_daily`: 1 artigo completo;
  - `generate_weekly_package`: pacote de 2–4 artigos em uma única geração textual;
  - `generate_pauta`: 3–10 ideias distribuídas nas próximas duas semanas;
  - `monthly_pauta`: 8–20 ideias distribuídas no próximo mês.
- Pautas são gravadas em `editorial_calendar` como `ideia`; não criam artigos falsamente.
- Artigos continuam passando pela validação determinística antes de `auto_publish`.
- UI de Automações ganhou quantidade, descrição por tipo e destino correto do resultado.
- Instrução manual antiga de `service_role_key` foi removida; a UI documenta `automation_token` automático.
- Novos testes verificam comportamento, quantidade e calendário de cada automação.
- Foram adicionados `CONTRIBUTING.md`, PR template e CODEOWNERS. A proteção efetiva da `main` ainda depende da configuração de branch/ruleset do GitHub.

## P1 — lançamento/observabilidade

- `get_emotional_automation_health()` foi ligado ao Saúde do Sistema.
- Nova RPC `get_editorial_automation_health()` informa cron, agenda, última execução, regras ativas e erros sem expor segredos.
- Cron editorial foi reagendado com timeout de 120s para suportar pacote de artigos.
- README oficial foi reescrito com planos Gratuito/Essencial/Plus, jornada atual, automações e regras Claude/Codex/ChatGPT.
- Suite automatizada expandida de 16 para 33 testes nesta rodada local.
- CI ganhou `npm audit --omit=dev --audit-level=high` para vulnerabilidades de produção.

## P2 — robustez técnica

- CI prepara Deno e executa `deno check` nas Edge Functions ativamente alteradas nesta rodada; funções legadas são tratadas em manutenção própria para não misturar risco de Stripe/pagamentos.
- Helpers `has_active_unlimited_access` e `effective_plan_for_user` foram endurecidos para impedir que usuário autenticado consulte UUID de terceiro, preservando service_role/admin.
- Períodos de relatórios usam explicitamente `America/Sao_Paulo`, inclusive perto da virada UTC.
- IA emocional ganhou failover: Gemini → Groq → OpenAI → fallback determinístico.
- Versões e regras de segurança dos prompts emocionais foram centralizadas em `_shared/emotionalPromptContracts.ts`, importado pelo frontend e pela Edge Function.

## P3 — organização e clareza

- “Comentário profissional” foi renomeado nas áreas principais para “Comentário profissional sobre o relatório” e diferenciado da “Orientação mensal por mensagem”.
- Scripts antigos `.bat/.ps1`, log, ZIP de produção antigo e lockfile raiz obsoleto foram removidos.
- Auditorias/documentos históricos de raiz foram movidos para `docs/archive/repository-legacy/` com aviso explícito de que não são especificação atual.
- README atual passa a ser referência oficial de produto/arquitetura junto ao código e testes.

## Validação local desta rodada

- `npm test`: **33/33 PASS**.
- Parser TypeScript/TSX: **171 arquivos, 0 erros de sintaxe**.
- `npm audit`, build/typecheck/lint completos dependem de instalação de dependências; o ambiente local desta rodada não conseguiu alcançar o registry npm. O CI foi reforçado para executar essas validações em ambiente GitHub antes de merge.

## Pendência externa que não é resolvida por código

A proteção real da branch `main` precisa ser habilitada em GitHub Settings/Rulesets com:

- Pull Request obrigatório;
- CI obrigatório;
- bloquear force push;
- idealmente exigir branch atualizada antes de merge.

Os arquivos de colaboração foram preparados, mas não substituem essa configuração do GitHub.

## Complementos finais desta rodada

- Falhas de automação editorial não contam mais como execução concluída; a regra é reagendada para tentativa no próximo ciclo horário.
- Frequência mensal passa a calcular o próximo ciclo por mês de calendário em vez de somar apenas 30 dias.
- Healthchecks agora detectam cron ativo porém sem execução recente.
- Painel de Saúde do Sistema ganhou indicadores operacionais agregados (relatórios, fallbacks, planos/orientações pendentes, artigos bloqueados e erros de IA).
- Contratos narrativos da IA emocional foram movidos para o módulo compartilhado junto com versões e regras de segurança.
- Dependabot configurado para atualizações controladas via PR.
- Documentos históricos do projeto foram arquivados e a pasta temporária de branding foi removida.
- Suite automatizada final: **33/33 PASS** nesta rodada local.
