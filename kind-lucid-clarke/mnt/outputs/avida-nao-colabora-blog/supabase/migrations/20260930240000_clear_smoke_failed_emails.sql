-- Limpa do histórico de e-mails os registros das contas técnicas do smoke de produção
-- (prod-smoke-*@example.com). Eram 6 e-mails automáticos de lembrete que falharam
-- ("Invalid `to` field"), porque example.com não recebe e-mail, e apareciam como pendências
-- com botão "Reenviar" no Admin. Escopo restrito ao padrão técnico; e-mails de usuários reais
-- não são afetados.

delete from public.email_logs
where lower(coalesce(to_email, email, '')) like 'prod-smoke-%@example.com';
