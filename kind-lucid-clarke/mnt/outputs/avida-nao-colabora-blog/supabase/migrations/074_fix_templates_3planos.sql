-- ============================================================================
-- 074 — Atualiza e-mails e respostas automáticas para o modelo de 3 planos
-- ============================================================================
-- Remove info do modelo antigo (Terapêutico, Terapêutico Plus, R$ 79,90,
-- sessão mensal com Psicanalista, anúncios, "suporte prioritário máximo") e
-- alinha ao atual: Gratuito (R$ 0) / Essencial (R$ 19,90) / Plus (R$ 39,90) e
-- as 5 funcionalidades (diário, mapa emocional, conteúdos guiados, plano de
-- autocuidado, orientação profissional).
-- ============================================================================

-- ── A) E-mails transacionais: desativa os de "sessão mensal" (recurso removido)
UPDATE email_templates
  SET is_active = false, updated_at = now()
  WHERE template_key IN ('session_requested', 'session_scheduled', 'session_rescheduled', 'session_cancelled');

-- ── B) Respostas automáticas de suporte (support_reply_templates) ────────────

UPDATE support_reply_templates SET updated_at = now(), body =
'Olá! Hoje temos 3 planos:

Gratuito (R$ 0): blog aberto, diário emocional básico, questionário inicial e algumas práticas guiadas.

Essencial (R$ 19,90/mês): diário ilimitado, mapa emocional completo, histórico e gráficos, conteúdos guiados completos e relatório semanal automático.

Plus (R$ 39,90/mês): tudo do Essencial e ainda plano de autocuidado mensal, relatório mensal aprofundado, comentário profissional mensal e orientação mensal por mensagem.

Se quiser, te ajudo a escolher o que faz mais sentido para o seu momento.'
WHERE title = 'Diferença entre os planos';

UPDATE support_reply_templates SET updated_at = now(), body =
'O plano Gratuito é uma forma de começar a usar o site sem compromisso. Ele inclui o blog aberto, o diário emocional básico, o questionário inicial e algumas práticas guiadas.'
WHERE title = 'Plano Gratuito';

UPDATE support_reply_templates SET updated_at = now(), body =
'O plano Essencial custa R$ 19,90 por mês, para quem quer usar o site de forma contínua. Inclui tudo do Gratuito e também diário ilimitado, mapa emocional completo, histórico e gráficos de evolução, conteúdos guiados completos e relatório semanal automático.'
WHERE title = 'Plano Essencial';

UPDATE support_reply_templates SET updated_at = now(), title = 'Plano Plus', category = 'Planos', body =
'O plano Plus custa R$ 39,90 por mês e é o mais completo. Inclui tudo do Essencial e também plano de autocuidado mensal, relatório mensal aprofundado, comentário profissional mensal e orientação mensal por mensagem.'
WHERE title = 'Plano Terapêutico';

UPDATE support_reply_templates SET updated_at = now(), body =
'Para escolher, pense no seu uso. Se você quer apenas conhecer o site, o Gratuito já basta. Se quer registrar emoções com frequência e acompanhar sua evolução, o Essencial costuma fazer mais sentido. Se quer também plano de autocuidado mensal, relatório aprofundado e orientação profissional mensal, o Plus é o mais completo.'
WHERE title = 'Qual plano escolher';

UPDATE support_reply_templates SET updated_at = now(), body =
'A orientação mensal por mensagem é um recurso do plano Plus: uma vez por mês você recebe uma orientação escrita, com base nos seus registros. Ela é um apoio ao autoconhecimento e não substitui acompanhamento psicológico ou médico.'
WHERE title = 'Orientação mensal por mensagem';

UPDATE support_reply_templates SET updated_at = now(), body =
'No plano Plus, você pode receber um comentário profissional mensal sobre o resumo do seu mês, com um olhar cuidadoso sobre os seus registros. É um apoio à sua organização emocional e não substitui acompanhamento clínico.'
WHERE title = 'Comentário sobre relatório do mês';

UPDATE support_reply_templates SET updated_at = now(), title = 'Atendimento ao assinante Plus', body =
'Olá! Como assinante do plano Plus, sua solicitação recebe atenção prioritária. Já estamos cuidando dela e retornamos o mais rápido possível.'
WHERE title = 'Atendimento prioritário Plus';

-- ── C) Desativa respostas de planos/recursos que não existem mais ────────────
UPDATE support_reply_templates
  SET is_active = false, updated_at = now()
  WHERE title IN ('Plano Terapêutico Plus', 'Sessão mensal Plus');
