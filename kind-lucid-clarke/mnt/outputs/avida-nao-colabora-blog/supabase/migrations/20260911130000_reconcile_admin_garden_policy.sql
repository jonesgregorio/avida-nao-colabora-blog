-- Reconcilia a policy de auditoria quando o schema de Gestão de Jardins
-- já tiver sido aplicado previamente no ambiente de produção.
-- A operação é idempotente e preserva a mesma regra de acesso administrativo.

DROP POLICY IF EXISTS garden_audit_insert_admin ON public.garden_admin_audit;
CREATE POLICY garden_audit_insert_admin
  ON public.garden_admin_audit
  FOR INSERT
  WITH CHECK (is_admin());
