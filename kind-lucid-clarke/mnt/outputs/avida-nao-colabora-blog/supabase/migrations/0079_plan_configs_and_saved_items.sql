-- Migration 009: plan_configs and saved_items tables

-- Tabela de configuração de planos (editável pelo admin)
create table if not exists plan_configs (
  id           uuid primary key default gen_random_uuid(),
  plan_key     text not null unique,           -- 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'
  label        text not null,
  price        text not null,
  description  text,
  recommended  boolean not null default false,
  active       boolean not null default true,
  diary_limit  integer,                        -- null = ilimitado
  features     jsonb not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table plan_configs enable row level security;

-- Admins podem ler e escrever
create policy "admin_all_plan_configs" on plan_configs
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Qualquer usuário autenticado pode ler (para exibir preços no app)
create policy "public_read_plan_configs" on plan_configs
  for select
  using (active = true);

-- -------------------------------------------------------------------
-- Tabela de itens salvos (Caixa de Cuidado)
-- -------------------------------------------------------------------
create table if not exists saved_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  item_type    text not null,   -- 'article' | 'trail' | 'questionnaire' | 'content'
  item_id      text not null,
  title        text,
  description  text,
  image_url    text,
  metadata     jsonb default '{}',
  created_at   timestamptz not null default now()
);

create unique index if not exists saved_items_user_item_idx
  on saved_items (user_id, item_type, item_id);

alter table saved_items enable row level security;

create policy "user_own_saved_items" on saved_items
  for all
  using (auth.uid() = user_id);
