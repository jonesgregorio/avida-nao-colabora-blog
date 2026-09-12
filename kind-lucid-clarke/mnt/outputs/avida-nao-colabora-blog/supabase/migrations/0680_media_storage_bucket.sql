-- ============================================================================
-- 064 — Bucket de Storage para o Estúdio de Mídia
-- ============================================================================
-- Cria o bucket público 'media' e as policies: leitura pública, escrita/remoção
-- apenas por admin. Permite upload real de arquivos (não só cadastro por URL).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública dos arquivos do bucket 'media'.
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
CREATE POLICY "media_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'media');

-- Upload apenas por admin.
DROP POLICY IF EXISTS "media_admin_insert" ON storage.objects;
CREATE POLICY "media_admin_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'media' AND public.is_admin());

-- Atualização apenas por admin.
DROP POLICY IF EXISTS "media_admin_update" ON storage.objects;
CREATE POLICY "media_admin_update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'media' AND public.is_admin());

-- Remoção apenas por admin.
DROP POLICY IF EXISTS "media_admin_delete" ON storage.objects;
CREATE POLICY "media_admin_delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'media' AND public.is_admin());
