-- Cadastra o jardim "Jardim de Cerejeiras" no catálogo, o segundo com 6 imagens de estágio
-- (junto com o Tropical Balinês em 20260914120000_garden_tropical_bali.sql). As 6 fotos já
-- estão em public/gardens/sakura/{1..6}.webp e a config visual (água, luz, fauna) em
-- src/lib/gardenThemes.ts — status='queued' entra na fila normal de rotação, posição 10.
INSERT INTO public.garden_catalog(slug,label,description,theme_index,status,queue_position,cover_image,stage_images) VALUES
 ('sakura','Jardim de Cerejeiras · manhã de primavera','Cerejeiras rosadas, gramado, pedras claras e um pequeno riacho sob uma manhã clara de primavera — renovação.',9,'queued',10,'/gardens/sakura/6.webp',
  '["/gardens/sakura/1.webp","/gardens/sakura/2.webp","/gardens/sakura/3.webp","/gardens/sakura/4.webp","/gardens/sakura/5.webp","/gardens/sakura/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, theme_index=EXCLUDED.theme_index, status=EXCLUDED.status, queue_position=EXCLUDED.queue_position, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;
