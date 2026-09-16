-- ============================================================================
-- Ajusta o texto da Política de Privacidade em produção (CMS, site_pages) —
-- a página real vem do banco (20260903120000_site_content_cms.sql semeou o
-- conteúdo inicial); PrivacyPage.tsx é só o fallback caso a linha não exista.
--
-- Achado: a seção "Quais dados coletamos" listava, sem nenhum contexto,
-- "textos, notas, humor, energia, sono, dor, marcadores emocionais,
-- contextos, necessidades, ações de cuidado e gatilhos" logo de cara — dava
-- a impressão de que tudo que a pessoa desabafa no diário vira um item
-- catalogado/exposto. A explicação de que ninguém lê o diário por rotina já
-- existia (seção 7), mas só bem mais abaixo na página.
--
-- ADITIVO/IDEMPOTENTE: só faz UPDATE de linhas cujo texto ainda corresponde
-- exatamente ao texto antigo semeado — mesmo padrão de
-- 20260904190000_retire_professional_comment_site_content.sql. Se um admin
-- já editou essa seção pelo painel, o texto não bate mais e a linha não é
-- tocada (preserva edições manuais feitas depois do seed).
-- ============================================================================

-- Suaviza o item da lista: menos "inventário técnico", mais "o que você
-- escolhe registrar" (segue verdadeiro — o item genérico já cobria o resto).
update public.site_pages
set body_md = replace(
  body_md,
  '- **Dados do diário e check-ins:** textos, notas, humor, energia, sono, dor, marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos que você registrar.',
  '- **Dados do diário e check-ins:** o que você escolhe registrar sobre humor, energia, sono, dor e outras anotações do dia.'
)
where slug = 'privacidade'
  and body_md like '%- **Dados do diário e check-ins:** textos, notas, humor, energia, sono, dor, marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos que você registrar.%';

-- Traz a tranquilização (hoje só na seção 7) para logo depois da lista da
-- seção 1, no mesmo instante em que a dúvida "isso está exposto?" surgiria.
update public.site_pages
set body_md = replace(
  body_md,
  '- Dados de assinatura e cobrança necessários para identificar o plano e acompanhar pagamentos; os dados do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.

## 2. Por que tratamos esses dados',
  '- Dados de assinatura e cobrança necessários para identificar o plano e acompanhar pagamentos; os dados do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.

> O que você escreve no diário é seu. Ninguém da nossa equipe lê seus registros por rotina ou curiosidade — eles ficam protegidos por controles de acesso e só são processados automaticamente, dentro da sua própria conta, para gerar os recursos que você usa (como relatórios e o mapa emocional). Mais detalhes na seção 7, abaixo.

## 2. Por que tratamos esses dados'
)
where slug = 'privacidade'
  and body_md like '%- Dados de assinatura e cobrança necessários para identificar o plano e acompanhar pagamentos; os dados do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.

## 2. Por que tratamos esses dados%';
