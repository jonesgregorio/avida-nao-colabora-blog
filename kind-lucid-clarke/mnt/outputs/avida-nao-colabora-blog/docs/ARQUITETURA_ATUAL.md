# Arquitetura atual — A Vida Não Colabora

Atualizado em 01/09/2026 após conclusão dos itens P2.18–P3.22 e validações live.

## Fonte de verdade

1. `main` atual;
2. testes automatizados + Browser E2E;
3. estado live de Supabase, Stripe e Vercel quando a validação depende de infraestrutura;
4. `README.md`;
5. este documento.

Documentos em `docs/archive` são históricos e não devem substituir o comportamento da `main`.

## Aplicação

- Frontend: React + Vite + TypeScript.
- Hospedagem: Vercel, com produção nos domínios `avidanaocolabora.com` e `www.avidanaocolabora.com`.
- Backend principal: Supabase Auth, Postgres, RLS, Storage, Edge Functions e cron.
- Cobrança: Stripe Billing/Checkout server-side.
- O shell logado usa `UserLayout`; páginas pesadas são carregadas sob demanda.
- A experiência segue divulgação progressiva: primeiro o que importa agora, detalhes técnicos e históricos em camadas secundárias.

## Planos e entitlement

- `free` → Gratuito.
- `essential` → Essencial.
- `plus` → Plus.
- aliases antigos (`therapeutic*`) são normalizados para Plus apenas por compatibilidade de leitura/renovação.
- `unlimited_access` é entitlement administrativo e não cria um quarto plano comercial.
- preços live atuais no Stripe: Essencial R$ 19,90/mês e Plus R$ 39,90/mês.

## Autenticação e segurança de conta

- senha nova mínima: 8 caracteres no cadastro, Perfil, troca obrigatória e configuração hosted do Supabase;
- login não impõe artificialmente 8 caracteres no campo, preservando credenciais legadas existentes;
- MFA administrativo continua obrigatório e depende de AAL2;
- usuário comum pode ativar MFA TOTP opcional no Perfil;
- quando há fator TOTP verificado, sessão AAL1 passa pelo gate de MFA antes da área logada, inclusive depois de recuperação/troca de senha;
- RLS é a barreira principal de acesso aos dados de usuário;
- todas as tabelas do schema `public` estão com RLS habilitado no ambiente live auditado;
- funções `SECURITY DEFINER` live auditadas possuem `search_path` fixado.

## Fluxo emocional

```text
Check-in / Diário
  ↓
Descobertas + Mapa Emocional
  ↓
Relatório semanal (Essencial + Plus)
  ↓
Relatório mensal aprofundado (Plus)
  ↓
Plano de autocuidado (Plus, IA → pending_review → Admin → sent)
  ↓
Orientação mensal (Plus, solicitação → IA draft → revisão humana → final_response_json)
```

Categorias de dados não são intercambiáveis:

- `emotional_tags`: marcadores emocionais;
- `context_tags`: contextos;
- `need_tags`: necessidades;
- `care_action_tags`: ações de cuidado;
- `trigger_tags`: gatilhos reais.

O Mapa Emocional permite comparação livre entre dois meses usando dados estruturados e resumo textual acessível. A comparação é descritiva e não apresenta diferença como diagnóstico, melhora ou piora clínica.

## IA emocional

- cálculos/contagens são determinísticos;
- IA produz narrativa, nunca inventa números;
- versões/regras compartilhadas ficam em `supabase/functions/_shared/emotionalPromptContracts.ts`;
- conteúdo de IA destinado ao usuário passa pelos contratos de linguagem não clínica e pelos fluxos de revisão previstos para cada módulo;
- texto livre do Diário não deve aparecer em superfícies que foram desenhadas para usar somente sinais estruturados.

## Privacidade e portabilidade

- exportação usa a Edge Function `export-user-data` como única coleta;
- o navegador empacota a resposta em ZIP;
- `dados-completos.json` preserva a exportação integral;
- CSVs, PDF-resumo e LEIA-ME são representações auxiliares;
- exclusão de conta e preferências de privacidade continuam disponíveis no Perfil conforme regras próprias.

## Conteúdo editorial

`run-automations` possui execuções distintas para geração diária, pacote semanal, pauta e planejamento mensal.

Pautas ficam em `editorial_calendar`; não criam artigos por si só. Conteúdo automático segue o fluxo de validação/revisão previsto antes de publicação ou entrega ao usuário.

## Admin

- Admin exige MFA/AAL2 para operações privilegiadas.
- `AdminUsers` usa paginação server-side de 40 usuários por página.
- filtros de busca/plano/status/acesso são aplicados antes da paginação.
- totais globais vêm de RPC separada.
- tickets abertos, notificações não lidas e última atividade são agregados no servidor apenas para a página atual.
- exportação administrativa busca lotes de até 200 somente quando solicitada.
- deep-link para usuário busca o registro diretamente no servidor quando ele não está na página corrente.
- RPCs `admin_list_users_v2` e `admin_users_stats_v2` são `SECURITY DEFINER`, validam `public.is_admin()` e não são executáveis por `anon`.

## Stripe / cobrança

Cobrança permanece server-side.

Fluxos estruturais atuais:

- checkout cria assinatura e não libera plano pelo cliente;
- upgrade altera a assinatura existente e usa `proration_behavior = always_invoice`; o plano superior é confirmado pelo webhook;
- downgrade usa Subscription Schedule para troca no fim do ciclo;
- cancelamento usa `cancel_at_period_end` e mantém acesso até a fronteira do ciclo;
- reativação remove cancelamento agendado e libera schedule de downgrade quando aplicável;
- webhook valida assinatura, trata os seis eventos oficiais e reserva `event.id` em `stripe_webhook_events` para idempotência;
- falha crítica remove a reserva para permitir retry do Stripe;
- endpoint live do webhook está habilitado para checkout, criação/atualização/exclusão de assinatura e sucesso/falha de invoice.

A auditoria final não cria cobranças reais: valida código, configuração live e histórico existente em modo leitura.

## Automações e observabilidade

- `get_emotional_automation_health()`;
- `get_editorial_automation_health()`;
- Admin → Saúde do Sistema;
- crons live auditados para publicação agendada, personalização mensal, lifecycle e-mails, limpeza de analytics, relatórios e automações emocionais/editoriais;
- execuções observadas nos últimos 7 dias estavam com status `succeeded`.

## CI e deploy

Pull Requests devem passar por:

```text
npm ci
npm audit --omit=dev --audit-level=high
npm test
npm run typecheck
deno check
npm run lint
npm run build
Browser E2E
```

Fluxo de entrega adotado:

1. preparar e revisar o pacote antes da branch sempre que possível;
2. abrir PR pequeno;
3. aguardar CI + Browser E2E;
4. merge somente verde;
5. Vercel Production automática pela integração Git;
6. migrations pela automação do repositório, nunca por deploy manual ad hoc;
7. validar Production READY, domínio HTTP 200 e runtime sem `error/fatal`.

## Estado validado em 01/09/2026

- P2.18 senha mínima: concluído;
- P2.19 exportação legível: concluído;
- P3.20 MFA opcional: concluído;
- P3.21 comparação livre: concluído;
- P3.22 AdminUsers escalável: concluído;
- Supabase live: RLS habilitado em todas as tabelas `public`; crons ativos auditados; `SECURITY DEFINER` sem `search_path` solto; migration P3.22 aplicada;
- Stripe live: produtos/preços oficiais ativos, webhook habilitado, histórico existente coerente com assinatura/cobrança; nenhuma cobrança foi criada pela auditoria;
- Vercel: produção READY, domínio oficial HTTP 200, sem `error/fatal` no recorte final auditado.

A avaliação detalhada por área está em `docs/AUDITORIA_FINAL_40_AREAS_2026-09-01.md`.
