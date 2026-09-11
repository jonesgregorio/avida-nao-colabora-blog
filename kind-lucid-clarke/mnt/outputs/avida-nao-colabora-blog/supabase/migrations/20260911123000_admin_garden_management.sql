-- Gestão de Jardins — catálogo, fila, campanhas, regras, usuários e auditoria.
-- Todas as mutações são restritas a administradores com MFA via is_admin().

CREATE TABLE IF NOT EXISTS public.garden_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  theme_index smallint NOT NULL UNIQUE CHECK (theme_index >= 0),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('draft','ready','queued','active','paused','archived')),
  queue_position integer,
  release_at timestamptz,
  cover_image text,
  stage_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_title text NOT NULL DEFAULT 'Seu jardim floresceu por completo.',
  completion_message text NOT NULL DEFAULT 'O que começou com pequenos cuidados agora ocupa todo esse espaço. Parabéns por cultivar até aqui. 🌿',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS garden_catalog_queue_idx ON public.garden_catalog(queue_position) WHERE status IN ('queued','active');

CREATE TABLE IF NOT EXISTS public.garden_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  release_mode text NOT NULL DEFAULT 'global' CHECK (release_mode IN ('global','free','hybrid')),
  points_per_cycle integer NOT NULL DEFAULT 60 CHECK (points_per_cycle BETWEEN 10 AND 500),
  daily_growth_cap integer CHECK (daily_growth_cap IS NULL OR daily_growth_cap > 0),
  stage_thresholds jsonb NOT NULL DEFAULT '[3,10,18,28,39,50]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.garden_settings(id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.garden_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  garden_slug text REFERENCES public.garden_catalog(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  campaign_type text NOT NULL DEFAULT 'launch' CHECK (campaign_type IN ('launch','featured','seasonal','reactivation','achievement','prelaunch')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','active','paused','finished')),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all','completed_one','at_100','inactive','new_users','garden_users')),
  headline text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  cta_label text NOT NULL DEFAULT 'Conhecer o jardim',
  starts_at timestamptz,
  ends_at timestamptz,
  temporary_unlock boolean NOT NULL DEFAULT false,
  keep_after_start boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.garden_user_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  forced_total_growth integer CHECK (forced_total_growth IS NULL OR forced_total_growth >= 0),
  forced_garden_slug text REFERENCES public.garden_catalog(slug) ON UPDATE CASCADE ON DELETE SET NULL,
  note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Congela o tema atribuído a cada ciclo do usuário. Reordenar a fila afeta somente
-- ciclos ainda não iniciados, preservando jardins em andamento e o histórico.
CREATE TABLE IF NOT EXISTS public.garden_user_cycles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_number integer NOT NULL CHECK (cycle_number >= 0),
  garden_slug text NOT NULL REFERENCES public.garden_catalog(slug) ON UPDATE CASCADE,
  theme_index smallint NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cycle_number)
);

CREATE TABLE IF NOT EXISTS public.garden_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS garden_admin_audit_created_idx ON public.garden_admin_audit(created_at DESC);

ALTER TABLE public.garden_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_user_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_user_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_admin_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS garden_catalog_read ON public.garden_catalog;
CREATE POLICY garden_catalog_read ON public.garden_catalog FOR SELECT TO authenticated USING (status <> 'archived' OR is_admin());
DROP POLICY IF EXISTS garden_catalog_admin ON public.garden_catalog;
CREATE POLICY garden_catalog_admin ON public.garden_catalog FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS garden_settings_read ON public.garden_settings;
CREATE POLICY garden_settings_read ON public.garden_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS garden_settings_admin ON public.garden_settings;
CREATE POLICY garden_settings_admin ON public.garden_settings FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS garden_campaigns_admin ON public.garden_campaigns;
CREATE POLICY garden_campaigns_admin ON public.garden_campaigns FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS garden_overrides_admin ON public.garden_user_overrides;
CREATE POLICY garden_overrides_admin ON public.garden_user_overrides FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS garden_cycles_owner ON public.garden_user_cycles;
CREATE POLICY garden_cycles_owner ON public.garden_user_cycles FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS garden_cycles_admin ON public.garden_user_cycles;
CREATE POLICY garden_cycles_admin ON public.garden_user_cycles FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS garden_audit_admin ON public.garden_admin_audit;
CREATE POLICY garden_audit_admin ON public.garden_admin_audit FOR SELECT USING (is_admin());
CREATE POLICY garden_audit_insert_admin ON public.garden_admin_audit FOR INSERT WITH CHECK (is_admin());

-- Catálogo inicial espelha a ordem visual existente em src/lib/gardenThemes.ts.
INSERT INTO public.garden_catalog(slug,label,theme_index,status,queue_position,cover_image,stage_images) VALUES
 ('japones','Jardim japonês · outono',0,'active',1,'/gardens/japones/6.webp','["/gardens/japones/01.webp","/gardens/japones/23.webp","/gardens/japones/45.webp","/gardens/japones/6.webp"]'),
 ('cottage','Cottage inglês · verão',1,'queued',2,'/gardens/cottage/6.webp','["/gardens/cottage/01.webp","/gardens/cottage/23.webp","/gardens/cottage/45.webp","/gardens/cottage/6.webp"]'),
 ('mediterraneo','Mediterrâneo · fim de tarde',2,'queued',3,'/gardens/mediterraneo/6.webp','["/gardens/mediterraneo/01.webp","/gardens/mediterraneo/23.webp","/gardens/mediterraneo/45.webp","/gardens/mediterraneo/6.webp"]'),
 ('mata-atlantica','Mata Atlântica · amanhecer',3,'queued',4,'/gardens/mata-atlantica/6.webp','["/gardens/mata-atlantica/01.webp","/gardens/mata-atlantica/23.webp","/gardens/mata-atlantica/45.webp","/gardens/mata-atlantica/6.webp"]'),
 ('giverny','Giverny · fim de primavera',4,'queued',5,'/gardens/giverny/6.webp','["/gardens/giverny/01.webp","/gardens/giverny/23.webp","/gardens/giverny/45.webp","/gardens/giverny/6.webp"]'),
 ('deserto','Deserto · amanhecer',5,'queued',6,'/gardens/deserto/6.webp','["/gardens/deserto/01.webp","/gardens/deserto/23.webp","/gardens/deserto/45.webp","/gardens/deserto/6.webp"]'),
 ('noturno','Jardim noturno · lua cheia',6,'queued',7,'/gardens/noturno/6.webp','["/gardens/noturno/01.webp","/gardens/noturno/23.webp","/gardens/noturno/45.webp","/gardens/noturno/6.webp"]'),
 ('nordico','Jardim nórdico · inverno',7,'queued',8,'/gardens/nordico/6.webp','["/gardens/nordico/01.webp","/gardens/nordico/23.webp","/gardens/nordico/45.webp","/gardens/nordico/6.webp"]')
ON CONFLICT (slug) DO UPDATE SET label=EXCLUDED.label, theme_index=EXCLUDED.theme_index, cover_image=EXCLUDED.cover_image, stage_images=EXCLUDED.stage_images;

CREATE OR REPLACE FUNCTION public.admin_garden_audit(p_action text,p_entity_type text,p_entity_id text DEFAULT NULL,p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 INSERT INTO garden_admin_audit(actor_id,action,entity_type,entity_id,metadata) VALUES(auth.uid(),p_action,p_entity_type,p_entity_id,COALESCE(p_metadata,'{}'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.admin_garden_audit(text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_garden_audit(text,text,text,jsonb) TO authenticated;

-- Snapshot administrativo. Replica a fórmula v4 para todos os usuários sem expor
-- as tabelas privadas ao cliente; SECURITY DEFINER + is_admin() protege os dados.
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
   SELECT *,floor(growth/60.0)::int cyc,(growth%60)::int gp FROM qualified
 ), chosen AS (
   SELECT cy.*,COALESCE(c_forced.slug,c_assigned.slug,c_queue.slug) chosen_slug
   FROM cy
   LEFT JOIN garden_catalog c_forced ON c_forced.slug=cy.forced_garden_slug
   LEFT JOIN garden_user_cycles uc ON uc.user_id=cy.user_id AND uc.cycle_number=cy.cyc
   LEFT JOIN garden_catalog c_assigned ON c_assigned.slug=uc.garden_slug
   LEFT JOIN LATERAL (SELECT g.slug FROM garden_catalog g WHERE g.status IN('active','queued') AND (g.release_at IS NULL OR g.release_at<=now()) ORDER BY g.queue_position NULLS LAST,g.theme_index OFFSET (cy.cyc % GREATEST(1,(SELECT count(*) FROM garden_catalog x WHERE x.status IN('active','queued')))) LIMIT 1) c_queue ON true
 )
 SELECT c.user_id,c.full_name,c.email,c.growth,c.cyc,c.gp,round(c.gp/60.0*100)::int,
   CASE WHEN c.gp<3 THEN 0 WHEN c.gp<10 THEN 1 WHEN c.gp<18 THEN 2 WHEN c.gp<28 THEN 3 WHEN c.gp<39 THEN 4 WHEN c.gp<50 THEN 5 ELSE 6 END,
   c.chosen_slug,g.label,c.last_activity,c.override_active
 FROM chosen c LEFT JOIN garden_catalog g ON g.slug=c.chosen_slug
 ORDER BY c.last_activity DESC NULLS LAST,c.full_name NULLS LAST;
END; $$;
REVOKE ALL ON FUNCTION public.admin_garden_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_garden_users() TO authenticated;
