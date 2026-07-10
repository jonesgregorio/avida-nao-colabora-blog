-- ============================================================================
-- Migration 063: schema completo de monthly_guidance_requests (§10)
-- A Orientação Plus do usuário passa a usar monthly_guidance_requests (mesma
-- tabela lida pelo admin), em vez de support_tickets. Esta migração garante o
-- schema em banco limpo: a migração 020 cria a tabela numa variante antiga
-- (com ticket_id) ANTES da 027, e o CREATE TABLE IF NOT EXISTS da 027 é
-- ignorado — deixando faltando message/context/expected_help/response/etc.
-- Idempotente e segura em banco limpo ou existente.
-- ============================================================================

begin;

create table if not exists monthly_guidance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  month_key text not null,
  created_at timestamptz default now()
);

alter table monthly_guidance_requests add column if not exists message text;
alter table monthly_guidance_requests add column if not exists context text;
alter table monthly_guidance_requests add column if not exists expected_help text;
alter table monthly_guidance_requests add column if not exists response text;
alter table monthly_guidance_requests add column if not exists status text default 'open';
alter table monthly_guidance_requests add column if not exists responded_by uuid references auth.users(id) on delete set null;
alter table monthly_guidance_requests add column if not exists responded_at timestamptz;
alter table monthly_guidance_requests add column if not exists updated_at timestamptz default now();

-- Uma orientação por usuário/mês.
create unique index if not exists idx_mgr_user_month on monthly_guidance_requests(user_id, month_key);

alter table monthly_guidance_requests enable row level security;

-- Usuário lê/insere/atualiza apenas as próprias; admin gerencia todas.
drop policy if exists "users_own_guidance" on monthly_guidance_requests;
create policy "users_own_guidance" on monthly_guidance_requests
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "admins_manage_guidance" on monthly_guidance_requests;
create policy "admins_manage_guidance" on monthly_guidance_requests
  using (is_admin()) with check (is_admin());

-- Limpa políticas antigas da variante 020 (evita duplicidade).
drop policy if exists "mgr_user" on monthly_guidance_requests;
drop policy if exists "mgr_insert" on monthly_guidance_requests;
drop policy if exists "mgr_admin" on monthly_guidance_requests;

commit;
