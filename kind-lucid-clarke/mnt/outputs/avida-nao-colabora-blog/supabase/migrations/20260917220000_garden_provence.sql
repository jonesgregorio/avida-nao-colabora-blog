-- Cadastra o jardim "Jardim de Lavandas da Provença" no catálogo, o terceiro com 6 imagens
-- de estágio (junto com Tropical Balinês e Jardim de Cerejeiras). As 6 fotos já estão em
-- public/gardens/provence/{1..6}.webp e a config visual (água, luz, fauna) em
-- src/lib/gardenThemes.ts — status='queued' entra na fila normal de rotação, posição 11.
INSERT INTO public.garden_catalog(slug,label,description,theme_index,status,queue_position,cover_image,stage_images) VALUES
 ('provence','Jardim de Lavandas da Provença · pôr do sol','Campos de lavanda, oliveira centenária, pedra clara e pérgola rústica sob um pôr do sol violeta e dourado — serenidade.',10,'queued',11,'/gardens/provence/6.webp',
  '["/gardens/provence/1.webp","/gardens/provence/2.webp","/gardens/provence/3.webp","/gardens/provence/4.webp","/gardens/provence/5.webp","/gardens/provence/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, theme_index=EXCLUDED.theme_index, status=EXCLUDED.status, queue_position=EXCLUDED.queue_position, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;
