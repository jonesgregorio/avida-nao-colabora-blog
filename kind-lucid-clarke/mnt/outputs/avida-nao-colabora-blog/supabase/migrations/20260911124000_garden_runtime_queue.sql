-- Liga a fila administrável ao jardim do usuário sem quebrar o contrato atual da UI.
-- garden_index continua sendo monotônico e compatível com gardenThemeFor(index % N):
-- índice codificado = ciclo * quantidade_de_temas + theme_index.

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
  IF p_forced_slug IS NOT NULL THEN
    SELECT g.slug,g.theme_index INTO v_slug,v_theme FROM garden_catalog g WHERE g.slug=p_forced_slug AND g.status<>'archived' LIMIT 1;
    IF v_slug IS NOT NULL THEN RETURN QUERY SELECT v_slug,v_theme; RETURN; END IF;
  END IF;

  SELECT c.garden_slug,c.theme_index INTO v_slug,v_theme
  FROM garden_user_cycles c WHERE c.user_id=p_user_id AND c.cycle_number=p_cycle;
  IF v_slug IS NOT NULL THEN RETURN QUERY SELECT v_slug,v_theme; RETURN; END IF;

  SELECT count(*)::int INTO v_count
  FROM garden_catalog g
  WHERE g.status IN ('active','queued') AND (g.release_at IS NULL OR g.release_at<=now());

  IF v_count > 0 THEN
    SELECT g.slug,g.theme_index INTO v_slug,v_theme
    FROM garden_catalog g
    WHERE g.status IN ('active','queued') AND (g.release_at IS NULL OR g.release_at<=now())
    ORDER BY g.queue_position NULLS LAST,g.theme_index
    OFFSET (p_cycle % v_count) LIMIT 1;

    INSERT INTO garden_user_cycles(user_id,cycle_number,garden_slug,theme_index)
    VALUES(p_user_id,p_cycle,v_slug,v_theme)
    ON CONFLICT (user_id,cycle_number) DO NOTHING;

    SELECT c.garden_slug,c.theme_index INTO v_slug,v_theme
    FROM garden_user_cycles c WHERE c.user_id=p_user_id AND c.cycle_number=p_cycle;
  ELSE
    -- Fallback defensivo para instalações em que o seed ainda não foi aplicado.
    v_theme := (p_cycle % 8)::smallint;
    v_slug := NULL;
  END IF;

  RETURN QUERY SELECT v_slug,v_theme;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_user_garden_theme(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resolve_user_garden_theme(uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_garden_state()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path=public
AS $$
WITH me AS (SELECT auth.uid() AS uid),
di AS (
  SELECT count(DISTINCT COALESCE(date,created_at::date))::int active_days,
         count(DISTINCT COALESCE(date,created_at::date)) FILTER(WHERE entry_type='checkin')::int checkin_days,
         count(DISTINCT COALESCE(date,created_at::date)) FILTER(WHERE entry_type='diary')::int diary_days
  FROM diary_entries,me WHERE user_id=uid
),
qr AS (SELECT count(*)::int responses,count(DISTINCT created_at::date)::int days FROM questionnaire_responses,me WHERE user_id=uid),
rh AS (SELECT count(*)::int reads,count(DISTINCT created_at::date)::int days FROM reading_history,me WHERE user_id=uid),
cp AS (SELECT count(DISTINCT updated_at::date)::int days,count(*) FILTER(WHERE outcome='helped')::int helped FROM care_plan_action_state,me WHERE user_id=uid AND outcome IS NOT NULL),
hi AS (SELECT count(*) FILTER(WHERE item_type='milestone')::int milestones FROM user_history_items,me WHERE user_id=uid),
re AS (SELECT count(*)::int reports FROM reports,me WHERE user_id=uid),
signals AS (
 SELECT COALESCE(di.active_days,0) active_days,COALESCE(di.checkin_days,0) checkin_days,COALESCE(di.diary_days,0) diary_days,
        COALESCE(qr.responses,0) questionnaire_responses,COALESCE(qr.days,0) questionnaire_days,
        COALESCE(rh.reads,0) content_reads,COALESCE(rh.days,0) content_days,
        COALESCE(cp.days,0) care_days,COALESCE(cp.helped,0) helped,COALESCE(hi.milestones,0) milestones,COALESCE(re.reports,0) reports,
        (CASE WHEN COALESCE(di.checkin_days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(di.diary_days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(qr.responses,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(rh.reads,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(cp.days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(hi.milestones,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(re.reports,0)>0 THEN 1 ELSE 0 END)::int diversity,
        (COALESCE(di.active_days,0)+COALESCE(re.reports,0)*2+COALESCE(hi.milestones,0)*3+LEAST(COALESCE(qr.responses,0),3)+CASE WHEN COALESCE(rh.days,0)>=3 THEN 2 WHEN COALESCE(rh.days,0)>=1 THEN 1 ELSE 0 END+CASE WHEN COALESCE(cp.days,0)>=2 THEN 2 WHEN COALESCE(cp.days,0)>=1 THEN 1 ELSE 0 END+LEAST(COALESCE(cp.helped,0),5))::int raw_growth
 FROM di,qr,rh,cp,hi,re
),
conf AS (
 SELECT COALESCE(points_per_cycle,60)::int ppc,COALESCE(stage_thresholds,'[3,10,18,28,39,50]'::jsonb) thresholds
 FROM garden_settings WHERE id=true
 UNION ALL SELECT 60,'[3,10,18,28,39,50]'::jsonb WHERE NOT EXISTS(SELECT 1 FROM garden_settings WHERE id=true)
),
ov AS (SELECT o.forced_total_growth,o.forced_garden_slug FROM garden_user_overrides o,me WHERE o.user_id=me.uid),
qualified AS (
 SELECT s.*,c.ppc,c.thresholds,COALESCE(ov.forced_garden_slug,NULL) forced_garden_slug,
        COALESCE(ov.forced_total_growth,CASE WHEN s.raw_growth<3 OR (s.active_days<2 AND s.diversity<2) THEN 0 ELSE s.raw_growth END)::int growth
 FROM signals s CROSS JOIN conf c LEFT JOIN ov ON true
),
cycle_raw AS (
 SELECT q.*,floor(q.growth/q.ppc::numeric)::int cycle_number,(q.growth%q.ppc)::int raw_cycle_progress FROM qualified q
),
cycle AS (
 SELECT c.*,LEAST(59,GREATEST(0,floor(c.raw_cycle_progress*60.0/c.ppc)::int)) garden_progress FROM cycle_raw c
),
staged AS (
 SELECT c.*,CASE
   WHEN c.garden_progress < COALESCE((c.thresholds->>0)::int,3) THEN 0
   WHEN c.garden_progress < COALESCE((c.thresholds->>1)::int,10) THEN 1
   WHEN c.garden_progress < COALESCE((c.thresholds->>2)::int,18) THEN 2
   WHEN c.garden_progress < COALESCE((c.thresholds->>3)::int,28) THEN 3
   WHEN c.garden_progress < COALESCE((c.thresholds->>4)::int,39) THEN 4
   WHEN c.garden_progress < COALESCE((c.thresholds->>5)::int,50) THEN 5 ELSE 6 END::int stage
 FROM cycle c
),
resolved AS (
 SELECT s.*,r.garden_slug,r.theme_index,
   GREATEST(1,(SELECT count(*)::int FROM garden_catalog g WHERE g.status<>'archived')) theme_count
 FROM staged s,me CROSS JOIN LATERAL resolve_user_garden_theme(me.uid,s.cycle_number,s.forced_garden_slug) r
)
SELECT jsonb_build_object(
 'stage',stage,'active_days',active_days,'diversity',diversity,
 'garden_index',(cycle_number*theme_count+theme_index)::int,
 'garden_cycle',cycle_number,'garden_slug',garden_slug,'garden_progress',garden_progress,
 'completed_gardens',cycle_number,'total_growth',growth,'points_per_cycle',ppc,'growth_model_version',5,
 'signals',jsonb_build_object('checkin_days',checkin_days,'diary_days',diary_days,'questionnaire_responses',questionnaire_responses,'questionnaire_days',questionnaire_days,'content_reads',content_reads,'content_days',content_days,'care_days',care_days,'helped',helped,'milestones',milestones,'reports',reports),
 'principle','O jardim cresce em um ritmo equilibrado; a fila administrativa define apenas novos ciclos e preserva jardins já iniciados.'
)
FROM resolved;
$$;

REVOKE ALL ON FUNCTION public.get_my_garden_state() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_state() TO authenticated;
