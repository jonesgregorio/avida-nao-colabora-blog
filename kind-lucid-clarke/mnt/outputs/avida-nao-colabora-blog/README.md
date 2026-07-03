# A Vida Não Colabora — Templo das Palavras

Blog de saúde mental com diário de bem-estar, questionários, planos de autocuidado e conteúdo automatizado.

## Stack

- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind CSS
- **Backend/DB:** Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Pagamentos:** Stripe (webhooks via Edge Functions)
- **Hospedagem:** Vercel (configurado via `vercel.json`)

## Funcionalidades

- Artigos sobre saúde mental (ansiedade, depressão, fibromialgia, autocuidado, escrita terapêutica)
- Questionários de autoavaliação com resultado personalizado
- Diário de bem-estar com registro diário e análise de humor
- Trilhas de conteúdo temático
- Sistema de autenticação completo (cadastro, login, reset de senha, troca forçada)
- 4 planos: Gratuito, Essencial, Terapêutico, Terapêutico Plus
- Mini-desafios e meditações guiadas (planos pagos)
- Questionário aprofundado + plano de autocuidado personalizado (Plano Terapêutico)
- Diário avançado com marcadores (sono, dor, compulsão, gatilhos)
- Perfil com upload de foto
- Suporte via tickets com chat em tempo real
- Painel administrativo completo

## Pré-requisitos

- Node.js 18+
- npm 9+
- Conta no [Supabase](https://supabase.com)
- Conta no [Stripe](https://stripe.com) (para pagamentos)

## Configuração

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd avida-nao-colabora-blog
npm ci
```

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com suas credenciais:

```env
# Supabase — encontradas em Settings > API do seu projeto
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key

# Stripe — encontrada em Developers > API Keys
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...

# (Opcional) URL do projeto para links de e-mail
VITE_APP_URL=https://avidanaocolabora.com.br
```

### 3. Supabase — aplicar migrations

> **Importante:** execute as migrations **em ordem numérica**, uma a uma, no SQL Editor do Supabase
> (`Dashboard > SQL Editor > New query`).
> Não pule migrations e não inverta a ordem.

**Ordem de aplicação (001 → 046):**

| Arquivo | Descrição |
|---------|-----------|
| `001_initial_schema.sql` | Schema base: profiles, articles, diary_entries, questionnaires |
| `002_seed_data.sql` | Dados iniciais: artigos, meditações, planos |
| `003_articles_status_column.sql` | Coluna status nos artigos |
| `003_z_prereqs.sql` | Colunas pré-requisito em profiles, articles, etc. (rode após 003) |
| `004_automated_emails.sql` | Tabela automated_contents e e-mails automáticos |
| `005_analytics_events.sql` | Eventos de analytics |
| `006_fix_diary_and_plans.sql` | Correções no diário e configuração de planos |
| `007_missing_tables.sql` | Tabelas faltantes: notifications, categories, etc. |
| `008_fix_column_mismatches.sql` | Alinhamento de colunas |
| `009_plan_configs_and_saved_items.sql` | Configurações de planos e itens salvos |
| `010_align_admin_columns.sql` | Colunas para painel admin |
| `011_diary_plan_configs.sql` | Configurações do diário por plano |
| `012_stripe.sql` | Integração Stripe: user_subscriptions, plan_change_history |
| `013_fix_admin_blog_sync.sql` | Correções de sincronização admin/blog |
| `014_support_tickets.sql` | Sistema de suporte: support_tickets, ticket_messages |
| *(015 não existe — numeração reservada)* | — |
| `016_support_users_admin_improvements.sql` | Melhorias no suporte e usuários admin |
| `017_fix_admin_profiles_rls.sql` | Correção de RLS em profiles para admin |
| `018_admin_user_auth_ops.sql` | Operações de auth para admin |
| `019_must_change_password.sql` | Flag de troca obrigatória de senha |
| `020_plans_features_templates.sql` | Templates de funcionalidades por plano |
| `021_fix_professional_comments.sql` | Comentários profissionais |
| `022_subscriptions_email.sql` | E-mails de assinatura |
| `023_plan_features_display.sql` | Exibição de funcionalidades por plano |
| `024_fix_plan_features_is_display.sql` | Correção na flag is_display |
| `025_plan_inheritance.sql` | Herança de benefícios entre planos |
| `026_ai_generation_logs.sql` | Logs de geração de IA |
| `027_evolution_tables.sql` | Tabelas de evolução do usuário |
| `028_user_sessions_fix.sql` | Correção de sessões de usuário |
| `029_personalized_content.sql` | Conteúdo personalizado |
| `030_personalization_tasks.sql` | Fila de personalização |
| `031_fix_personalization.sql` | Correções de personalização |
| `032_system_health.sql` | Saúde do sistema |
| `033_notifications_and_health_cleanup.sql` | Notificações e limpeza |
| `034_diary_entry_limit_trigger.sql` | Trigger de limite de entradas no diário |
| `035_user_ai_summaries.sql` | Resumos gerados por IA |
| `036_questionnaires_rls.sql` | RLS para questionários |
| *(037 não existe — numeração reservada)* | — |
| `038_questionnaire_responses_rls.sql` | RLS para respostas de questionários |
| `039_plan_change_history_constraint.sql` | Constraint na tabela de histórico de planos |
| `040_profiles_protection.sql` | RLS reforçado em profiles |
| `041_force_password_and_insert_protection.sql` | Proteção de insert em profiles |
| `042_subscriptions_pending_and_rpc.sql` | Status pendente e RPCs de assinatura |
| `043_articles_columns_and_indexes.sql` | Colunas e índices de performance em articles |
| `044_rls_security_hardening.sql` | Hardening geral de RLS (paywall, admin) |
| `045_admin_rpcs.sql` | RPCs SECURITY DEFINER para operações admin |
| `046_consolidate_schemas.sql` | Tabelas auxiliares consolidadas + índices |

> **Nota sobre 003_z_prereqs.sql:** este arquivo usa `ADD COLUMN IF NOT EXISTS` em todas as
> tabelas para garantir que novas instalações tenham todas as colunas antes de 004+. É idempotente.

> **Nota sobre 015 e 037:** esses números foram reservados e não existem. A sequência pula de 014→016
> e de 036→038 — isso é normal e intencional.

### 4. Supabase — configurar autenticação

No painel do Supabase (`Authentication > URL Configuration`):

- **Site URL:** `https://avidanaocolabora.com.br`
- **Redirect URLs:** adicione `https://avidanaocolabora.com.br/**`

### 5. Stripe — configurar webhook

No painel do Stripe (`Developers > Webhooks`):

- **Endpoint URL:** `https://seu-projeto.supabase.co/functions/v1/stripe-webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copie o **Signing Secret** e configure como secret `STRIPE_WEBHOOK_SECRET` nas Edge Functions

### 6. Supabase — fazer deploy das Edge Functions

```bash
# Instale a CLI do Supabase (se não tiver)
npm install -g supabase

# Autentique e faça link com seu projeto
supabase login
supabase link --project-ref <seu-project-ref>

# Deploy das funções
supabase functions deploy stripe-webhook
supabase functions deploy create-checkout
supabase functions deploy manage-subscription
supabase functions deploy send-automated-emails
```

Configure os secrets nas Edge Functions (`Supabase > Edge Functions > Manage secrets`):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_SERVICE_ROLE_KEY=...
VITE_APP_URL=https://avidanaocolabora.com.br
```

### 7. Rodar em desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:5173`

### 8. Build para produção

```bash
npm run build
```

Saída em `dist/`. Faça deploy desta pasta.

## Deploy — Vercel

1. Conecte o repositório GitHub ao Vercel
2. Configure as variáveis de ambiente no painel do Vercel (mesmas do `.env`)
3. O arquivo `vercel.json` já configura rewrite para SPA (`/* → /index.html`)
4. Deploy automático em cada push para `main`

## Primeiro acesso como administrador

1. Crie uma conta pelo site normalmente
2. No SQL Editor do Supabase, execute:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'seu-email@exemplo.com';
```

3. Faça logout e login novamente
4. Acesse `/admin` para o painel administrativo

## Operações administrativas (RPCs)

As seguintes operações são realizadas via RPCs SECURITY DEFINER (apenas admins):

- `admin_change_user_plan(user_id, new_plan, notes)` — altera plano e registra histórico
- `admin_update_user_role(user_id, new_role)` — promove/rebaixa papel do usuário
- `admin_cancel_subscription(user_id, notes)` — cancela assinatura
- `admin_set_unlimited_access(user_id, enabled)` — acesso ilimitado sem cobrança
- `admin_force_password_change(user_id)` — obriga troca de senha no próximo login

## Estrutura do projeto

```
src/
  components/         # Componentes React (lazy-loaded)
    admin/            # Painel administrativo
  hooks/              # useAuth, useAnalytics
  lib/                # Cliente Supabase, utilitários
  types/              # TypeScript types
supabase/
  migrations/         # 46 migrations em ordem numérica (001–046)
  functions/          # Edge Functions (Stripe, e-mails)
  legacy/             # Arquivos SQL legados (NÃO aplicar manualmente)
public/
  sitemap.xml         # Mapa do site (domínio: avidanaocolabora.com.br)
vercel.json           # Configuração SPA rewrite
```

## Suporte e emergência

- **CVV — Centro de Valorização da Vida:** 188 (24h, gratuito)
- **CAPS (Centro de Atenção Psicossocial):** procure a unidade mais próxima
