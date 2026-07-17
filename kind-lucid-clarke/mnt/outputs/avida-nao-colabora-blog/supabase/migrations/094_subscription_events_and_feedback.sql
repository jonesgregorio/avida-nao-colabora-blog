-- ============================================================================
-- 094 — Histórico financeiro (subscription_events) + motivos de saída
-- ============================================================================
-- Base para: aba "Assinatura e Pagamentos" no perfil, Analytics Financeiro e
-- motivo obrigatório de cancelamento/downgrade.
--
-- Hoje o histórico está espalhado: plan_change_history (mudança de plano) e
-- payment_events (dinheiro), nenhum com motivo nem referência ao evento Stripe.
-- `subscription_events` vira a linha do tempo única, alimentada pelo webhook
-- (fonte de verdade = Stripe) e pelo manage-subscription (ação do usuário).
--
-- Aditivo e idempotente. Não altera nem apaga nada existente.
-- ============================================================================

-- ── 1. Motivos de cancelamento/downgrade ────────────────────────────────────
-- Lista oficial e fechada (§10). Um CHECK por elemento impede motivo inventado
-- entrar pelo banco, mesmo que alguém chame a API por fora.
CREATE TABLE IF NOT EXISTS subscription_change_feedback (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id        UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT,
  change_type            TEXT NOT NULL CHECK (change_type IN ('cancellation','downgrade')),
  current_plan           TEXT NOT NULL,
  target_plan            TEXT NOT NULL,
  reasons                TEXT[] NOT NULL,
  comment                TEXT,
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_at           TIMESTAMPTZ,
  status                 TEXT NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled','completed','reverted')),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- reasons nunca pode ser vazio (§12) …
  CONSTRAINT scf_reasons_nao_vazio CHECK (array_length(reasons, 1) >= 1),
  -- … e todo motivo precisa pertencer à lista oficial.
  CONSTRAINT scf_reasons_oficiais CHECK (
    reasons <@ ARRAY[
      'financial','bugs','missing_feature','content_not_expected',
      'chose_competitor','did_not_understand_features','other'
    ]::TEXT[]
  ),
  -- "Outro motivo" exige comentário (§9). Validado também no back-end.
  CONSTRAINT scf_other_exige_comentario CHECK (
    NOT ('other' = ANY(reasons)) OR (comment IS NOT NULL AND btrim(comment) <> '')
  )
);

CREATE INDEX IF NOT EXISTS idx_scf_user       ON subscription_change_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_scf_tipo       ON subscription_change_feedback(change_type);
CREATE INDEX IF NOT EXISTS idx_scf_requested  ON subscription_change_feedback(requested_at DESC);
-- GIN: permite filtrar por motivo no Analytics (reasons @> ARRAY['financial']).
CREATE INDEX IF NOT EXISTS idx_scf_reasons    ON subscription_change_feedback USING GIN (reasons);

ALTER TABLE subscription_change_feedback ENABLE ROW LEVEL SECURITY;

-- Usuário lê só o que é dele. NÃO há policy de INSERT/UPDATE para o usuário:
-- quem grava é o manage-subscription (service role), que valida os motivos —
-- assim ninguém adultera motivo de outro nem forja feedback pelo client (§18).
DROP POLICY IF EXISTS "scf_own_select" ON subscription_change_feedback;
CREATE POLICY "scf_own_select" ON subscription_change_feedback
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "scf_admin_all" ON subscription_change_feedback;
CREATE POLICY "scf_admin_all" ON subscription_change_feedback
  FOR ALL USING (is_admin());

-- ── 2. Linha do tempo financeira ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_events (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id        UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  stripe_invoice_id      TEXT,
  stripe_event_id        TEXT,
  event_type             TEXT NOT NULL CHECK (event_type IN (
    'subscription_created','checkout_completed','payment_confirmed','payment_failed',
    'subscription_renewed','upgrade_confirmed','downgrade_requested','downgrade_completed',
    'cancellation_requested','cancellation_completed','subscription_deleted','plan_changed'
  )),
  previous_plan          TEXT,
  new_plan               TEXT,
  amount                 NUMERIC,          -- em REAIS (mesma convenção de payment_events)
  currency               TEXT DEFAULT 'BRL',
  status                 TEXT,
  reasons                TEXT[],
  comment                TEXT,
  metadata               JSONB DEFAULT '{}'::JSONB,
  occurred_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_se_user     ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_se_tipo     ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_se_occurred ON subscription_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_se_reasons  ON subscription_events USING GIN (reasons);

-- Mesmo evento do Stripe não pode virar duas linhas do mesmo tipo (§14: idempotência).
-- Índice parcial: eventos internos (sem stripe_event_id) não entram na regra.
CREATE UNIQUE INDEX IF NOT EXISTS idx_se_stripe_event_unico
  ON subscription_events(stripe_event_id, event_type)
  WHERE stripe_event_id IS NOT NULL;

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Só leitura para o dono; escrita apenas via service role (webhook/functions).
DROP POLICY IF EXISTS "se_own_select" ON subscription_events;
CREATE POLICY "se_own_select" ON subscription_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "se_admin_all" ON subscription_events;
CREATE POLICY "se_admin_all" ON subscription_events
  FOR ALL USING (is_admin());

-- ── 3. Carimbos financeiros na assinatura ───────────────────────────────────
-- Data/hora REAL vinda da invoice paga (§4) — nunca do navegador.
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_payment_confirmed_at TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_payment_failed_at    TIMESTAMPTZ;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS last_payment_amount       NUMERIC;
ALTER TABLE user_subscriptions ADD COLUMN IF NOT EXISTS subscription_created_at   TIMESTAMPTZ;

COMMENT ON COLUMN user_subscriptions.last_payment_confirmed_at IS
  'Quando o Stripe confirmou o pagamento (invoice.payment_succeeded). Fonte: webhook (094).';
COMMENT ON COLUMN user_subscriptions.last_payment_failed_at IS
  'Última tentativa recusada (invoice.payment_failed). Fonte: webhook (094).';
COMMENT ON COLUMN user_subscriptions.subscription_created_at IS
  'Criação da assinatura no Stripe (subscription.created / created da subscription).';

COMMENT ON TABLE subscription_events IS
  'Linha do tempo financeira: alimenta perfil do usuário, histórico e Analytics Financeiro (094).';
COMMENT ON TABLE subscription_change_feedback IS
  'Motivos (múltiplos) de cancelamento/downgrade. reasons restrito à lista oficial por CHECK (094).';
