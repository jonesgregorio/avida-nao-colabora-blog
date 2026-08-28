-- Anexos privados do Suporte.
--
-- Contrato:
-- - bucket dedicado e não público;
-- - máximo de 5 MB por arquivo;
-- - somente JPEG, PNG, WEBP e PDF;
-- - caminho obrigatório: <user_id>/<ticket_id>/<arquivo>;
-- - usuário autenticado só lê/envia/remove anexos de tickets próprios;
-- - administradores podem ler/enviar/remover anexos para atendimento;
-- - nenhuma URL pública é criada.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "support_attachments_user_select" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_user_insert" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_user_delete" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_admin_select" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "support_attachments_admin_delete" ON storage.objects;

CREATE POLICY "support_attachments_user_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[2]
        AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "support_attachments_user_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[2]
        AND st.user_id = auth.uid()
        AND st.status NOT IN ('resolved', 'closed')
    )
  );

CREATE POLICY "support_attachments_user_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets st
      WHERE st.id::text = (storage.foldername(name))[2]
        AND st.user_id = auth.uid()
    )
  );

CREATE POLICY "support_attachments_admin_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND public.is_admin()
  );

CREATE POLICY "support_attachments_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND public.is_admin()
  );

CREATE POLICY "support_attachments_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'support-attachments'
    AND public.is_admin()
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'support-attachments'
      AND public = false
      AND file_size_limit = 5242880
  ) THEN
    RAISE EXCEPTION 'support attachments private bucket missing or misconfigured';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN (
        'support_attachments_user_select',
        'support_attachments_user_insert',
        'support_attachments_user_delete',
        'support_attachments_admin_select',
        'support_attachments_admin_insert',
        'support_attachments_admin_delete'
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'support attachment storage policies incomplete';
  END IF;
END;
$$;
