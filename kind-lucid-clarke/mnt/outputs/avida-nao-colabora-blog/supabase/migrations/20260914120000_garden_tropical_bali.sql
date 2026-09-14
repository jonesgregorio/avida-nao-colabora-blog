-- Cadastra o jardim "Tropical Balinês" no catálogo, o primeiro com 6 imagens de estágio
-- (os 8 jardins originais têm 4). status='draft' de propósito: fica fora da fila de sorteio
-- (a lateral de admin_garden_users()/get_my_garden_state() só considera status
-- 'active'/'queued') até um admin trocar o status em "Gestão de Jardins" depois que as 6
-- imagens forem geradas e colocadas em public/gardens/bali/{1..6}.webp — engine e config
-- visual (água, luz, fauna) já estão prontas em src/lib/gardenThemes.ts.
INSERT INTO public.garden_catalog(slug,label,description,theme_index,status,cover_image,stage_images) VALUES
 ('bali','Tropical Balinês · amanhecer','Pedra vulcânica, água, palmeiras, helicônias, alocásias e frangipani sob um amanhecer úmido e dourado — refúgio, descanso e desaceleração.',8,'draft','/gardens/bali/6.webp',
  '["/gardens/bali/1.webp","/gardens/bali/2.webp","/gardens/bali/3.webp","/gardens/bali/4.webp","/gardens/bali/5.webp","/gardens/bali/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, description=EXCLUDED.description, theme_index=EXCLUDED.theme_index, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;
