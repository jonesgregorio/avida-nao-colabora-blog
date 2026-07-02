-- ============================================================
-- Migration 036: RLS por plano em questionnaires (reescrita)
-- ============================================================
-- Regras:
--   questionário free  → qualquer visitante (auth ou anon) pode SELECT
--   questionário essential → authenticated com plan IN (essential, therapeutic, therapeutic-plus) ou admin
--   questionário therapeutic → authenticated com plan IN (therapeutic, therapeutic-plus) ou admin
--   questionário therapeutic-plus → authenticated com plan = therapeutic-plus ou admin
--   admin → SELECT em tudo

-- Remove políticas anteriores (permissivas ou desta migration)
DROP POLICY IF EXISTS "Questionários públicos visíveis" ON questionnaires;
DROP POLICY IF EXISTS "users_read_accessible_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "anon_read_free_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_paid_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "any_read_free_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_essential_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_therapeutic_questionnaires" ON questionnaires;
DROP POLICY IF EXISTS "auth_read_therapeutic_plus_questionnaires" ON questionnaires;

-- Política 1: questionários gratuitos (plan_required IS NULL ou 'free')
-- Qualquer visitante (autenticado ou anônimo) pode ver
CREATE POLICY "any_read_free_questionnaires" ON questionnaires
  FOR SELECT USING (
    (status = 'published' OR COALESCE(active, false) = true)
    AND (plan_required IS NULL OR plan_required = 'free')
  );

-- Política 2: questionários essential → auth com plan adequado ou admin
CREATE POLICY "auth_read_essential_questionnaires" ON questionnaires
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'published' OR COALESCE(active, false) = true)
    AND plan_required = 'essential'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
          AND (
            p.plan IN ('essential', 'therapeutic', 'therapeutic-plus')
            OR p.role = 'admin'
          )
      )
    )
  );

-- Política 3: questionários therapeutic → auth com plan adequado ou admin
CREATE POLICY "auth_read_therapeutic_questionnaires" ON questionnaires
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'published' OR COALESCE(active, false) = true)
    AND plan_required = 'therapeutic'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
          AND (
            p.plan IN ('therapeutic', 'therapeutic-plus')
            OR p.role = 'admin'
          )
      )
    )
  );

-- Política 4: questionários therapeutic-plus → auth com plan adequado ou admin
CREATE POLICY "auth_read_therapeutic_plus_questionnaires" ON questionnaires
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (status = 'published' OR COALESCE(active, false) = true)
    AND plan_required = 'therapeutic-plus'
    AND (
      is_admin()
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
          AND (
            p.plan = 'therapeutic-plus'
            OR p.role = 'admin'
          )
      )
    )
  );

-- Mantém política admin intacta (já existe da migration 013)
-- (não recriar — a 013 já criou com is_admin())
