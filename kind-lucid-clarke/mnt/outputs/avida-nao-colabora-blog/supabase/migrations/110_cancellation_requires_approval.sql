-- ============================================================================
-- 110 — Cancelamento passa a exigir APROVAÇÃO do admin
-- ============================================================================
-- Regra nova: quando o usuário pede cancelamento, NADA é enviado ao Stripe na
-- hora. O pedido entra como 'pending_approval' e só é agendado no Stripe
-- (cancel_at_period_end=true) quando o admin APROVA na aba Cancelamentos
-- (Edge Function admin-schedule-cancellation), que então marca 'scheduled'.
--
-- Aqui: (1) ampliamos o CHECK de subscription_change_feedback.status para
-- aceitar 'pending_approval'; (2) adicionamos um template de e-mail que avisa o
-- usuário de que o pedido foi RECEBIDO e está em análise (sem prometer data,
-- pois a data só é fixada na aprovação). Tudo aditivo/idempotente.
-- ============================================================================

-- 1) Ampliar o CHECK de status. O constraint foi criado inline na 094 (nome
--    auto-gerado); descobrimos o nome real e o recriamos como SUPERCONJUNTO —
--    seguro, pois todas as linhas existentes já usam valores permitidos.
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'subscription_change_feedback'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%'
    AND pg_get_constraintdef(oid) ILIKE '%scheduled%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE subscription_change_feedback DROP CONSTRAINT %I', cname);
  END IF;

  ALTER TABLE subscription_change_feedback
    ADD CONSTRAINT subscription_change_feedback_status_check
    CHECK (status IN ('pending_approval','scheduled','completed','reverted'));
END $$;

COMMENT ON COLUMN subscription_change_feedback.status IS
  'pending_approval=pedido do usuário aguardando aprovação do admin (nada no Stripe ainda); scheduled=aprovado e agendado no Stripe p/ fim do ciclo; completed=encerrado; reverted=usuário desistiu (110).';

-- 2) E-mail ao usuário: pedido RECEBIDO e em análise (não promete data).
INSERT INTO email_templates (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
  ('plan_cancel_pending_review',
   'Recebemos seu pedido de cancelamento',
   'Seu pedido está em análise — você mantém acesso normalmente.',
   $b$Olá, {{nome}}.

Recebemos seu pedido de cancelamento do plano {{plano_atual}} e ele está em análise pela nossa equipe.

Enquanto isso, você continua com acesso normal a tudo do seu plano — nada muda até a confirmação. Assim que o cancelamento for confirmado, avisaremos a data em que seu plano será encerrado (sempre no fim do ciclo já pago).

Mudou de ideia? Você pode retirar o pedido a qualquer momento na sua conta:
{{link_meu_plano}}

Com carinho,
Equipe A Vida Não Colabora$b$,
   '', 'account', true)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject, preheader = EXCLUDED.preheader, body_text = EXCLUDED.body_text,
  category = EXCLUDED.category, is_active = true, updated_at = now();
