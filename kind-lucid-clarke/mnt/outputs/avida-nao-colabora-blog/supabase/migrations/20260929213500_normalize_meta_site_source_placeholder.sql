-- Normaliza placeholders não resolvidos usados em URLs dinâmicas da Meta.
-- Ex.: utm_source={{site_source_name}} não deve virar uma origem visível no Admin.
-- Mantemos o placeholder original em metadata.utm_source_template para auditoria.

create or replace function public.normalize_analytics_source_placeholder()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  placeholder constant text := '{{site_source_name}}';
  normalized text;
  metadata_json jsonb := coalesce(new.metadata, '{}'::jsonb);
  content_hint text := lower(coalesce(metadata_json->>'utm_content', ''));
  landing_hint text := lower(coalesce(metadata_json->>'landing_path', ''));
begin
  if not (
    new.entity_id = placeholder
    or metadata_json->>'source' = placeholder
    or metadata_json->>'first_touch_source' = placeholder
    or metadata_json->>'utm_source' = placeholder
  ) then
    return new;
  end if;

  if content_hint ~ '(^|[_-])(ig|instagram)([_-]|$)'
     or content_hint like '%reel%'
     or content_hint like '%story%'
     or landing_hint = '/ig'
  then
    normalized := 'Instagram';
  elsif content_hint ~ '(^|[_-])(fb|facebook)([_-]|$)' then
    normalized := 'Facebook';
  else
    normalized := 'Origem não identificada';
  end if;

  metadata_json := jsonb_set(metadata_json, '{utm_source_template}', to_jsonb(placeholder), true);

  if metadata_json->>'utm_source' = placeholder then
    metadata_json := metadata_json - 'utm_source';
  end if;
  if metadata_json->>'source' = placeholder then
    metadata_json := jsonb_set(metadata_json, '{source}', to_jsonb(normalized), true);
  end if;
  if metadata_json->>'first_touch_source' = placeholder then
    metadata_json := jsonb_set(metadata_json, '{first_touch_source}', to_jsonb(normalized), true);
  end if;
  if new.entity_id = placeholder then
    new.entity_id := normalized;
  end if;

  new.metadata := metadata_json;
  return new;
end;
$$;

drop trigger if exists analytics_events_normalize_source_placeholder
on public.analytics_events;

create trigger analytics_events_normalize_source_placeholder
before insert or update on public.analytics_events
for each row
execute function public.normalize_analytics_source_placeholder();

update public.analytics_events
set entity_id = case
      when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(ig|instagram)([_-]|$)'
        or lower(coalesce(metadata->>'utm_content', '')) like '%reel%'
        or lower(coalesce(metadata->>'utm_content', '')) like '%story%'
        or lower(coalesce(metadata->>'landing_path', '')) = '/ig'
      then 'Instagram'
      when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(fb|facebook)([_-]|$)'
      then 'Facebook'
      else 'Origem não identificada'
    end,
    metadata = (
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(metadata, '{}'::jsonb),
            '{utm_source_template}',
            to_jsonb('{{site_source_name}}'::text),
            true
          ) - 'utm_source',
          '{source}',
          to_jsonb(
            case
              when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(ig|instagram)([_-]|$)'
                or lower(coalesce(metadata->>'utm_content', '')) like '%reel%'
                or lower(coalesce(metadata->>'utm_content', '')) like '%story%'
                or lower(coalesce(metadata->>'landing_path', '')) = '/ig'
              then 'Instagram'
              when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(fb|facebook)([_-]|$)'
              then 'Facebook'
              else 'Origem não identificada'
            end
          ),
          true
        ),
        '{first_touch_source}',
        to_jsonb(
          case
            when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(ig|instagram)([_-]|$)'
              or lower(coalesce(metadata->>'utm_content', '')) like '%reel%'
              or lower(coalesce(metadata->>'utm_content', '')) like '%story%'
              or lower(coalesce(metadata->>'landing_path', '')) = '/ig'
            then 'Instagram'
            when lower(coalesce(metadata->>'utm_content', '')) ~ '(^|[_-])(fb|facebook)([_-]|$)'
            then 'Facebook'
            else 'Origem não identificada'
          end
        ),
        true
      )
    )
where event = 'visit_source'
  and (
    entity_id = '{{site_source_name}}'
    or metadata->>'source' = '{{site_source_name}}'
    or metadata->>'first_touch_source' = '{{site_source_name}}'
    or metadata->>'utm_source' = '{{site_source_name}}'
  );
