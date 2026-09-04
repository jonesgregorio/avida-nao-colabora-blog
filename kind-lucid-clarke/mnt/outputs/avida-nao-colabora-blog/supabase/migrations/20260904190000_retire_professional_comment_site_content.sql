-- ============================================================================
-- Atualiza o conteúdo do CMS (site_pages/faq_items) semeado pela migration
-- 20260903120000_site_content_cms.sql para refletir a aposentadoria do
-- "Comentário profissional sobre o relatório" como recurso comercial ativo
-- do Plus (PR2/PR3 já removeram o recurso do código; esta migration ajusta
-- o TEXTO já em produção, sem editar a migration histórica).
--
-- ADITIVO/IDEMPOTENTE: só faz UPDATE de linhas cujo texto ainda corresponde
-- exatamente ao texto antigo semeado — se um admin já editou essas linhas
-- pelo painel, o texto não bate mais e a linha não é tocada (preserva
-- edições manuais feitas depois do seed).
-- ============================================================================

-- Termos de Uso — item da lista "Limitações do serviço"
update public.site_pages
set body_md = replace(
  body_md,
  '- O Plano Plus inclui orientação mensal por mensagem e comentário profissional — não é psicoterapia clínica',
  '- O Plano Plus inclui recursos adicionais de autoconhecimento, plano de autocuidado e orientação mensal, sem substituir psicoterapia, avaliação clínica ou acompanhamento profissional continuado'
)
where slug = 'termos'
  and body_md like '%O Plano Plus inclui orientação mensal por mensagem e comentário profissional%';

-- Política de Privacidade — menção a "revisão profissional" como recurso ativo
update public.site_pages
set body_md = replace(
  body_md,
  'Em funcionalidades do Plus que incluem revisão profissional, o profissional recebe o relatório ou o contexto necessário para produzir a devolutiva prevista naquele recurso. Isso não significa acesso livre ou rotineiro da equipe ao seu diário completo.',
  'O comentário individual de um profissional sobre o relatório mensal foi descontinuado como recurso ativo do produto; comentários enviados no passado continuam preservados para consulta e exportação, sem que a equipe tenha acesso livre ou rotineiro ao seu diário completo.'
)
where slug = 'privacidade'
  and body_md like '%Em funcionalidades do Plus que incluem revisão profissional%';

-- FAQ — "Qual a diferença entre os planos?"
update public.faq_items
set answer = 'O Gratuito permite começar com Check-in diário, Diário emocional em até 5 dias por mês, Diário por voz, uma seleção de questionários, conteúdos guiados e uma visão inicial da Minha História. O Essencial amplia o acompanhamento com Diário sem limite mensal, Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal, Meu Jardim e conteúdos guiados completos. O Plus inclui tudo do Essencial e acrescenta Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal.'
where question = 'Qual a diferença entre os planos?'
  and answer = 'O plano Gratuito dá acesso ao diário básico (5 registros/mês), blog aberto e questionário inicial. O Essencial libera diário ilimitado, histórico completo, mapa emocional e relatório semanal. O Plus inclui tudo do Essencial mais plano de autocuidado mensal, relatório aprofundado e orientação por mensagem com profissional.';

-- FAQ — "O Plano Plus substitui o acompanhamento com psicólogo?"
update public.faq_items
set answer = 'Não. O Plus reúne recursos adicionais de autoconhecimento — Aprofundamentos do Diário, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal por mensagem, esta última a partir de uma pergunta específica enviada por você. Nenhum deles substitui psicoterapia, avaliação clínica ou acompanhamento profissional continuado.'
where question = 'O Plano Plus substitui o acompanhamento com psicólogo?'
  and answer = 'Não. São recursos diferentes e complementares do Plus: o comentário profissional fica ligado ao relatório mensal e oferece uma devolutiva breve sobre aquela leitura; a orientação mensal por mensagem parte de uma pergunta específica enviada por você. Nenhum dos dois substitui psicoterapia ou acompanhamento clínico continuado.';
