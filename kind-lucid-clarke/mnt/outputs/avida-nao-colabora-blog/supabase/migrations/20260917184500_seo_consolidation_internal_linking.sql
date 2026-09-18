-- Consolidação de interlinking público dos clusters SEO.
-- Apenas metadata editorial de artigos públicos; não altera plano, RLS ou conteúdo sensível.

update public.articles
set related_slugs = array[
  'o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente',
  'o-que-e-autocuidado-emocional-na-vida-real',
  'perguntas-simples-para-entender-como-voce-esta-hoje',
  'como-recomecar-depois-de-uma-semana-emocionalmente-dificil'
]::text[],
updated_at = now()
where slug = '3-perguntas-para-fechar-o-dia-com-mais-clareza'
  and published = true
  and status = 'published'
  and plan_required = 'free';

update public.articles
set related_slugs = array[
  'como-comecar-um-diario-emocional-sem-saber-o-que-escrever',
  'como-registrar-seu-dia-em-uma-frase',
  'perguntas-simples-para-entender-como-voce-esta-hoje',
  '3-perguntas-para-fechar-o-dia-com-mais-clareza'
]::text[],
updated_at = now()
where slug = 'diario-emocional-exemplo-preenchido-passo-a-passo'
  and published = true
  and status = 'published'
  and plan_required = 'free';

update public.articles
set related_slugs = array[
  'faca-seu-primeiro-check-in-emocional',
  'emocao-pensamento-ou-necessidade-como-perceber-a-diferenca',
  'como-nomear-uma-emocao-sem-se-cobrar',
  '3-perguntas-para-fechar-o-dia-com-mais-clareza'
]::text[],
updated_at = now()
where slug = 'perguntas-simples-para-entender-como-voce-esta-hoje'
  and published = true
  and status = 'published'
  and plan_required = 'free';
