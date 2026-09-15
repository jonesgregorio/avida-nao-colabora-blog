-- Cadastra o jardim "Tropical Balinês" no catálogo, o primeiro com 6 imagens de estágio
-- (os 8 jardins originais têm 4). As 6 fotos já estão em public/gardens/bali/{1..6}.webp e a
-- config visual (água, luz, fauna) em src/lib/gardenThemes.ts — status='queued' entra na fila
-- normal de rotação, atrás dos 8 jardins existentes (mesmo padrão dos jardins 2-8 no seed
-- original em 20260911123000_admin_garden_management.sql).
INSERT INTO public.garden_catalog(slug,label,description,theme_index,status,queue_position,cover_image,stage_images) VALUES
 ('bali','Tropical Balinês · amanhecer','Pedra vulcânica, água, palmeiras, helicônias, alocásias e frangipani sob um amanhecer úmido e dourado — refúgio, descanso e desaceleração.',8,'queued',9,'/gardens/bali/6.webp',
  '["/gardens/bali/1.webp","/gardens/bali/2.webp","/gardens/bali/3.webp","/gardens/bali/4.webp","/gardens/bali/5.webp","/gardens/bali/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, theme_index=EXCLUDED.theme_index, status=EXCLUDED.status, queue_position=EXCLUDED.queue_position, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;
