-- ============================================================
-- Migration 053: Auditoria admin (admin_logs) via TRIGGERS
--   - Garante colunas usadas pela UI (idempotente; já existem).
--   - INSERT em admin_logs restrito a is_admin() (integridade —
--     antes era WITH CHECK true, qualquer um inseria log falso).
--   - Função log_admin_change() + triggers nas tabelas de escrita
--     EXCLUSIVA de admin -> gravam auditoria automaticamente,
--     server-side (impossível esquecer ou burlar pelo cliente).
--   admin_logs JÁ EXISTE (migration 007) — não recriar.
-- Idempotente.
-- ============================================================

ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS details     JSONB;
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS target_type TEXT;
ALTER TABLE admin_logs ADD COLUMN IF NOT EXISTS target_id   TEXT;

-- Integridade: só admin insere auditoria (remove policy permissiva antiga).
DROP POLICY IF EXISTS "Sistema insere logs" ON admin_logs;
DROP POLICY IF EXISTS "admin_logs_insert_admin" ON admin_logs;
CREATE POLICY "admin_logs_insert_admin" ON admin_logs
  FOR INSERT WITH CHECK (is_admin());

-- Função de auditoria. SECURITY DEFINER p/ gravar mesmo com a policy acima.
-- O bloco EXCEPTION garante que a auditoria NUNCA quebra a ação principal
-- (um AFTER trigger que falha faria rollback da operação do admin).
CREATE OR REPLACE FUNCTION log_admin_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_row jsonb;
  v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); v_action := 'delete';
  ELSIF TG_OP = 'INSERT' THEN v_row := to_jsonb(NEW); v_action := 'create';
  ELSE v_row := to_jsonb(NEW); v_action := 'update';
  END IF;

  IF TG_TABLE_NAME = 'articles' AND TG_OP <> 'DELETE' AND (v_row->>'status') = 'published' THEN
    v_action := 'publish';
  END IF;

  BEGIN
    INSERT INTO admin_logs (admin_id, action, target_type, target_id, details)
    VALUES (
      auth.uid(),
      v_action,
      TG_TABLE_NAME,
      v_row->>'id',
      jsonb_strip_nulls(jsonb_build_object(
        'title',    v_row->'title',
        'name',     v_row->'name',
        'slug',     v_row->'slug',
        'status',   v_row->'status',
        'label',    v_row->'label',
        'plan_key', v_row->'plan_key',
        'role',     v_row->'role'
      ))
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- auditoria nunca deve interromper a ação principal
  END;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

-- Triggers nas tabelas de escrita EXCLUSIVA de admin (só as que existirem).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'articles','categories','testimonials','site_metrics',
    'plan_configs','plan_feature_access','plan_features',
    'professionals','professional_comments',
    'automated_contents','scheduled_contents','questionnaires','ai_settings'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION log_admin_change()', t);
    END IF;
  END LOOP;
END $$;

-- personalized_content_deliveries: usuário faz UPDATE (marcar lido); só logar o ENVIO (INSERT do admin).
DROP TRIGGER IF EXISTS trg_audit ON personalized_content_deliveries;
DROP TRIGGER IF EXISTS trg_audit_ins ON personalized_content_deliveries;
CREATE TRIGGER trg_audit_ins AFTER INSERT ON personalized_content_deliveries
  FOR EACH ROW EXECUTE FUNCTION log_admin_change();

-- profiles: só quando o PAPEL muda (promover/revogar admin).
DROP TRIGGER IF EXISTS trg_audit_role ON profiles;
CREATE TRIGGER trg_audit_role AFTER UPDATE ON profiles
  FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION log_admin_change();

-- monthly_guidance_requests: usuário cria; só o UPDATE (resposta) é ação de admin.
DROP TRIGGER IF EXISTS trg_audit_guidance ON monthly_guidance_requests;
CREATE TRIGGER trg_audit_guidance AFTER UPDATE ON monthly_guidance_requests
  FOR EACH ROW EXECUTE FUNCTION log_admin_change();
