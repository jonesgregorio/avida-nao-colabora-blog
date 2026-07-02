-- ============================================================
-- Migration 036: RLS por plano em questionnaires
-- ============================================================
-- A migration 013 ativou RLS mas a política permite acesso público a
-- qualquer questionário com status='published', sem verificar plan_required.
-- Esta migration refina para filtrar por plano do usuário.

-- Remove políticas anteriores permissivas
DROP POLICY IF EXISTS "Questionários públicos visíveis" ON questionnaires;
DROP POLICY IF EXISTS "users_read_accessible_questionnaires" ON questionnaires;

-- Política 1: questionários gratuitos são visíveis para qualquer visitante (inclusive sem login)
-- Alinhado com o comportamento do app: usuários anônimos podem ver e iniciar questionários free
CREATE POLICY "anon_read_free_questionnaires" ON questionnaires
  FOR SELECT USING (
    (status = 'published' OR COALESCE(active, false) = true)
    AND (plan_required IS NULL OR plan_required = 'free')
  );

-- Política 2: questionários pagos exigem login + plano adequado
CREATE POLICY "auth_read_paid_questionnaires" ON questionnaires
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'published' OR COALESCE(active, false) = true)
    AND plan_required IS NOT NULL
    AND plan_required != 'free'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND (
            (plan_required = 'essential'          AND p.plan IN ('essential', 'therapeutic', 'therapeutic-plus'))
            OR (plan_required = 'therapeutic'     AND p.plan IN ('therapeutic', 'therapeutic-plus'))
            OR (plan_required = 'therapeutic-plus' AND p.plan = 'therapeutic-plus')
            OR p.is_admin = true
            OR p.role = 'admin'
          )
      )
    )
  );

-- Mantém política admin intacta (já existe da migration 013)
-- (não recriar — a 013 já criou com is_admin())
