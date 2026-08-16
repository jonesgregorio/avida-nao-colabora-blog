-- Evita que o painel ou uma chamada direta à API deixem a plataforma sem
-- administrador. O advisory lock também cobre duas revogações simultâneas.
CREATE OR REPLACE FUNCTION public.prevent_last_admin_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role IS DISTINCT FROM 'admin' THEN
    PERFORM pg_advisory_xact_lock(hashtext('public.profiles:last_admin'));
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE role = 'admin'
        AND user_id IS DISTINCT FROM OLD.user_id
    ) THEN
      RAISE EXCEPTION 'não é permitido remover o último administrador';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_admin_removal ON public.profiles;
CREATE TRIGGER trg_prevent_last_admin_removal
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_last_admin_removal();
