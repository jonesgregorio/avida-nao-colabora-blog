-- Garante a existência da página de privacidade mesmo em ambientes onde o seed
-- do CMS não tenha criado a linha. Se a linha já existe, mantém o conteúdo
-- definido pela migration imediatamente anterior.

insert into public.site_pages (slug, title, body_md)
select
  'privacidade',
  'Política de Privacidade',
  body_md
from public.site_pages
where slug = 'privacidade'
on conflict (slug) do nothing;
