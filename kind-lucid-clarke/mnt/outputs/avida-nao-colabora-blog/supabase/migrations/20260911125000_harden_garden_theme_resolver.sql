-- O resolver é helper interno de get_my_garden_state(): não deve aceitar
-- chamadas diretas para outro usuário via API.
CREATE OR REPLACE FUNCTION public.resolve_user_garden_theme(
  p_user_id uuid,
  p_cycle integer,
  p_forced_slug text DEFAULT NULL
)
RETURNS TABLE(garden_slug text, theme_index smallint)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path=public
AS $$
DECLARE
  v_slug text;
  v_theme smallint;
  v_count integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_forced_slug IS NOT NULL THEN
    SELECT g.slug,g.theme_index INTO v_slug,v_theme
    FROM garden_catalog g WHERE g.slug=p_forced_slug AND g.status<>'archived' LIMIT 1;
    IF v_slug IS NOT NULL THEN RETURN QUERY SELECT v_slug,v_theme; RETURN; END IF;
  END IF;

  SELECT c.garden_slug,c.theme_index INTO v_slug,v_theme
  FROM garden_user_cycles c WHERE c.user_id=p_user_id AND c.cycle_number=p_cycle;
  IF v_slug IS NOT NULL THEN RETURN QUERY SELECT v_slug,v_theme; RETURN; END IF;

  SELECT count(*)::int INTO v_count
  FROM garden_catalog g
  WHERE g.status IN ('active','queued') AND (g.release_at IS NULL OR g.release_at<=now());

  IF v_count>0 THEN
    SELECT g.slug,g.theme_index INTO v_slug,v_theme
    FROM garden_catalog g
    WHERE g.status IN ('active','queued') AND (g.release_at IS NULL OR g.release_at<=now())
    ORDER BY g.queue_position NULLS LAST,g.theme_index
    OFFSET (p_cycle%v_count) LIMIT 1;

    INSERT INTO garden_user_cycles(user_id,cycle_number,garden_slug,theme_index)
    VALUES(p_user_id,p_cycle,v_slug,v_theme)
    ON CONFLICT(user_id,cycle_number) DO NOTHING;

    SELECT c.garden_slug,c.theme_index INTO v_slug,v_theme
    FROM garden_user_cycles c WHERE c.user_id=p_user_id AND c.cycle_number=p_cycle;
  ELSE
    v_theme:=(p_cycle%8)::smallint;
    v_slug:=NULL;
  END IF;

  RETURN QUERY SELECT v_slug,v_theme;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_user_garden_theme(uuid,integer,text) FROM PUBLIC,anon,authenticated;
