# A Vida Não Colabora

Plataforma brasileira de bem-estar emocional e conteúdo editorial, com diário, check-in, mapa emocional, relatórios, conteúdos guiados, plano de autocuidado, orientação mensal e blog com automações de IA.

> **Fonte de verdade:** a branch `main` atual. Claude, Codex e ChatGPT devem sempre sincronizar a `main` antes de alterar o projeto e preservar os testes/contratos existentes.

## Jornada do produto

```text
Registrar → Visualizar → Entender → Planejar → Receber apoio
```

- **Diário** registra o que aconteceu.
- **Mapa emocional** mostra padrões e evolução a partir dos registros.
- **Relatório semanal** resume a semana para Essencial e Plus.
- **Relatório mensal aprofundado** aprofunda o mês para Plus.
- **Plano de autocuidado** transforma a leitura mensal em pequenos passos e passa por revisão antes de ser liberado.
- **Orientação mensal** acolhe uma pergunta específica do usuário Plus e passa por revisão humana.
- **Conteúdos guiados** oferecem exercícios, reflexões, pausas emocionais e recursos de apoio não clínico.

## Planos oficiais

### Gratuito
- Check-in rápido ilimitado.
- Diário básico limitado a 5 registros/mês e 1 registro principal/dia.
- Conteúdo público e recursos básicos.
- Sem relatório semanal/mensal, plano de autocuidado ou orientação mensal.

### Essencial
- Tudo do Gratuito.
- Diário completo e complementos.
- Histórico e Mapa Emocional completos.
- Relatório semanal automático.
- Conteúdos guiados completos.

### Plus
- Tudo do Essencial.
- Campos avançados e gatilhos reais (`trigger_tags`).
- Relatório mensal aprofundado.
- Plano de autocuidado mensal com revisão.
- Comentário profissional do relatório mensal.
- Orientação mensal por mensagem, solicitada pelo usuário e revisada antes do envio.

Nomes antigos como **Terapêutico**, **Terapêutico Plus**, **Trilhas**, **Caixa de Cuidado** e **Meditações** podem existir apenas em aliases/migrations históricos de compatibilidade; não devem voltar como nomenclatura principal do produto.

## Stack

- React 18 + TypeScript + Vite + Tailwind CSS.
- Supabase: Auth, PostgreSQL, RLS, Storage, pg_cron, pg_net e Edge Functions.
- Stripe server-side via Edge Functions.
- Vercel para frontend.
- GitHub Actions para CI, migrations e deploy de Edge Functions.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Variáveis públicas do frontend ficam no `.env`/Vercel, principalmente:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Não coloque `service_role`, chaves Stripe secretas ou chaves de IA no frontend.** Secrets de servidor ficam no Supabase/GitHub Actions conforme o fluxo de deploy.

## Validação obrigatória

Antes de merge/publicação:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

O CI oficial em `.github/workflows/ci.yml` executa essas etapas em Pull Requests e na `main`.

Os testes cobrem, entre outros pontos:

- matriz Gratuito / Essencial / Plus;
- planos legados e `unlimited_access`;
- paywall;
- primeiro ciclo semanal/mensal após ativação;
- cron/notificação de relatórios;
- personalização moderna;
- automações editoriais e seus comportamentos distintos.

## Automações editoriais

A Edge Function `run-automations` possui quatro executores reais:

- `generate_daily` → gera **1 artigo completo**.
- `generate_weekly_package` → gera **um pacote de vários artigos**.
- `generate_pauta` → cria **ideias para as próximas duas semanas** no Calendário Editorial, sem criar artigos.
- `monthly_pauta` → cria **planejamento editorial do próximo mês** no Calendário Editorial.

Artigos em `auto_publish` só são publicados se passarem pela validação determinística de conteúdo, SEO e imagem. Caso contrário, ficam em rascunho com o motivo do bloqueio.

A autenticação do cron editorial é automática por `automation_token`. **Não configure `service_role_key` manualmente no Vault para esse fluxo.**

## Automação emocional

`run-emotional-automations` gera os artefatos fechados de acordo com o plano e a data de ativação:

- semanal → Essencial + Plus;
- mensal aprofundado → Plus;
- plano de autocuidado → Plus, com `pending_review` antes de ser enviado.

O Mapa Emocional não depende de geração por IA: ele é calculado a partir dos registros do usuário.

Categorias de dados emocionais são distintas:

```text
emotional_tags   = marcadores emocionais
trigger_tags     = gatilhos reais
context_tags     = contextos
need_tags        = necessidades
care_action_tags = ações de cuidado
```

Nunca tratar `emotional_tags` como gatilhos.

## Saúde do sistema

O Admin possui diagnóstico de infraestrutura e automações. As RPCs administrativas incluem:

- `get_emotional_automation_health()`;
- `get_editorial_automation_health()`.

Elas expõem status, agenda e últimas execuções **sem retornar tokens ou secrets**.

## Migrations e Edge Functions

Não aplique uma lista antiga de migrations manualmente. O repositório possui workflows oficiais:

- `.github/workflows/apply-migrations.yml`;
- `.github/workflows/deploy-supabase-functions.yml`.

Toda nova migration deve ser idempotente quando possível e passar pela validação do projeto antes de chegar à produção.

## Pagamentos

Stripe é server-side. Fluxos críticos existentes devem ser preservados:

- `create-checkout`;
- `stripe-webhook`;
- `manage-subscription`.

Não refatore Stripe como parte de tarefas de Diário, IA, conteúdo, relatórios ou Admin sem necessidade explícita.

## Regras de colaboração — Claude + Codex + ChatGPT

1. Sempre atualizar/sincronizar a `main` antes de começar.
2. Ler o arquivo atual antes de alterar; não recriar uma implementação paralela.
3. Não fazer reset/force push da `main`.
4. Não ressuscitar nomes/recursos legados a partir de documentos antigos.
5. Se mudar planos, períodos, automações ou permissões, atualizar os testes no mesmo PR.
6. Não remover compatibilidade histórica sem verificar dados já existentes.
7. Não declarar uma tarefa concluída se `test`, `typecheck`, `lint` ou `build` falharem.

## Estrutura principal

```text
src/
  components/
  components/admin/
  hooks/
  lib/
  lib/aiPrompts/

supabase/
  functions/
  migrations/

tests/
```

Documentação histórica deve ficar em `docs/archive/` e não deve ser usada como especificação atual sem conferência com este README e com o código da `main`.
