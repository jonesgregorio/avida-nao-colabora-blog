-- Migration 033: ampliar tipos de notificação e limpar logs antigos de monitoramento

-- 1. Ampliar constraint de tipo em notifications
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
    'personalized_content'
  ));

-- 2. Adicionar coluna action_view em notifications se ainda não existir
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_view TEXT DEFAULT NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_label TEXT DEFAULT NULL;

-- 3. Função para limpar logs de monitoramento com mais de 30 dias
-- (preserva sempre o último registro de cada check_key)
CREATE OR REPLACE FUNCTION cleanup_old_health_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM system_health_checks
  WHERE checked_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (
      SELECT DISTINCT ON (check_key) id
      FROM system_health_checks
      ORDER BY check_key, checked_at DESC
    );
END;
$$;

-- 4. Índice para acelerar o load de checks mais recentes por chave
CREATE INDEX IF NOT EXISTS idx_health_checks_key_date
  ON system_health_checks (check_key, checked_at DESC);

-- 5. Remover registros duplicados de monitoramento (mantém apenas 200 mais recentes por chave)
-- Executa uma limpeza inicial controlada
DELETE FROM system_health_checks
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY check_key ORDER BY checked_at DESC) AS rn
    FROM system_health_checks
  ) ranked
  WHERE rn > 200
);
