-- ============================================================
-- Migration 036: RLS por plano em questionnaires
-- ============================================================
-- A migration 013 ativou RLS mas a política permite acesso público a
-- qualquer questionário com status='published', sem verificar plan_required.
-- Esta migration refina para filtrar por plano do usuário.

-- Remove política anterior permissiva
DROP POLICY IF EXISTS "Questionários públicos visíveis" ON questionnaires;

-- Usuários autenticados veem questionários ativos do seu plano ou inferiores
CREATE POLICY "users_read_accessible_questionnaires" ON questionnaires
  FOR SELECT USING (
    is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND (status = 'published' OR COALESCE(active, false) = true)
      AND (
        plan_required IS NULL
        OR plan_required = 'free'
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND (
              (plan_required = 'essential'        AND p.plan IN ('essential', 'therapeutic', 'therapeutic-plus'))
              OR (plan_required = 'therapeutic'   AND p.plan IN ('therapeutic', 'therapeutic-plus'))
              OR (plan_required = 'therapeutic-plus' AND p.plan = 'therapeutic-plus')
              OR p.is_admin = true
              OR p.role = 'admin'
            )
        )
      )
    )
  );

-- Mantém política admin intacta (já existe da migration 013)
-- DROP POLICY IF EXISTS "Admin gerencia questionários" ON questionnaires;
-- (não recriar — a 013 já criou com is_admin())
