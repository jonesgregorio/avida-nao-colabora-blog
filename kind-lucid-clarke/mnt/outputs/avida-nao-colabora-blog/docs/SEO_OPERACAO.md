# Operação de SEO — A Vida Não Colabora

## Objetivo

Fazer o conteúdo público do AVNC ser descoberto, indexado e compreendido por mecanismos de busca sem expor diário, check-ins, relatórios, conta ou qualquer outro dado pessoal.

## Arquitetura indexável

- `/`: apresentação da plataforma e acesso aos principais temas.
- `/blog`: índice server-side dos conteúdos gratuitos publicados.
- `/guias`: hub dos oito artigos-pilar.
- `/blog/:slug`: documento server-side completo quando o artigo é gratuito.
- `/sobre`, `/planos`, `/faq`, `/contato`: páginas públicas institucionais.
- `/politica-editorial`: critérios de autoria, fontes, revisão e atualização.
- `/privacidade`, `/termos`, `/aviso-de-responsabilidade`: transparência e segurança.

Conteúdos fechados e rotas pessoais recebem `noindex`. O sitemap inclui somente páginas públicas e artigos gratuitos.

## Ativação no Google Search Console

1. Criar uma propriedade de domínio para `avidanaocolabora.com`.
2. Preferir verificação por registro DNS. Como alternativa, configurar `GOOGLE_SITE_VERIFICATION` na Vercel com apenas o valor do token da meta tag.
3. Enviar `https://www.avidanaocolabora.com/sitemap.xml`.
4. Inspecionar e solicitar indexação, nesta ordem: home, `/blog`, `/guias`, os oito pilares e os artigos novos ou substancialmente atualizados.
5. Conferir semanalmente Páginas, Sitemaps, HTTPS, Core Web Vitals e Melhorias.

## Ativação no Bing Webmaster Tools

1. Importar a propriedade já verificada no Google Search Console ou adicionar o domínio manualmente.
2. Se necessário, configurar `BING_SITE_VERIFICATION` com o valor de `msvalidate.01`.
3. Enviar o mesmo sitemap.

## Rotina editorial

- Uma intenção principal por artigo; não publicar uma segunda página para responder à mesma busca.
- Título SEO entre 25 e 60 caracteres.
- Descrição entre 90 e 155 caracteres.
- Slug curto, estável, minúsculo, sem acentos ou sufixos aleatórios.
- Imagem relevante com texto alternativo descritivo.
- Autoria explícita e data de publicação/atualização.
- Para afirmações de saúde, registrar fontes adequadas e realizar a revisão exigida pelo tema.
- Conectar cada artigo a um pilar e a pelo menos dois conteúdos relacionados.
- Atualizar ou consolidar conteúdo que estiver desatualizado; evitar artigos finos e páginas órfãs.

## Indicadores mensais

- páginas válidas indexadas e motivos de exclusão;
- impressões, cliques, CTR e posição média;
- consultas com crescimento e páginas entre as posições 4 e 20;
- artigos sem impressão após 90 dias;
- páginas com muitas impressões e CTR abaixo da média;
- tráfego orgânico, leitura, CTA e cadastro por conteúdo;
- Core Web Vitals por tipo de página;
- novos links externos legítimos e menções à marca.

## Regra de segurança

Não enviar ao Search Console URLs autenticadas nem tentar indexar telas de diário, mapa, relatório, jardim, orientação, suporte ou perfil. Nunca publicar nomes de profissionais, credenciais, estudos ou fontes que não tenham sido verificados.
