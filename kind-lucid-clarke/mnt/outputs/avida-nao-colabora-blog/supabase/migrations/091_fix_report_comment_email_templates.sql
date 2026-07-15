-- ============================================================================
-- 091 — Corrige o TEXTO de mais dois e-mails + desativa templates legados
-- ============================================================================
-- Mesma classe de bug do 090: o link já é o correto (via variável), mas o texto
-- do corpo (seedado no 049 e "renomeado" no 079) mandava o usuário para a área
-- "Mapa Emocional" quando deveria citar a página correta.
--   • monthly_report_available  → página de Relatórios (link {{link_relatorios}})
--   • professional_comment_available → Comentário profissional ({{link_comentarios}})
-- Também desativa os 4 templates de "sessão" (recurso removido do produto).
-- ============================================================================

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Seu relatório mensal já está disponível na sua página de Relatórios.

Você pode acessar o resumo do período, acompanhar registros e visualizar os dados conforme os recursos do seu plano.

Acessar relatório:
{{link_relatorios}}

Equipe A Vida Não Colabora$b$,
  body_html = '',
  updated_at = now()
WHERE template_key = 'monthly_report_available';

UPDATE email_templates SET
  body_text = $b$Olá, {{nome}}.

Há um novo comentário profissional disponível na sua conta, na área de Comentário profissional.

Para preservar sua privacidade, o conteúdo completo fica disponível apenas dentro da sua conta.

Acessar comentário:
{{link_comentarios}}

Equipe A Vida Não Colabora$b$,
  body_html = '',
  updated_at = now()
WHERE template_key = 'professional_comment_available';

-- Templates legados de "sessão" (o produto usa Orientação por mensagem).
UPDATE email_templates SET is_active = false, updated_at = now()
WHERE template_key IN ('session_requested', 'session_scheduled', 'session_rescheduled', 'session_cancelled');
