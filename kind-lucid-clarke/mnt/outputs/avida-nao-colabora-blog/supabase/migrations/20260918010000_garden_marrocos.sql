-- Cadastra o jardim "Jardim Marroquino" no catálogo, o quarto com 6 imagens de estágio
-- (junto com Tropical Balinês, Jardim de Cerejeiras e Jardim de Lavandas da Provença). As 6
-- fotos já estão em public/gardens/marrocos/{1..6}.webp e a config visual (água, luz, fauna)
-- em src/lib/gardenThemes.ts — status='queued' entra na fila normal de rotação, posição 12.
INSERT INTO public.garden_catalog(slug,label,description,theme_index,status,queue_position,cover_image,stage_images) VALUES
 ('marrocos','Jardim Marroquino · fim de tarde','Mosaicos zellige, fonte central, laranjeiras e palmeiras sob um fim de tarde quente — acolhimento e introspecção.',11,'queued',12,'/gardens/marrocos/6.webp',
  '["/gardens/marrocos/1.webp","/gardens/marrocos/2.webp","/gardens/marrocos/3.webp","/gardens/marrocos/4.webp","/gardens/marrocos/5.webp","/gardens/marrocos/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, theme_index=EXCLUDED.theme_index, status=EXCLUDED.status, queue_position=EXCLUDED.queue_position, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;
