-- Go-live: a disponibilidade de relatórios e planos mensais é uma regra de
-- calendário, não a hora em que o job conseguiu gerar o artefato.
-- Semanal: fim sábado -> disponível domingo.
-- Mensal/Autocuidado: fim do mês -> disponível dia 1 seguinte.

CREATE OR REPLACE FUNCTION public.enforce_emotional_available_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path='public'
AS $$
BEGIN
  IF NEW.period_end IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.available_at := NEW.period_end + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_canonical_available_at ON public.reports;
CREATE TRIGGER reports_canonical_available_at
BEFORE INSERT OR UPDATE OF period_end, available_at ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.enforce_emotional_available_at();

DROP TRIGGER IF EXISTS care_plans_canonical_available_at ON public.monthly_care_plans;
CREATE TRIGGER care_plans_canonical_available_at
BEFORE INSERT OR UPDATE OF period_end, available_at ON public.monthly_care_plans
FOR EACH ROW
EXECUTE FUNCTION public.enforce_emotional_available_at();

-- Backfill somente a data de disponibilidade; não altera status/conteúdo e não
-- dispara o trigger de notificação de reports (ele reage apenas a status).
UPDATE public.reports
   SET available_at = period_end + 1
 WHERE available_at IS DISTINCT FROM period_end + 1;

UPDATE public.monthly_care_plans
   SET available_at = period_end + 1
 WHERE available_at IS DISTINCT FROM period_end + 1;

DO $$
DECLARE
  v_wrong_reports integer;
  v_wrong_plans integer;
  v_triggers integer;
BEGIN
  SELECT count(*) INTO v_wrong_reports
    FROM public.reports
   WHERE available_at IS DISTINCT FROM period_end + 1;
  IF v_wrong_reports <> 0 THEN
    RAISE EXCEPTION 'Go-live disponibilidade: ainda existem % relatórios fora da data canônica', v_wrong_reports;
  END IF;

  SELECT count(*) INTO v_wrong_plans
    FROM public.monthly_care_plans
   WHERE available_at IS DISTINCT FROM period_end + 1;
  IF v_wrong_plans <> 0 THEN
    RAISE EXCEPTION 'Go-live disponibilidade: ainda existem % planos fora da data canônica', v_wrong_plans;
  END IF;

  SELECT count(*) INTO v_triggers
    FROM pg_trigger t
   WHERE t.tgname IN ('reports_canonical_available_at','care_plans_canonical_available_at')
     AND NOT t.tgisinternal
     AND t.tgenabled <> 'D';
  IF v_triggers <> 2 THEN
    RAISE EXCEPTION 'Go-live disponibilidade: triggers canônicos incompletos';
  END IF;
END $$;
