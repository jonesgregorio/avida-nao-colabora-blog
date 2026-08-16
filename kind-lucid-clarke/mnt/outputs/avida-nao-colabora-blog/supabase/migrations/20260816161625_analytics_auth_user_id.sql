-- Analytics usa auth.users.id: é o identificador entregue pelo cliente autenticado.
-- Normaliza eventos legados que ainda apontavam para profiles.id antes da nova FK.
UPDATE public.analytics_events e
SET user_id = p.user_id
FROM public.profiles p
WHERE e.user_id = p.id
  AND p.user_id IS NOT NULL;

ALTER TABLE public.analytics_events
  DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Eventos públicos continuam possíveis, mas uma sessão autenticada só pode gravar
-- o seu próprio auth.uid(); isso evita forjar eventos em nome de outro usuário.
DROP POLICY IF EXISTS "Qualquer um pode inserir evento" ON public.analytics_events;
DROP POLICY IF EXISTS "ae_public_insert" ON public.analytics_events;
CREATE POLICY "ae_anon_insert" ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
CREATE POLICY "ae_authenticated_insert" ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = (select auth.uid()));
