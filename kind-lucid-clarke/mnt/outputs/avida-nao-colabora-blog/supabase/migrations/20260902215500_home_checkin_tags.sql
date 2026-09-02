alter table public.daily_life_collaboration
  add column if not exists feeling_tags text[] not null default '{}'::text[],
  add column if not exists custom_tags text[] not null default '{}'::text[];

alter table public.daily_life_collaboration
  drop constraint if exists daily_life_collaboration_feeling_tags_limit,
  add constraint daily_life_collaboration_feeling_tags_limit
    check (cardinality(feeling_tags) <= 7),
  drop constraint if exists daily_life_collaboration_custom_tags_limit,
  add constraint daily_life_collaboration_custom_tags_limit
    check (cardinality(custom_tags) <= 5);
