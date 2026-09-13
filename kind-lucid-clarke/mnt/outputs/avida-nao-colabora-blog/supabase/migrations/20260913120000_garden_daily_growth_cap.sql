-- Aplica de verdade o "Limite diário" já existente em garden_settings.daily_growth_cap.
-- Até aqui o valor só era salvo (ver caption removida em AdminGardenManagement.tsx). Agora
-- get_my_garden_state() usa um ledger por usuário para limitar quanto o total_growth pode
-- subir NO MESMO DIA, sem nunca diminuir o que a pessoa já alcançou e sem descartar o excesso
-- (ele fica disponível para o dia seguinte, já que o ledger sempre compara contra o growth-alvo
-- real recalculado a cada chamada). Ajustes manuais do admin (garden_user_overrides) continuam
-- ignorando o limite diário, como já ignoravam o cálculo padrão.

CREATE TABLE IF NOT EXISTS public.garden_growth_ledger (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ledger_date date NOT NULL DEFAULT current_date,
  day_start_growth integer NOT NULL DEFAULT 0,
  applied_growth integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.garden_growth_ledger ENABLE ROW LEVEL SECURITY;
-- Sem policies: só é lido/escrito pelas funções SECURITY DEFINER abaixo.

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
 SELECT COALESCE(points_per_cycle,60)::int ppc,COALESCE(stage_thresholds,'[3,10,18,28,39,50]'::jsonb) thresholds,daily_growth_cap
 FROM garden_settings WHERE id=true
 UNION ALL SELECT 60,'[3,10,18,28,39,50]'::jsonb,NULL WHERE NOT EXISTS(SELECT 1 FROM garden_settings WHERE id=true)
),
ov AS (SELECT o.forced_total_growth,o.forced_garden_slug FROM garden_user_overrides o,me WHERE o.user_id=me.uid),
qualified AS (
 SELECT s.*,c.ppc,c.thresholds,c.daily_growth_cap,COALESCE(ov.forced_garden_slug,NULL) forced_garden_slug,ov.forced_total_growth,
        COALESCE(ov.forced_total_growth,CASE WHEN s.raw_growth<3 OR (s.active_days<2 AND s.diversity<2) THEN 0 ELSE s.raw_growth END)::int target_growth
 FROM signals s CROSS JOIN conf c LEFT JOIN ov ON true
),
ledger_current AS (SELECT l.* FROM garden_growth_ledger l,me WHERE l.user_id=me.uid),
-- Sem override e com limite configurado: o crescimento exibido hoje não pode passar do que já
-- estava aplicado ontem (day_start) somado ao limite diário — mas nunca regride, e nunca passa
-- do próprio target_growth recalculado (não inventa crescimento que as atividades não sustentam).
ledger_upsert AS (
 INSERT INTO garden_growth_ledger AS gl (user_id,ledger_date,day_start_growth,applied_growth,updated_at)
 SELECT
   me.uid,
   current_date,
   CASE WHEN lc.ledger_date IS NULL OR lc.ledger_date < current_date THEN COALESCE(lc.applied_growth,0) ELSE COALESCE(lc.day_start_growth,0) END,
   CASE
     WHEN q.forced_total_growth IS NOT NULL THEN q.target_growth
     WHEN q.daily_growth_cap IS NULL OR q.daily_growth_cap<=0 THEN q.target_growth
     ELSE GREATEST(
       COALESCE(lc.applied_growth,0),
       LEAST(
         q.target_growth,
         (CASE WHEN lc.ledger_date IS NULL OR lc.ledger_date < current_date THEN COALESCE(lc.applied_growth,0) ELSE COALESCE(lc.day_start_growth,0) END) + q.daily_growth_cap
       )
     )
   END,
   now()
 FROM me CROSS JOIN qualified q LEFT JOIN ledger_current lc ON true
 ON CONFLICT (user_id) DO UPDATE SET
   ledger_date=EXCLUDED.ledger_date,day_start_growth=EXCLUDED.day_start_growth,applied_growth=EXCLUDED.applied_growth,updated_at=now()
 RETURNING applied_growth
),
cycle_raw AS (
 SELECT q.*,lu.applied_growth AS growth,floor(lu.applied_growth/q.ppc::numeric)::int cycle_number,(lu.applied_growth%q.ppc)::int raw_cycle_progress
 FROM qualified q,ledger_upsert lu
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

-- admin_garden_users(): mesma leitura, mas SEM escrever no ledger (é uma tela de listagem em
-- massa, não a experiência do usuário). Usa o ledger já existente como referência do que a
-- pessoa está vendo hoje; se ela ainda não abriu o Jardim hoje, projeta o mesmo teto que
-- get_my_garden_state() aplicaria na próxima visita, sem nunca mostrar menos do que o ledger
-- já registrou como aplicado.
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
   SELECT COALESCE(points_per_cycle,60)::int ppc,COALESCE(stage_thresholds,'[3,10,18,28,39,50]'::jsonb) thresholds,daily_growth_cap
   FROM garden_settings WHERE id=true
   UNION ALL SELECT 60,'[3,10,18,28,39,50]'::jsonb,NULL WHERE NOT EXISTS(SELECT 1 FROM garden_settings WHERE id=true)
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
   SELECT calc.*,conf.ppc,conf.thresholds,conf.daily_growth_cap,
     COALESCE(forced_total_growth,CASE WHEN raw_growth<3 OR (active_days<2 AND diversity<2) THEN 0 ELSE raw_growth END)::int target_growth
   FROM calc CROSS JOIN conf
 ), capped AS (
   SELECT q.*,gl.ledger_date,gl.day_start_growth,gl.applied_growth AS ledger_applied,
     CASE
       WHEN q.forced_total_growth IS NOT NULL THEN q.target_growth
       WHEN q.daily_growth_cap IS NULL OR q.daily_growth_cap<=0 THEN q.target_growth
       WHEN gl.user_id IS NULL THEN q.target_growth
       ELSE GREATEST(
         gl.applied_growth,
         LEAST(
           q.target_growth,
           (CASE WHEN gl.ledger_date < current_date THEN gl.applied_growth ELSE gl.day_start_growth END) + q.daily_growth_cap
         )
       )
     END::int growth
   FROM qualified q LEFT JOIN garden_growth_ledger gl ON gl.user_id=q.user_id
 ), cy AS (
   -- mesma normalização de get_my_garden_state(): o ciclo pode ter um tamanho (ppc) diferente
   -- de 60, mas garden_progress sempre é reescalado pra 0..59 antes de virar estágio/exibição.
   SELECT c.*,
     floor(c.growth/c.ppc::numeric)::int cyc,
     LEAST(59,GREATEST(0,floor((c.growth%c.ppc)*60.0/c.ppc)::int)) gp
   FROM capped c
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
