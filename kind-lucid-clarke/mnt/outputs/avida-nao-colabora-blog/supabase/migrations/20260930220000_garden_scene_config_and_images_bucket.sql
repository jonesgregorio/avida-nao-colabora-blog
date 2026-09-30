-- Jardins criados pelo Admin com 100% das funcionalidades dos jardins do código.
--
-- Hoje um jardim do catálogo só ganha água, fauna, luz e clima (a "cena viva") se a
-- configuração existir no código (src/lib/gardenThemes.ts). Esta migration guarda a mesma
-- configuração no banco, para o Admin criar jardins novos sem deploy:
--   1) garden_catalog.scene_config: JSON com a cena (mesmo formato do GardenTheme, sem slug,
--      label e imagens). O front valida/limita tudo antes de usar (gardenSceneConfig.ts).
--   2) bucket público "garden-images": onde o Admin envia as imagens dos estágios
--      (<slug>/1.webp … 6.webp). Só administradores escrevem; leitura é pública (são imagens
--      de ilustração do produto, como /public/gardens).
-- Jardins já existentes (scene_config nulo) continuam usando a configuração do código.

alter table public.garden_catalog add column if not exists scene_config jsonb;

alter table public.garden_catalog drop constraint if exists garden_catalog_scene_config_size;
alter table public.garden_catalog add constraint garden_catalog_scene_config_size
  check (scene_config is null or (jsonb_typeof(scene_config) = 'object' and pg_column_size(scene_config) <= 32768));

comment on column public.garden_catalog.scene_config is
  'Cena viva do jardim (água, queda, fauna, luz, extras) no formato de GardenTheme sem slug/label/stages. Nulo = usa a configuração do código.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'garden-images',
  'garden-images',
  true,
  8388608,
  array['image/webp', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "garden_images_admin_select" on storage.objects;
drop policy if exists "garden_images_admin_insert" on storage.objects;
drop policy if exists "garden_images_admin_update" on storage.objects;
drop policy if exists "garden_images_admin_delete" on storage.objects;

create policy "garden_images_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'garden-images' and public.is_admin());

create policy "garden_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'garden-images' and public.is_admin());

create policy "garden_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'garden-images' and public.is_admin())
  with check (bucket_id = 'garden-images' and public.is_admin());

create policy "garden_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'garden-images' and public.is_admin());
