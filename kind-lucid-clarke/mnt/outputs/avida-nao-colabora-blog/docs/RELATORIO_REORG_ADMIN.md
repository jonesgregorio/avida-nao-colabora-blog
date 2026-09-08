# Relatório — Reorganização, simplificação e correção do Admin

Branch: `claude/admin-reorg` (empurrada; **sem merge, sem deploy**).
Commits: `f28178c`, `92ff16f`, `f598ba4`, `9526e9f`.

---

## 1. Alterações realizadas

### Menu lateral (8 grupos)
`AdminLayout.tsx` → `NAV_GROUPS` reescrito:

| Grupo | Áreas |
|---|---|
| Visão geral | Dashboard |
| Pessoas | Usuários, Segmentação, **Engajamento** (inalterado) |
| Negócio | Assinaturas, Financeiro |
| Conteúdo | Conteúdo, Estúdio de Conteúdo |
| Cuidado | Cuidado |
| Relacionamento | Comunicação, Suporte |
| Análise | Analytics |
| Administração | Sistema |

`AREA_MODULE` (filtro RBAC do menu) atualizado: `assinaturas→finance`, `financeiro→finance`, `cuidado→content`.

### Analytics — de ~12 abas para 5 áreas
`AnalyticsPage.tsx` reescrito com navegação de 5 áreas:
**Visão geral / Aquisição / Conteúdo / Conversão / Retenção.**

- Funil, Jornada, Conversão e Retenção deixaram de ser abas soltas e repetidas — cada uma vive na sua área (`AdminJourneyFunnel` em Aquisição, `AdminConversionFunnel` em Conversão, `AdminRetentionAnalytics` em Retenção, jornada de ciclo de vida em Retenção).
- `AnalyticsPageLegacy` ganhou props `only={[...]}` e `hideHero` para ser reaproveitado por área sem duplicar hero/navegação. **Todo o código de render e todas as consultas continuam no arquivo.**

### Conteúdo
`AdminAreaConteudo.tsx`: "Site & páginas" (`AdminSiteContent`) migrou de Comunicação para **Conteúdo → Biblioteca → "Home & páginas"**, ao lado de Categorias, Mídia, SEO e Depoimentos. Continuam 5 grupos (Produção / Planejamento / Automação / Biblioteca / Inteligência).

### Comunicação — de 6 abas para 3
`AdminAreaComunicacao.tsx`: **Campanhas / Automáticas / Histórico.**
"Templates de e-mail", "Criador com IA" e "Notificação avulsa" deixaram de ser áreas próprias e viraram **ferramentas** abertas em modal a partir da área. Mecanismos de envio (`AdminEmails`, `AdminNotifications`, `AdminEmailCreatorIA`, `AdminCommunicationCampaigns`) preservados sem alteração de comportamento.

### Sistema — de 9 abas para 5 áreas
`AdminAreaSistema.tsx` reescrito: **Monitoramento / Integrações / Recursos / Administradores / Auditoria.**
- Monitoramento unifica Saúde, Filas e falhas, Automações e **IA (uso e falhas)**.
- Integrações unifica serviços + Infra & externas.
- Recursos unifica Liberação progressiva + Feature flags.
- Administradores = papéis e permissões (RBAC preservado).
- Auditoria = registro de ações.

### Central de IA
Migrou de "IA Emocional" para **Sistema → Monitoramento → IA** (`AdminAIUsage`). O atalho "Central de IA" em Conteúdo → Inteligência agora navega para lá (`localStorage.setItem('admin-sistema-tab','ia'); navigate('sistema')`).

### Cuidado (nova área)
`AdminAreaCuidado.tsx` (novo): funde "IA Emocional" + "Diário e Mapa Emocional".
Abas: **Diário & Check-ins / Questionários / Relatórios / Autocuidado / Orientações / Recomendações.**
Sem monitoramento técnico de IA dentro.

### Assinaturas (nova área)
`AdminAreaAssinaturas.tsx` (novo): **Cancelamentos / Planos / Alterações de plano.**
`AdminPlanChanges.tsx` (novo): tabela real de `plan_change_history` (200 mais recentes) com nomes dos perfis.
**Toda a lógica de cancelamento preservada** (`AdminCancellations` intacto: solicitação/aprovação/resposta/Stripe/`cancel_at_period_end`/ciclo/retenção/status/histórico).

### Financeiro
`AdminFinanceiro.tsx` — sem alteração. Já cumpre o papel de **análise** (receita, MRR, churn, receita perdida, motivos de cancelamento, reembolsos via `AdminRefund`). A **operação** de cancelamento vive só em Assinaturas.

### Dashboard
`AdminOverview.tsx` — sem alteração. Já é executivo: KPIs (`AdminOperationalDashboard`), pendências, atividade recente e **"Saúde do sistema" como resumo** (5 indicadores) com link "Ver detalhes do sistema" → `system-health` (redireciona para Sistema → Monitoramento → Saúde).

---

## 2. Funcionalidades unificadas

- Analytics: Funil/Jornada/Conversão/Retenção → uma ocorrência cada, dentro da área correspondente.
- Sistema/Monitoramento: Saúde + Filas + Automações + IA (uso/falhas).
- Sistema/Integrações: Integrações + Infra & externas.
- Sistema/Recursos: Liberação progressiva + Feature flags.
- Cuidado: IA Emocional + Diário e Mapa Emocional.
- Comunicação: Campanhas de e-mail + notificações no mesmo fluxo.

## 3. Funcionalidades movidas

| De | Para |
|---|---|
| Comunicação → Site & páginas | Conteúdo → Biblioteca → Home & páginas |
| IA Emocional → Central de IA | Sistema → Monitoramento → IA |
| IA Emocional (área) | Cuidado |
| Diário e Mapa Emocional (área) | Cuidado |
| Planos / Cancelamentos (áreas soltas) | Assinaturas |
| Analytics → SEO | Conteúdo → Biblioteca → SEO (fonte única `AdminSEOCockpit`) |

## 4. Removido da interface (dados preservados)

- **Abas do Analytics:** Eventos brutos, SEO (duplicada), Erros técnicos, Relatórios IA, Configurações, Performance/Dispositivos/Heatmap reagrupados. Nenhuma tabela, view, RPC ou evento de analytics foi apagado — só a navegação mudou. Os blocos de render continuam no `AnalyticsPageLegacy.tsx`.
- **Componentes órfãos apagados:** `AdminAreaEmocional.tsx`, `AdminMapaArea.tsx` (não referenciados após a fusão).

Nada de banco, migration, Edge Function, cron ou regra Stripe foi removido.

## 5. Nova estrutura do menu

Ver seção 1. Rotas/aliases legados (`system-health`, `integrations`, `notifications`, `emails`, `questionnaires`, `pdf`, `guidance-requests`, `self-care-plans`, `diary-config`, `central-ia`, `site-content`, `plans`, `cancelamentos`, `mapa`, `emocional`, etc.) redirecionam para a nova área + aba via `LEGACY_MAP` em `index.tsx` (`resolveView` grava o `localStorage` da aba de destino antes de trocar de área).

## 6. Correções de sobreposição / formatação

`admin-theme.css`:
- Os seletores estruturais de "refino de páginas legadas" (`main>div>.flex.items-start.justify-between`, `main>div[class*="max-w-"]>h1:first-child`, `>header`) aplicavam uma **segunda moldura** (gradiente + borda + sombra + padding) por cima das áreas que já usam `.admin-page-hero` / `.admin-page-pad` — causa de moldura dupla / deslocamento. Adicionado `:not(.admin-page-hero)`, `:not(.admin-toolbar)` e `:not(.admin-page-pad)` nesses seletores, inclusive dentro da media query de 900px. Agora só telas legadas recebem o refino automático.
- Auditoria de vazamento: **todos** os seletores do arquivo estão sob `.admin-shell`, `.admin-sidebar` ou `.admin-login-shell`. Não há vazamento para o site público nem para a área do usuário. Os `!important` restantes são sobrepujança intencional de utilitários Tailwind para impor o design system (verde-floresta / creme / off-white / bege) e foram mantidos.

## 7. Correções responsivas

- Áreas novas (`Cuidado`, `Assinaturas`, `Sistema`, `Comunicação`, `Analytics`) usam o padrão do design system: `.admin-page-pad`, `.admin-tabs-wrap` com `overflow-x:auto` (abas rolam na horizontal), `.admin-card` com `min-h-0`, modais `h-[90vh] sm:h-[85vh]` que cabem na viewport.
- `admin-theme.css` mantém os breakpoints existentes (1100 / 900 / 640px) para grade de métricas, padding e tabela; a correção do `:not()` evita regressão de padding do hero em telas médias.

## 8. Arquivos principais modificados

`src/components/admin/`: `index.tsx`, `AdminLayout.tsx`, `types.ts`, `AnalyticsPage.tsx`, `AnalyticsPageLegacy.tsx`, `AdminAreaConteudo.tsx`, `AdminAreaComunicacao.tsx`, `AdminAreaSistema.tsx`, `admin-theme.css` — **novos:** `AdminAreaCuidado.tsx`, `AdminAreaAssinaturas.tsx`, `AdminPlanChanges.tsx` — **apagados:** `AdminAreaEmocional.tsx`, `AdminMapaArea.tsx`.
`tests/`: 10 testes de contrato atualizados para a nova estrutura, preservando a intenção de cada asserção.

## 9. Validações executadas

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sem erros |
| `npm run lint` | ✅ sem erros / warnings |
| `npm run build` | ✅ build ok (28 s) |
| `npm test` | 985 testes — **981 passam**, 3 falham |

Os 3 testes que falham são **pré-existentes** e não têm relação com esta tarefa (são falhas de fim de linha CRLF no Windows que passam no CI Linux): *"ditado e organização preservam o texto original intacto"*, *"prompt da orientação usa somente contexto mensal compactado e permitido"*, *"permissão já concedida inicia reconhecimento diretamente e encerra esse ramo"*. Nenhum dos meus commits toca esses arquivos nem os componentes que eles verificam.

## 10. Limitações que não puderam ser resolvidas nesta passada

- **Auditoria visual "ao vivo" (sobreposição) e responsiva em todas as telas legadas:** o preview do Admin exige login real com MFA/AAL2, que o navegador de verificação não consegue completar. A correção de moldura dupla no CSS foi feita de forma estrutural e o build valida a compilação, mas uma varredura tela a tela em desktop/notebook/tablet/mobile precisa ser feita com uma sessão de admin real. As áreas novas seguem o design system e o padrão responsivo já existente.
- **`AnalyticsPageLegacy.tsx`:** os blocos de render das abas removidas da navegação (`events`, `ai`, `settings`, `errors`) continuam no arquivo como código não acessível pela UI, para não apagar lógica/consultas. Uma limpeza definitiva desse arquivo (extrair cada painel para componente próprio) ficou fora do escopo desta passada por risco de regressão.
- **Engajamento:** conforme instrução, **nenhuma alteração** — nem visual — foi feita em `AdminEngagement`. Não identifiquei sobreposição nele; se houver ajuste puramente visual necessário, é item separado.
