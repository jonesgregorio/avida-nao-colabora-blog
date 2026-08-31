create table if not exists public.daily_life_collaboration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  score smallint not null check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.daily_life_collaboration enable row level security;

create policy "life_collaboration_own_select" on public.daily_life_collaboration for select to authenticated using (auth.uid() = user_id);
create policy "life_collaboration_own_insert" on public.daily_life_collaboration for insert to authenticated with check (auth.uid() = user_id);
create policy "life_collaboration_own_update" on public.daily_life_collaboration for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "life_collaboration_own_delete" on public.daily_life_collaboration for delete to authenticated using (auth.uid() = user_id);

revoke all on public.daily_life_collaboration from anon;
revoke all on public.daily_life_collaboration from authenticated;
grant select, insert, update, delete on public.daily_life_collaboration to authenticated;
