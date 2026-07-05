-- ============================================================
-- Migration 051: Destaque (negrito) no NOME DO PLANO nos e-mails.
-- O send-transactional-email passou a converter **texto** em <strong>
-- na cor da marca. Aqui envolvemos as variáveis de plano no CORPO
-- (nunca no assunto) com ** para virarem negrito.
-- Idempotente: só aplica se ainda não estiver em negrito.
-- Não altera plano/preço/benefício/hierarquia — só a apresentação.
-- ============================================================

UPDATE email_templates SET body_text = REPLACE(body_text, '{{plano}}', '**{{plano}}**')
  WHERE body_text LIKE '%{{plano}}%' AND body_text NOT LIKE '%**{{plano}}**%';

UPDATE email_templates SET body_text = REPLACE(body_text, '{{plano_atual}}', '**{{plano_atual}}**')
  WHERE body_text LIKE '%{{plano_atual}}%' AND body_text NOT LIKE '%**{{plano_atual}}**%';

UPDATE email_templates SET body_text = REPLACE(body_text, '{{plano_novo}}', '**{{plano_novo}}**')
  WHERE body_text LIKE '%{{plano_novo}}%' AND body_text NOT LIKE '%**{{plano_novo}}**%';

UPDATE email_templates SET body_text = REPLACE(body_text, '{{plano_antigo}}', '**{{plano_antigo}}**')
  WHERE body_text LIKE '%{{plano_antigo}}%' AND body_text NOT LIKE '%**{{plano_antigo}}**%';

UPDATE email_templates SET body_text = REPLACE(body_text, '{{plano_anterior}}', '**{{plano_anterior}}**')
  WHERE body_text LIKE '%{{plano_anterior}}%' AND body_text NOT LIKE '%**{{plano_anterior}}**%';
