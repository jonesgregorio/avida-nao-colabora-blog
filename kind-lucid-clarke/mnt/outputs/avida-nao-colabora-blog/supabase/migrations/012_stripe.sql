-- Adiciona coluna stripe_customer_id no profiles para vincular cliente do Stripe
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Índice para busca rápida pelo customer_id do Stripe (usado no webhook)
CREATE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx ON profiles (stripe_customer_id);
