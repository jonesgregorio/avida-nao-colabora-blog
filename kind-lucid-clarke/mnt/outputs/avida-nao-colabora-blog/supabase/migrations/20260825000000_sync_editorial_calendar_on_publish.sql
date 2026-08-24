-- Auditoria de go-live (aprofundamento pós Parte 11): editorial_calendar tem
-- seu próprio status, sem nada sincronizando com articles.status. Um admin
-- podia arrastar o card do Kanban para "Publicado" com o artigo ainda em
-- rascunho, ou publicar manualmente um artigo pelo editor enquanto o card
-- ficava parado em "Em revisão" -- as duas telas divergiam silenciosamente.
--
-- Corrige só a direção inequívoca e de maior risco: quando o ARTIGO muda para
-- published/archived, reflete no card vinculado. Não sincroniza os estados
-- intermediários (ideia/gerado_ia/em_revisao/aprovado/agendado) na direção
-- calendário -> artigo, pois essa etapa de planejamento é responsabilidade do
-- admin no Kanban e não deve ser sobrescrita automaticamente.

CREATE OR REPLACE FUNCTION public.sync_editorial_calendar_from_article()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'published' THEN
      UPDATE public.editorial_calendar
      SET status = 'publicado', updated_at = now()
      WHERE article_id = NEW.id AND status IS DISTINCT FROM 'publicado';
    ELSIF NEW.status = 'archived' THEN
      UPDATE public.editorial_calendar
      SET status = 'arquivado', updated_at = now()
      WHERE article_id = NEW.id AND status IS DISTINCT FROM 'arquivado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_editorial_calendar_from_article ON public.articles;
CREATE TRIGGER trg_sync_editorial_calendar_from_article
AFTER UPDATE OF status ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.sync_editorial_calendar_from_article();

REVOKE ALL ON FUNCTION public.sync_editorial_calendar_from_article() FROM public, anon, authenticated;

-- Backfill defensivo: cards já vinculados a artigos publicados/arquivados que
-- ainda não refletiam isso.
UPDATE public.editorial_calendar ec
SET status = 'publicado', updated_at = now()
FROM public.articles a
WHERE ec.article_id = a.id AND a.status = 'published' AND ec.status IS DISTINCT FROM 'publicado';

UPDATE public.editorial_calendar ec
SET status = 'arquivado', updated_at = now()
FROM public.articles a
WHERE ec.article_id = a.id AND a.status = 'archived' AND ec.status IS DISTINCT FROM 'arquivado';
