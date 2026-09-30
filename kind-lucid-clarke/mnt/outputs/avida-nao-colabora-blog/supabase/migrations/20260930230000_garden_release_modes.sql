-- Modo de entrega do Meu Jardim: Fila global, Livre escolha e Híbrido.
--
-- Até aqui garden_settings.release_mode só ficava gravado; o sistema sempre seguia a fila global.
-- Agora cada modo tem efeito real:
--   global  → todos seguem a fila do Admin (comportamento atual, inalterado).
--   free    → a pessoa ESCOLHE o jardim de cada novo ciclo. Sem escolha, nada é gravado e a tela
--             pede a escolha; o jardim exibido enquanto isso é só o da fila, como pré-visualização.
--   hybrid  → a fila define o jardim por padrão (grava como hoje) e a pessoa pode TROCAR de jardim
--             durante o ciclo. O progresso não muda: só a aparência.
-- Regras que valem para todos: só jardins disponíveis (status active/queued e release_at vencido);
-- um jardim forçado pelo Admin para aquela pessoa (garden_user_overrides) prevalece e trava a
-- troca; ciclos já concluídos e seu histórico (garden_user_cycles) nunca são alterados; a escolha
-- vale para o ciclo atual. O cálculo de crescimento e o get_my_garden_state não mudam.

create or replace function public.resolve_user_garden_theme(p_user_id uuid, p_cycle integer, p_forced_slug text default null::text)
returns table(garden_slug text, theme_index smallint)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_slug text; v_theme smallint; v_count integer; v_mode text;
begin
  if p_user_id is null or p_user_id is distinct from auth.uid() then raise exception 'Acesso negado'; end if;
  if p_forced_slug is not null then
    select g.slug, g.theme_index into v_slug, v_theme from garden_catalog g where g.slug = p_forced_slug and g.status <> 'archived' limit 1;
    if v_slug is not null then return query select v_slug, v_theme; return; end if;
  end if;
  select c.garden_slug, c.theme_index into v_slug, v_theme from garden_user_cycles c where c.user_id = p_user_id and c.cycle_number = p_cycle;
  if v_slug is not null then return query select v_slug, v_theme; return; end if;
  select count(*)::int into v_count from garden_catalog g where g.status in ('active','queued') and (g.release_at is null or g.release_at <= now());
  if v_count > 0 then
    select g.slug, g.theme_index into v_slug, v_theme from garden_catalog g
      where g.status in ('active','queued') and (g.release_at is null or g.release_at <= now())
      order by g.queue_position nulls last, g.theme_index offset (p_cycle % v_count) limit 1;
    select coalesce((select s.release_mode from garden_settings s where s.id = true), 'global') into v_mode;
    if v_mode <> 'free' then
      insert into garden_user_cycles(user_id, cycle_number, garden_slug, theme_index) values (p_user_id, p_cycle, v_slug, v_theme) on conflict (user_id, cycle_number) do nothing;
      select c.garden_slug, c.theme_index into v_slug, v_theme from garden_user_cycles c where c.user_id = p_user_id and c.cycle_number = p_cycle;
    end if;
  else v_theme := (p_cycle % 8)::smallint; v_slug := null; end if;
  return query select v_slug, v_theme;
end; $function$;

-- Estado da escolha de jardim do ciclo atual da pessoa logada.
create or replace function public.get_my_garden_choice()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_mode text; v_ppc integer; v_growth integer; v_cycle integer; v_current text; v_forced text;
begin
  if v_uid is null then raise exception 'Acesso negado'; end if;
  select coalesce(s.release_mode, 'global'), coalesce(s.points_per_cycle, 60) into v_mode, v_ppc from garden_settings s where s.id = true;
  v_mode := coalesce(v_mode, 'global'); v_ppc := coalesce(v_ppc, 60);
  select coalesce(l.applied_growth, 0) into v_growth from garden_growth_ledger l where l.user_id = v_uid;
  v_cycle := floor(coalesce(v_growth, 0) / v_ppc::numeric)::int;
  select c.garden_slug into v_current from garden_user_cycles c where c.user_id = v_uid and c.cycle_number = v_cycle;
  select o.forced_garden_slug into v_forced from garden_user_overrides o where o.user_id = v_uid;
  return jsonb_build_object(
    'mode', v_mode,
    'cycle', v_cycle,
    'current_slug', v_current,
    'locked_by_admin', v_forced is not null,
    'needs_choice', (v_mode = 'free' and v_current is null and v_forced is null),
    'can_switch', (v_mode in ('free', 'hybrid') and v_forced is null),
    'options', coalesce((
      select jsonb_agg(jsonb_build_object('slug', g.slug, 'label', g.label, 'description', g.description, 'cover_image', g.cover_image)
                       order by g.queue_position nulls last, g.theme_index)
      from garden_catalog g
      where g.status in ('active', 'queued') and (g.release_at is null or g.release_at <= now())
    ), '[]'::jsonb)
  );
end; $function$;

-- Grava a escolha (free) ou a troca (hybrid) do jardim do ciclo atual.
create or replace function public.choose_my_garden(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_mode text; v_ppc integer; v_growth integer; v_cycle integer; v_theme smallint; v_forced text;
begin
  if v_uid is null then raise exception 'Acesso negado'; end if;
  select coalesce(s.release_mode, 'global'), coalesce(s.points_per_cycle, 60) into v_mode, v_ppc from garden_settings s where s.id = true;
  v_mode := coalesce(v_mode, 'global'); v_ppc := coalesce(v_ppc, 60);
  if v_mode not in ('free', 'hybrid') then raise exception 'A escolha de jardim não está habilitada.'; end if;
  select o.forced_garden_slug into v_forced from garden_user_overrides o where o.user_id = v_uid;
  if v_forced is not null then raise exception 'Seu jardim foi definido pela equipe e não pode ser trocado agora.'; end if;
  select g.theme_index into v_theme from garden_catalog g
    where g.slug = p_slug and g.status in ('active', 'queued') and (g.release_at is null or g.release_at <= now());
  if v_theme is null then raise exception 'Esse jardim não está disponível.'; end if;
  select coalesce(l.applied_growth, 0) into v_growth from garden_growth_ledger l where l.user_id = v_uid;
  v_cycle := floor(coalesce(v_growth, 0) / v_ppc::numeric)::int;
  insert into garden_user_cycles(user_id, cycle_number, garden_slug, theme_index) values (v_uid, v_cycle, p_slug, v_theme)
    on conflict (user_id, cycle_number) do update set garden_slug = excluded.garden_slug, theme_index = excluded.theme_index, assigned_at = now();
  return jsonb_build_object('ok', true, 'cycle', v_cycle, 'slug', p_slug);
end; $function$;

revoke all on function public.get_my_garden_choice() from public, anon;
revoke all on function public.choose_my_garden(text) from public, anon;
grant execute on function public.get_my_garden_choice() to authenticated;
grant execute on function public.choose_my_garden(text) to authenticated;
