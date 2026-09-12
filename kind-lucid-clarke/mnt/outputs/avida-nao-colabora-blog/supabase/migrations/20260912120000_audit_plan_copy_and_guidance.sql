-- Alinha o conteúdo dinâmico do CMS/catálogo à auditoria funcional de 2026-09-12.
-- Idempotente: atualiza somente os registros canônicos conhecidos.

update public.plan_feature_access
set custom_label = case plan_key
  when 'free' then 'Seleção'
  when 'essential' then 'Catálogo Essencial'
  when 'plus' then 'Completo + exclusivos Plus'
  else custom_label
end,
custom_description = case plan_key
  when 'free' then 'Seleção de exercícios, reflexões e práticas para começar.'
  when 'essential' then 'Conteúdos do Gratuito e do Essencial.'
  when 'plus' then 'Todo o catálogo, incluindo conteúdos exclusivos do Plus.'
  else custom_description
end
where feature_key = 'emotional_exercise_library'
  and plan_key in ('free', 'essential', 'plus');

update public.plan_features
set feature_description = 'Exercícios, reflexões e práticas organizados em catálogos diferentes conforme o plano.',
    presentation_revision = extract(epoch from now())::bigint * 1000
where feature_key = 'emotional_exercise_library';

update public.plan_features
set feature_description = 'Uma questão específica respondida cuidadosamente por profissional habilitado a partir do contexto escolhido pelo usuário.',
    presentation_revision = extract(epoch from now())::bigint * 1000
where feature_key = 'monthly_message_guidance';

update public.faq_items
set answer = 'Gratuito — começar a se observar: Check-in diário (1 por dia), Diário emocional em até 5 dias por mês, Diário por voz, questionários do Gratuito, Artigos e conteúdos, seleção de Conteúdos Guiados e visão inicial da Minha História. Essencial — entender seus padrões: inclui o Gratuito e amplia com Diário sem limite mensal, questionários e catálogo de Conteúdos Guiados do Essencial, Mapa Emocional, Descobertas, Minha História completa, Relatório Semanal e Meu Jardim. Plus — transformar entendimento em cuidado: inclui o Essencial, todo o catálogo de Conteúdos Guiados com exclusivos Plus, Aprofundamentos do Diário (até 3 por dia), questionários do Plus, Relatório Mensal Aprofundado, Plano de Autocuidado Mensal e Orientação Mensal por profissional habilitado.',
    updated_at = now()
where question = 'Qual a diferença entre os planos?';

update public.faq_items
set answer = 'Não. O Gratuito recebe uma seleção para começar. O Essencial acessa os conteúdos do Gratuito e o catálogo Essencial. O Plus acessa todo esse catálogo e também os conteúdos exclusivos do Plus. Cada nível reúne exercícios, reflexões e práticas compatíveis com o plano.',
    updated_at = now()
where question = 'Os Conteúdos Guiados são iguais em todos os planos?';

update public.faq_items
set answer = 'A Orientação Mensal é um recurso do Plus para enviar uma questão específica e receber uma resposta preparada cuidadosamente por profissional habilitado, com base nos pontos solicitados e apenas no contexto necessário que você escolheu compartilhar. É possível enviar 1 orientação por mês até o dia 23, com resposta em até 7 dias corridos após o envio. É uma orientação pontual: não é psicoterapia, consulta, diagnóstico ou acompanhamento continuado.',
    updated_at = now()
where question = 'Como funciona a Orientação Mensal?';

update public.faq_items
set answer = 'O Mapa Emocional responde principalmente “como meus registros se distribuíram?”, com visualizações de emoções, contextos, faixas de humor e evolução. Descobertas responde “o que está se repetindo?”, destacando padrões e conexões observáveis. Minha História responde “como minha trajetória foi mudando ao longo do tempo?”, organizando períodos, marcos e temas da sua jornada.',
    updated_at = now()
where question = 'Qual a diferença entre Mapa Emocional, Descobertas e Minha História?';

update public.faq_items
set answer = 'Sim, sem multa. Em Meu Plano, você envia o pedido de cancelamento para análise e recebe a confirmação da data de encerramento, sempre no fim do ciclo já pago. Até essa confirmação e até o final do período pago, o acesso continua normal. Depois, a conta volta ao Gratuito e seus dados permanecem preservados.',
    updated_at = now()
where question = 'Posso cancelar quando quiser?';

update public.faq_items
set answer = 'A plataforma analisa continuamente os dados gerados pelo seu uso — como registros, check-ins, respostas estruturadas e preferências — para organizar automaticamente mapas, descobertas, relatórios, planos e recomendações. Quando há processamento automatizado, é usado apenas o contexto necessário para a funcionalidade. A exceção é a Orientação Mensal: a resposta final é preparada por profissional habilitado a partir da sua solicitação e do contexto escolhido. Nenhum desses recursos produz diagnóstico clínico.',
    updated_at = now()
where question = 'Como meus dados são usados para gerar recursos personalizados?';

insert into public.faq_items (category, question, answer, sort_order, is_active)
select
  'Recursos e funcionalidades',
  'Como cada análise personalizada se diferencia?',
  'Os recursos usam os dados gerados pelo seu uso, mas cumprem papéis diferentes. O Mapa Emocional é visual e mostra distribuições; Descobertas acompanha repetições e conexões em formação; o Relatório Semanal resume um período fechado; o Relatório Mensal aprofunda o mês; Minha História organiza a trajetória entre meses; Meu Jardim representa simbolicamente momentos de cuidado; e o Plano de Autocuidado transforma a análise automática do ciclo em possibilidades de ação. A Orientação Mensal é a exceção: responde a uma questão específica e é preparada por profissional habilitado.',
  235,
  true
where not exists (
  select 1 from public.faq_items
  where question = 'Como cada análise personalizada se diferencia?'
);
