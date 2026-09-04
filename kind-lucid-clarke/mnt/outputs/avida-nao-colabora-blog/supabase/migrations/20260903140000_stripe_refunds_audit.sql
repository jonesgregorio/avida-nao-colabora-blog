-- ============================================================================
-- Auditoria de reembolsos Stripe feitos pelo Admin
-- ----------------------------------------------------------------------------
-- Até agora reembolso só no dashboard do Stripe. A Edge Function admin-refund
-- passa a permitir reembolso pelo painel, com trava (AAL2, motivo obrigatório,
-- teto por operação, confirmação em duas etapas). Cada reembolso é registrado
-- aqui para rastreabilidade.
--
-- ADITIVO. Só cria a tabela de log — não toca em nenhum fluxo de cobrança.
-- ============================================================================

create table if not exists public.stripe_refunds (
  id               uuid primary key default gen_random_uuid(),
  stripe_refund_id text unique,
  charge_id        text not null,
  payment_intent   text,
  amount_cents     integer not null,
  currency         text not null default 'brl',
  reason           text not null,
  admin_id         uuid,
  customer_email   text,
  status           text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_stripe_refunds_created on public.stripe_refunds (created_at desc);

alter table public.stripe_refunds enable row level security;

drop policy if exists stripe_refunds_admin on public.stripe_refunds;
create policy stripe_refunds_admin on public.stripe_refunds
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.stripe_refunds from anon;
