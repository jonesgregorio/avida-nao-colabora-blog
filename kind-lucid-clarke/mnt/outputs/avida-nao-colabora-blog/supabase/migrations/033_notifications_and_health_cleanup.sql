-- Migration 033: ampliar tipos de notificação e controle de logs do monitoramento

-- 1. Ampliar constraint de tipo em notifications
--    (mantém todos os tipos existentes + adiciona professional_comment e personalized_content)
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'info',
    'alert',
    'promo',
    'system',
    'content',
    'reminder',
    'support_reply',
    'admin_message',
    'professional_comment',
    'plan_change',
    'payment',
    'personalized_content'
  ));

-- 2. Função para limpar logs de monitoramento com mais de 30 dias
--    (preserva sempre o último registro de cada check_key)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  latest_ids UUID[];
BEGIN
  SELECT array_agg(latest_id) INTO latest_ids
  FROM (
    SELECT DISTINCT ON (check_key) id AS latest_id
    FROM system_health_checks
    ORDER BY check_key, checked_at DESC
  ) sub;

  DELETE FROM system_health_checks
  WHERE checked_at < NOW() - INTERVAL '30 days'
    AND (latest_ids IS NULL OR id <> ALL(latest_ids));
END;
$$;

-- 3. Índice para acelerar o load de checks mais recentes por chave
CREATE INDEX IF NOT EXISTS idx_health_checks_key_date
  ON system_health_checks (check_key, checked_at DESC);

-- 4. Limpeza inicial: mantém apenas os 200 registros mais recentes por check_key
DELETE FROM system_health_checks
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY check_key ORDER BY checked_at DESC) AS rn
    FROM system_health_checks
  ) ranked
  WHERE rn > 200
);
