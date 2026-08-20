-- Go-live: elimina filas paralelas dos artefatos oficiais e garante que
-- Comentário Profissional enviado seja refletido atomicamente no módulo oficial.

-- ---------------------------------------------------------------------------
-- 1) Tarefas legadas/duplicadas de personalização
-- ---------------------------------------------------------------------------
-- Estes quatro recursos já possuem fluxo canônico próprio:
--   self_care_plan          -> monthly_care_plans
--   advanced_monthly_report -> reports (monthly)
--   monthly_plan_review     -> não pertence à matriz final de 13 recursos
--   monthly_guidance        -> nasce somente de monthly_guidance_requests;
--                              a resposta é monthly_guidance_reply (on_guidance)
-- O Admin ainda mantém definições legadas no bundle atual. A defesa no banco
-- impede que abrir/atualizar a fila recrie pendências operacionais falsas.

CREATE OR REPLACE FUNCTION public.normalize_duplicate_personalization_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.task_key IN (
    'self_care_plan',
    'advanced_monthly_report',
    'monthly_plan_review',
    'monthly_guidance'
  ) THEN
    NEW.status := 'not_applicable';
    NEW.completed_at := COALESCE(NEW.completed_at, now());
    NEW.admin_notes := concat_ws(
      E'\n',
      NULLIF(trim(COALESCE(NEW.admin_notes, '')), ''),
      'Go-live: tarefa neutralizada porque o recurso possui fluxo oficial próprio.'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personalization_official_flow_guard ON public.user_personalization_tasks;
CREATE TRIGGER personalization_official_flow_guard
BEFORE INSERT ON public.user_personalization_tasks
FOR EACH ROW
EXECUTE FUNCTION public.normalize_duplicate_personalization_task();

UPDATE public.user_personalization_tasks
   SET status = 'not_applicable',
       completed_at = COALESCE(completed_at, now()),
       updated_at = now(),
       admin_notes = concat_ws(
         E'\n',
         NULLIF(trim(COALESCE(admin_notes, '')), ''),
         'Go-live: tarefa neutralizada porque o recurso possui fluxo oficial próprio.'
       )
 WHERE task_key IN (
    'self_care_plan',
    'advanced_monthly_report',
    'monthly_plan_review',
    'monthly_guidance'
 )
   AND status IN ('pending','overdue','draft','generated');

-- ---------------------------------------------------------------------------
-- 2) Comentário Profissional: delivery sent -> professional_comments
-- ---------------------------------------------------------------------------
-- source_delivery_id cria rastreabilidade/idempotência 1:1 sem alterar a tela.
ALTER TABLE public.professional_comments
  ADD COLUMN IF NOT EXISTS source_delivery_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.professional_comments'::regclass
       AND conname = 'professional_comments_source_delivery_id_fkey'
  ) THEN
    ALTER TABLE public.professional_comments
      ADD CONSTRAINT professional_comments_source_delivery_id_fkey
      FOREIGN KEY (source_delivery_id)
      REFERENCES public.personalized_content_deliveries(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS professional_comments_source_delivery_uidx
  ON public.professional_comments(source_delivery_id);

CREATE OR REPLACE FUNCTION public.reflect_sent_professional_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_sent_at timestamptz := COALESCE(NEW.sent_at, NEW.updated_at, NEW.created_at, now());
  v_report_month text := to_char(v_sent_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM');
BEGIN
  IF NEW.status <> 'sent'
     OR NEW.user_id IS NULL
     OR NULLIF(trim(COALESCE(NEW.body, '')), '') IS NULL
     OR NOT (
       NEW.target_area = 'professional_comments'
       OR NEW.content_type IN ('professional_comment','report_comment','monthly_report_comment')
     ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.professional_comments (
    user_id,
    professional_id,
    report_month,
    title,
    comment,
    visibility,
    is_read,
    created_at,
    comment_text,
    created_by,
    source_delivery_id
  ) VALUES (
    NEW.user_id,
    NEW.created_by,
    v_report_month,
    NEW.title,
    NEW.body,
    'user',
    false,
    v_sent_at,
    NEW.body,
    NEW.created_by,
    NEW.id
  )
  ON CONFLICT (source_delivery_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professional_comment_delivery_sent_insert ON public.personalized_content_deliveries;
CREATE TRIGGER professional_comment_delivery_sent_insert
AFTER INSERT ON public.personalized_content_deliveries
FOR EACH ROW
WHEN (
  NEW.status = 'sent'
  AND (
    NEW.target_area = 'professional_comments'
    OR NEW.content_type IN ('professional_comment','report_comment','monthly_report_comment')
  )
)
EXECUTE FUNCTION public.reflect_sent_professional_comment();

DROP TRIGGER IF EXISTS professional_comment_delivery_sent_update ON public.personalized_content_deliveries;
CREATE TRIGGER professional_comment_delivery_sent_update
AFTER UPDATE OF status ON public.personalized_content_deliveries
FOR EACH ROW
WHEN (
  NEW.status = 'sent'
  AND OLD.status IS DISTINCT FROM NEW.status
  AND (
    NEW.target_area = 'professional_comments'
    OR NEW.content_type IN ('professional_comment','report_comment','monthly_report_comment')
  )
)
EXECUTE FUNCTION public.reflect_sent_professional_comment();

-- Backfill defensivo: hoje não existem deliveries profissionais enviados, mas
-- garante consistência caso o estado mude entre auditoria e aplicação da migration.
INSERT INTO public.professional_comments (
  user_id,
  professional_id,
  report_month,
  title,
  comment,
  visibility,
  is_read,
  created_at,
  comment_text,
  created_by,
  source_delivery_id
)
SELECT
  d.user_id,
  d.created_by,
  to_char(COALESCE(d.sent_at, d.updated_at, d.created_at, now()) AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
  d.title,
  d.body,
  'user',
  false,
  COALESCE(d.sent_at, d.updated_at, d.created_at, now()),
  d.body,
  d.created_by,
  d.id
FROM public.personalized_content_deliveries d
WHERE d.status = 'sent'
  AND d.user_id IS NOT NULL
  AND NULLIF(trim(COALESCE(d.body, '')), '') IS NOT NULL
  AND (
    d.target_area = 'professional_comments'
    OR d.content_type IN ('professional_comment','report_comment','monthly_report_comment')
  )
ON CONFLICT (source_delivery_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Guardas de go-live
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_open_duplicates integer;
  v_triggers integer;
  v_missing_reflections integer;
BEGIN
  SELECT count(*) INTO v_open_duplicates
    FROM public.user_personalization_tasks
   WHERE task_key IN (
     'self_care_plan','advanced_monthly_report','monthly_plan_review','monthly_guidance'
   )
     AND status IN ('pending','overdue','draft','generated');
  IF v_open_duplicates <> 0 THEN
    RAISE EXCEPTION 'Go-live personalização: ainda existem % tarefas duplicadas abertas', v_open_duplicates;
  END IF;

  SELECT count(*) INTO v_triggers
    FROM pg_trigger t
   WHERE t.tgrelid = 'public.personalized_content_deliveries'::regclass
     AND t.tgname IN (
       'professional_comment_delivery_sent_insert',
       'professional_comment_delivery_sent_update'
     )
     AND NOT t.tgisinternal
     AND t.tgenabled <> 'D';
  IF v_triggers <> 2 THEN
    RAISE EXCEPTION 'Go-live personalização: triggers do comentário profissional incompletos';
  END IF;

  SELECT count(*) INTO v_missing_reflections
    FROM public.personalized_content_deliveries d
   WHERE d.status = 'sent'
     AND (
       d.target_area = 'professional_comments'
       OR d.content_type IN ('professional_comment','report_comment','monthly_report_comment')
     )
     AND NOT EXISTS (
       SELECT 1
         FROM public.professional_comments pc
        WHERE pc.source_delivery_id = d.id
     );
  IF v_missing_reflections <> 0 THEN
    RAISE EXCEPTION 'Go-live personalização: % deliveries profissionais sem reflexo oficial', v_missing_reflections;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
