-- Achado real da auditoria E2E local (Stripe checkout → webhook): um
-- `supabase db reset` limpo (replay de toda a história de migrations, sem
-- nenhuma alteração fora de ordem) deixa `service_role` SEM nenhum privilégio
-- SQL básico (SELECT/INSERT/UPDATE/DELETE) em praticamente todas as tabelas
-- do schema public — confirmado em profiles, user_subscriptions,
-- subscription_events, payment_events, plan_change_history, notifications,
-- stripe_webhook_events, diary_entries, questionnaire_responses e
-- support_tickets (0 de 10 com qualquer privilégio; 1 de 80 tabelas/views do
-- schema inteiro tinha SELECT, porque só essa migration concedeu
-- explicitamente).
--
-- `service_role` já tem BYPASSRLS (confirmado via \du), mas BYPASSRLS só
-- ignora políticas de RLS — não substitui o GRANT básico de tabela, que é um
-- mecanismo do Postgres totalmente separado. Sem o GRANT, toda chamada da
-- service role (Stripe webhook, create-checkout, e qualquer outra Edge
-- Function) falha com "permission denied for table X" ao tentar ler ou
-- escrever, mesmo a service role sendo a identidade de maior confiança do
-- sistema.
--
-- Nenhuma migration anterior deste projeto declara esse GRANT de forma
-- explícita para o schema inteiro; a única tabela com acesso correto
-- (stripe_plan_prices) só tem porque sua migration concedeu manualmente.
-- Ambientes hospedados pela Supabase provavelmente mascaram esse problema
-- porque a plataforma aplica um bootstrap próprio de permissões na criação
-- do projeto, fora do controle das migrations do repositório — mas isso não
-- é garantido nem documentado, e não se aplica a um `db reset` local nem a
-- uma eventual restauração/self-host a partir do zero.
--
-- Correção: conceder explicitamente à service_role o acesso completo já
-- esperado pelo papel (mesmo espírito do bootstrap padrão da Supabase) e
-- fixar isso via ALTER DEFAULT PRIVILEGES para que tabelas futuras herdem o
-- mesmo acesso automaticamente, sem depender de plataforma.

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
