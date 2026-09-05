-- Fecha uma policy legada de comentários que aceitava qualquer user_id em
-- inserções feitas por um usuário autenticado. A tabela está atualmente vazia,
-- mas mantemos compatibilidade para uso futuro exigindo autoria real pelo JWT.

DROP POLICY IF EXISTS "Authenticated users can comment" ON public.comments;

CREATE POLICY "Authenticated users can comment"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
