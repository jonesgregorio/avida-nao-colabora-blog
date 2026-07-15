-- ============================================================================
-- 090 — Corrige o e-mail do Plano de Autocuidado (texto + assunto)
-- ============================================================================
-- O template `self_care_plan_available` (seedado no 049 e "renomeado" no 079)
-- ficou dizendo "no seu Mapa Emocional" e assunto "foi atualizado" — mandando o
-- usuário para a área errada. O destino correto é a página Plano de Autocuidado.
-- O link já usa {{link_autocuidado}} (corrigido no client para /plano-de-autocuidado);
-- aqui corrigimos o TEXTO e o assunto do template guardado no banco.
--
-- Também alinha o template de conteúdo personalizado, que aponta para a mesma
-- página (as entregas aparecem dentro do Plano de Autocuidado).
-- ============================================================================

UPDATE email_templates SET
  subject   = 'Seu Plano de Autocuidado está disponível',
  preheader = 'Seu Plano de Autocuidado mensal já está disponível.',
  body_text = $b$Olá, {{nome}}.

Seu Plano de Autocuidado mensal já está disponível.

Você pode acessar as sugestões, prioridades e próximos passos diretamente na sua página Plano de Autocuidado.

Acessar plano:
{{link_autocuidado}}

Equipe A Vida Não Colabora$b$,
  body_html = '',
  updated_at = now()
WHERE template_key = 'self_care_plan_available';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Preparamos uma nova recomendação personalizada para você.

Para preservar sua privacidade, o conteúdo completo fica disponível apenas dentro da sua conta, na página Plano de Autocuidado.

Acessar conteúdo:
{{link_para_voce}}

Equipe A Vida Não Colabora$b$,
  body_html = '',
  updated_at = now()
WHERE template_key = 'personalized_content_available';
