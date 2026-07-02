-- ============================================================
-- Migration 042: Colunas pending em user_subscriptions,
--                política INSERT mais restritiva em profiles,
--                RPC mark_personalized_content_as_read
-- ============================================================

-- 1. Colunas adicionais de pending em user_subscriptions (item 6)
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS pending_plan_key TEXT,
  ADD COLUMN IF NOT EXISTS pending_change_type TEXT,
  ADD COLUMN IF NOT EXISTS pending_change_status TEXT DEFAULT 'scheduled';

-- 2. Fortalecer política INSERT em profiles (item 9)
--    Garante que novos registros não possam ter unlimited_access=true
DROP POLICY IF EXISTS "users_insert_own_profile" ON profiles;
CREATE POLICY "users_insert_own_profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND COALESCE(plan, 'free') = 'free'
    AND COALESCE(role, 'user') = 'user'
    AND COALESCE(unlimited_access, false) = false
  );

-- 3. RPC mark_personalized_content_as_read (item 15)
--    Usuário só marca como lido conteúdo enviado para si mesmo (status=sent).
--    Atualiza o campo status para 'archived' indicando visualização.
DROP FUNCTION IF EXISTS mark_personalized_content_as_read(UUID);
CREATE FUNCTION mark_personalized_content_as_read(delivery_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;

  UPDATE personalized_content_deliveries
  SET status = 'archived', updated_at = now()
  WHERE id = delivery_id
    AND user_id = auth.uid()
    AND status = 'sent';
END;
$$;

GRANT EXECUTE ON FUNCTION mark_personalized_content_as_read(UUID) TO authenticated;
