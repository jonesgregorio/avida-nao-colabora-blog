-- Fecha a lacuna entre "Gestão de Jardins" (Admin) e "Meu Jardim" (blog):
--
-- 1) admin_garden_users() recalculava ciclo/progresso/estágio com 60 e os limiares
--    [3,10,18,28,39,50] FIXOS no código, ignorando garden_settings.points_per_cycle e
--    stage_thresholds — ou seja, a própria aba "Usuários" do admin ficava errada assim que
--    alguém mudava a aba "Regras". Passa a usar exatamente a mesma normalização (raw_cycle_progress
--    reescalado para 0..59) e os mesmos limiares dinâmicos que get_my_garden_state() já usa.
--
-- 2) get_my_garden_campaign(): a aba "Campanhas" cria/pausa campanhas em garden_campaigns, mas
--    nenhuma tela de usuário lia essa tabela (e a RLS da tabela só permite leitura por admin —
--    não daria nem pra ler direto do cliente). Esta função devolve, para o usuário autenticado
--    chamando, a campanha ativa (dentro da janela de datas) cujo público-alvo bate com o estado
--    real dele — reaproveita get_my_garden_state() em vez de duplicar a fórmula de crescimento
--    pela 3ª vez.

CREATE OR REPLACE FUNCTION public.admin_garden_users()
RETURNS TABLE(
 user_id uuid, full_name text, email text, total_growth integer, cycle_number integer,
 garden_progress integer, progress_pct integer, stage integer, garden_slug text,
 garden_label text, last_activity timestamptz, override_active boolean
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 RETURN QUERY
 WITH di AS (
   SELECT d.user_id,
     count(DISTINCT COALESCE(d.date,d.created_at::date))::int active_days,
     count(DISTINCT COALESCE(d.date,d.created_at::date)) FILTER(WHERE d.entry_type='checkin')::int checkin_days,
     count(DISTINCT COALESCE(d.date,d.created_at::date)) FILTER(WHERE d.entry_type='diary')::int diary_days,
     max(d.created_at) last_at
   FROM diary_entries d GROUP BY d.user_id
 ), qr AS (SELECT q.user_id,count(*)::int responses,count(DISTINCT q.created_at::date)::int days,max(q.created_at) last_at FROM questionnaire_responses q GROUP BY q.user_id),
 rh AS (SELECT r.user_id,count(*)::int reads,count(DISTINCT r.created_at::date)::int days,max(r.created_at) last_at FROM reading_history r GROUP BY r.user_id),
 cp AS (SELECT c.user_id,count(DISTINCT c.updated_at::date)::int days,count(*) FILTER(WHERE c.outcome='helped')::int helped,max(c.updated_at) last_at FROM care_plan_action_state c WHERE c.outcome IS NOT NULL GROUP BY c.user_id),
 hi AS (SELECT h.user_id,count(*) FILTER(WHERE h.item_type='milestone')::int milestones,max(h.created_at) last_at FROM user_history_items h GROUP BY h.user_id),
 re AS (SELECT r.user_id,count(*)::int reports,max(r.created_at) last_at FROM reports r GROUP BY r.user_id),
 conf AS (
   SELECT COALESCE(points_per_cycle,60)::int ppc,COALESCE(stage_thresholds,'[3,10,18,28,39,50]'::jsonb) thresholds
   FROM garden_settings WHERE id=true
   UNION ALL SELECT 60,'[3,10,18,28,39,50]'::jsonb WHERE NOT EXISTS(SELECT 1 FROM garden_settings WHERE id=true)
 ),
 calc AS (
   SELECT p.user_id,p.full_name,p.email,
     COALESCE(di.active_days,0) active_days,
     (CASE WHEN COALESCE(di.checkin_days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(di.diary_days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(qr.responses,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(rh.reads,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(cp.days,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(hi.milestones,0)>0 THEN 1 ELSE 0 END + CASE WHEN COALESCE(re.reports,0)>0 THEN 1 ELSE 0 END)::int diversity,
     (COALESCE(di.active_days,0)+COALESCE(re.reports,0)*2+COALESCE(hi.milestones,0)*3+LEAST(COALESCE(qr.responses,0),3)+CASE WHEN COALESCE(rh.days,0)>=3 THEN 2 WHEN COALESCE(rh.days,0)>=1 THEN 1 ELSE 0 END+CASE WHEN COALESCE(cp.days,0)>=2 THEN 2 WHEN COALESCE(cp.days,0)>=1 THEN 1 ELSE 0 END+LEAST(COALESCE(cp.helped,0),5))::int raw_growth,
     GREATEST(di.last_at,qr.last_at,rh.last_at,cp.last_at,hi.last_at,re.last_at) last_activity,
     o.forced_total_growth,o.forced_garden_slug,(o.user_id IS NOT NULL) override_active
   FROM profiles p LEFT JOIN di ON di.user_id=p.user_id LEFT JOIN qr ON qr.user_id=p.user_id LEFT JOIN rh ON rh.user_id=p.user_id LEFT JOIN cp ON cp.user_id=p.user_id LEFT JOIN hi ON hi.user_id=p.user_id LEFT JOIN re ON re.user_id=p.user_id LEFT JOIN garden_user_overrides o ON o.user_id=p.user_id
 ), qualified AS (
   SELECT *, COALESCE(forced_total_growth,CASE WHEN raw_growth<3 OR (active_days<2 AND diversity<2) THEN 0 ELSE raw_growth END)::int growth FROM calc
 ), cy AS (
   -- mesma normalização de get_my_garden_state(): o ciclo pode ter um tamanho (ppc) diferente
   -- de 60, mas garden_progress sempre é reescalado pra 0..59 antes de virar estágio/exibição.
   SELECT q.*, c.ppc, c.thresholds,
     floor(q.growth/c.ppc::numeric)::int cyc,
     LEAST(59,GREATEST(0,floor((q.growth%c.ppc)*60.0/c.ppc)::int)) gp
   FROM qualified q CROSS JOIN conf c
 ), chosen AS (
   SELECT cy.*,COALESCE(c_forced.slug,c_assigned.slug,c_queue.slug) chosen_slug
   FROM cy
   LEFT JOIN garden_catalog c_forced ON c_forced.slug=cy.forced_garden_slug
   LEFT JOIN garden_user_cycles uc ON uc.user_id=cy.user_id AND uc.cycle_number=cy.cyc
   LEFT JOIN garden_catalog c_assigned ON c_assigned.slug=uc.garden_slug
   LEFT JOIN LATERAL (SELECT g.slug FROM garden_catalog g WHERE g.status IN('active','queued') AND (g.release_at IS NULL OR g.release_at<=now()) ORDER BY g.queue_position NULLS LAST,g.theme_index OFFSET (cy.cyc % GREATEST(1,(SELECT count(*) FROM garden_catalog x WHERE x.status IN('active','queued')))) LIMIT 1) c_queue ON true
 )
 SELECT c.user_id,c.full_name,c.email,c.growth,c.cyc,c.gp,round(c.gp/60.0*100)::int,
   CASE
     WHEN c.gp < COALESCE((c.thresholds->>0)::int,3) THEN 0
     WHEN c.gp < COALESCE((c.thresholds->>1)::int,10) THEN 1
     WHEN c.gp < COALESCE((c.thresholds->>2)::int,18) THEN 2
     WHEN c.gp < COALESCE((c.thresholds->>3)::int,28) THEN 3
     WHEN c.gp < COALESCE((c.thresholds->>4)::int,39) THEN 4
     WHEN c.gp < COALESCE((c.thresholds->>5)::int,50) THEN 5 ELSE 6 END,
   c.chosen_slug,g.label,c.last_activity,c.override_active
 FROM chosen c LEFT JOIN garden_catalog g ON g.slug=c.chosen_slug
 ORDER BY c.last_activity DESC NULLS LAST,c.full_name NULLS LAST;
END; $$;
REVOKE ALL ON FUNCTION public.admin_garden_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_garden_users() TO authenticated;

-- Campanha ativa e elegível para o usuário autenticado chamando (ou NULL se nenhuma bater).
-- audience: 'all' sempre bate; os demais comparam contra o estado real do próprio usuário.
CREATE OR REPLACE FUNCTION public.get_my_garden_campaign()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_last_activity timestamptz;
  v_campaign jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  v_state := public.get_my_garden_state();
  IF v_state IS NULL THEN RETURN NULL; END IF;

  SELECT GREATEST(
    (SELECT max(created_at) FROM diary_entries WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM questionnaire_responses WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM reading_history WHERE user_id = auth.uid()),
    (SELECT max(updated_at) FROM care_plan_action_state WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM user_history_items WHERE user_id = auth.uid()),
    (SELECT max(created_at) FROM reports WHERE user_id = auth.uid())
  ) INTO v_last_activity;

  SELECT jsonb_build_object(
    'id', c.id, 'name', c.name, 'headline', c.headline, 'body', c.body, 'cta_label', c.cta_label,
    'garden_slug', c.garden_slug, 'campaign_type', c.campaign_type,
    'temporary_unlock', c.temporary_unlock
  ) INTO v_campaign
  FROM garden_campaigns c
  WHERE c.status = 'active'
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.ends_at IS NULL OR c.ends_at >= now())
    AND (
      c.audience = 'all'
      OR (c.audience = 'completed_one' AND (v_state->>'completed_gardens')::int >= 1)
      OR (c.audience = 'at_100' AND (v_state->>'garden_progress')::int >= 59)
      OR (c.audience = 'inactive' AND (v_last_activity IS NULL OR v_last_activity < now() - interval '7 days'))
      OR (c.audience = 'new_users' AND (v_state->>'completed_gardens')::int = 0 AND (v_state->>'total_growth')::int < 10)
      OR (c.audience = 'garden_users' AND c.garden_slug IS NOT NULL AND c.garden_slug = (v_state->>'garden_slug'))
    )
  ORDER BY c.starts_at DESC NULLS LAST, c.created_at DESC
  LIMIT 1;

  RETURN v_campaign;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_garden_campaign() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_garden_campaign() TO authenticated;
