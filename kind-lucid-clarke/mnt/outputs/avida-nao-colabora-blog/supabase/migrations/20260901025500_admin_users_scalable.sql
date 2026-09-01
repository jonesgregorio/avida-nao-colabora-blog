-- P3.22 — AdminUsers escalável: paginação e agregados no servidor.
-- Mantém o gate administrativo existente: public.is_admin() exige sessão admin/AAL2.

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status
  ON public.support_tickets (user_id, status);

CREATE OR REPLACE FUNCTION public.admin_users_stats_v2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'newThisMonth', COUNT(*) FILTER (WHERE p.created_at >= date_trunc('month', now())),
    'paying', COUNT(*) FILTER (WHERE COALESCE(p.plan, 'free') <> 'free'),
    'blocked', COUNT(*) FILTER (WHERE COALESCE(p.account_status, 'active') = 'blocked'),
    'withDiscount', COUNT(*) FILTER (WHERE COALESCE(p.discount_percent, 0) > 0 OR COALESCE(p.discount_fixed, 0) > 0),
    'unlimitedAccess', COUNT(*) FILTER (WHERE p.unlimited_access IS TRUE),
    'plus', COUNT(*) FILTER (WHERE p.plan IN ('plus', 'therapeutic', 'therapeutic-plus')),
    'essential', COUNT(*) FILTER (WHERE p.plan = 'essential'),
    'free', COUNT(*) FILTER (WHERE COALESCE(p.plan, 'free') = 'free'),
    'cancelled', COUNT(*) FILTER (WHERE COALESCE(p.account_status, 'active') = 'cancelled'),
    'openTickets', (
      SELECT COUNT(*)
      FROM public.support_tickets st
      WHERE st.status NOT IN ('closed', 'resolved')
    ),
    'usersWithUnreadNotifications', (
      SELECT COUNT(DISTINCT n.user_id)
      FROM public.notifications n
      WHERE n.is_read IS FALSE
    )
  )
  INTO result
  FROM public.profiles p;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_users_v2(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 40,
  p_search text DEFAULT '',
  p_plan text DEFAULT 'all',
  p_status text DEFAULT 'all',
  p_access text DEFAULT 'all'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  safe_page integer := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 40), 1), 200);
  normalized_search text := lower(trim(COALESCE(p_search, '')));
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH filtered AS (
    SELECT p.*
    FROM public.profiles p
    WHERE
      (
        normalized_search = ''
        OR lower(COALESCE(p.full_name, '')) LIKE '%' || normalized_search || '%'
        OR lower(COALESCE(p.email, '')) LIKE '%' || normalized_search || '%'
        OR lower(p.user_id::text) LIKE '%' || normalized_search || '%'
      )
      AND (
        COALESCE(p_plan, 'all') = 'all'
        OR (p_plan = 'plus' AND p.plan IN ('plus', 'therapeutic', 'therapeutic-plus'))
        OR (p_plan <> 'plus' AND COALESCE(p.plan, 'free') = p_plan)
      )
      AND (
        COALESCE(p_status, 'all') = 'all'
        OR COALESCE(p.account_status, 'active') = p_status
      )
      AND (
        COALESCE(p_access, 'all') = 'all'
        OR (p_access = 'discount' AND (COALESCE(p.discount_percent, 0) > 0 OR COALESCE(p.discount_fixed, 0) > 0))
        OR (p_access = 'unlimited' AND p.unlimited_access IS TRUE)
        OR (p_access = 'admin' AND p.role = 'admin')
        OR (
          p_access = 'tickets'
          AND EXISTS (
            SELECT 1
            FROM public.support_tickets st
            WHERE st.user_id = p.user_id
              AND st.status NOT IN ('closed', 'resolved')
          )
        )
      )
  ),
  total AS (
    SELECT COUNT(*)::bigint AS value FROM filtered
  ),
  page_rows AS (
    SELECT p.*
    FROM filtered p
    ORDER BY p.created_at DESC, p.id DESC
    OFFSET (safe_page - 1) * safe_page_size
    LIMIT safe_page_size
  ),
  enriched AS (
    SELECT
      p.id,
      p.user_id,
      p.full_name,
      p.email,
      COALESCE(p.plan, 'free') AS plan,
      p.role,
      p.created_at,
      p.account_status,
      p.unlimited_access,
      p.unlimited_access_until,
      p.unlimited_access_reason,
      p.discount_percent,
      p.discount_fixed,
      p.admin_tags,
      p.last_seen_at,
      COALESCE(t.open_tickets, 0)::bigint AS open_tickets,
      COALESCE(n.unread_notifs, 0)::bigint AS unread_notifs,
      CASE
        WHEN p.last_seen_at IS NULL THEN d.last_diary_at
        WHEN d.last_diary_at IS NULL THEN p.last_seen_at
        ELSE GREATEST(p.last_seen_at, d.last_diary_at)
      END AS last_activity
    FROM page_rows p
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS open_tickets
      FROM public.support_tickets st
      WHERE st.user_id = p.user_id
        AND st.status NOT IN ('closed', 'resolved')
    ) t ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS unread_notifs
      FROM public.notifications n
      WHERE n.user_id = p.user_id
        AND n.is_read IS FALSE
    ) n ON TRUE
    LEFT JOIN LATERAL (
      SELECT MAX(d.created_at) AS last_diary_at
      FROM public.diary_entries d
      WHERE d.user_id = p.user_id
    ) d ON TRUE
  )
  SELECT jsonb_build_object(
    'total', (SELECT value FROM total),
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC, e.id DESC) FROM enriched e), '[]'::jsonb)
  )
  INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_users_stats_v2() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users_v2(integer, integer, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_stats_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users_v2(integer, integer, text, text, text, text) TO authenticated;
