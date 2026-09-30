-- ============================================================================
-- Onboarding comportamental + onboarding por plano
-- ============================================================================
-- Objetivos:
--   * uma única jornada de onboarding, sem sequências paralelas;
--   * boas-vindas humanas e objetivas;
--   * lembretes somente quando a ação ainda não aconteceu;
--   * máximo de 1 e-mail de nutrição/onboarding a cada 3 dias;
--   * onboarding do plano reaproveita plan_activated/plan_upgraded;
--   * visão administrativa paginada e filtrável;
--   * nenhum conteúdo emocional/texto de Diário é exposto nesta camada.
-- ============================================================================

-- 1) Revisão dos e-mails transacionais já existentes -------------------------
UPDATE public.email_templates SET
  subject = 'Que bom ter você por aqui 🌿',
  preheader = 'Seu espaço está pronto. Comece do seu jeito.',
  body_text = $b$Olá, {{nome}}.

Sua conta no A Vida Não Colabora está pronta.

Por aqui, você não precisa ter tudo organizado, saber exatamente o que está sentindo ou aparecer todos os dias. A ideia é ter um espaço para registrar o que está acontecendo e, com o tempo, enxergar sua própria trajetória com mais clareza.

Você pode começar com algo bem pequeno: registrar como está o seu dia.

Fazer meu primeiro check-in:
{{link_login}}

Depois, quando fizer sentido, você pode conhecer o Diário, os questionários, os conteúdos e os outros recursos disponíveis no seu plano.

Sem sequência obrigatória. Sem cobrança para manter um ritmo. Você volta quando quiser.

A vida nem sempre colabora. Seu espaço continua aqui.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'welcome';

UPDATE public.email_templates SET
  subject = 'Seu {{plano}} está pronto para você',
  preheader = 'Os novos recursos já estão disponíveis — sem precisar explorar tudo de uma vez.',
  body_text = $b$Olá, {{nome}}.

Seu plano {{plano}} já está ativo.

Isso não significa que você precise abrir tudo hoje. Pense nesses recursos como novos caminhos que ficam disponíveis para quando fizerem sentido no seu momento.

O que o seu plano inclui:
{{beneficios_do_plano}}

Comece pelo que parecer mais útil agora. Conforme você registra seus dias, algumas áreas também passam a ganhar mais contexto e valor com o tempo.

Conhecer meu plano:
{{link_meu_plano}}

Seu espaço continua sendo seu: sem pressão, sem sequência obrigatória e no seu ritmo.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'plan_activated';

UPDATE public.email_templates SET
  subject = 'Seu espaço ganhou novos caminhos',
  preheader = 'Seu plano mudou e os novos recursos já estão disponíveis.',
  body_text = $b$Olá, {{nome}}.

Seu plano mudou de {{plano_antigo}} para {{plano_novo}}.

A partir de agora, novos recursos passam a fazer parte do seu espaço. Você não precisa conhecer tudo de uma vez: explore aos poucos e use apenas o que fizer sentido para você.

Ver o que está disponível no meu plano:
{{link_meu_plano}}

Se alguns recursos dependerem de histórico ou de registros suficientes, eles vão se formando com o uso — sem necessidade de preencher tudo de uma vez.

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'plan_upgraded';

-- 2) Lembretes de onboarding comportamental ----------------------------------
-- Prefixo value_ reaproveita List-Unsubscribe e preferências já existentes.
INSERT INTO public.email_templates
  (template_key, subject, preheader, body_text, body_html, category, is_active)
VALUES
(
  'value_onboarding_first_checkin',
  'Seu espaço continua aqui',
  'Um primeiro registro pode levar menos de um minuto.',
  $b$Olá, {{nome}}.

Se você ainda não soube por onde começar, tudo bem.

Um Check-in é só um registro rápido de como o dia está sendo. Não precisa explicar tudo, encontrar a palavra perfeita ou escrever um texto grande.

É apenas um ponto de partida — e leva menos de um minuto.

Fazer meu primeiro Check-in:
{{cta_link}}

Sem cobrança para voltar todos os dias. Use o espaço quando ele fizer sentido para você.

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Com cuidado,
Equipe A Vida Não Colabora$b$,
  '', 'selfcare_reminder', true
),
(
  'value_onboarding_diary',
  'Quando quiser colocar um pouco mais em palavras',
  'O Diário está disponível para os dias em que um registro rápido não basta.',
  $b$Olá, {{nome}}.

Você já deu um primeiro passo por aqui.

Em alguns dias, um Check-in rápido é suficiente. Em outros, pode dar vontade de colocar um pouco mais em palavras — o que aconteceu, o que ficou na cabeça ou simplesmente como foi o dia.

O Diário existe para isso. Não precisa escrever bonito, muito, nem chegar a uma conclusão.

Conhecer meu Diário:
{{cta_link}}

Se hoje não for um dia de escrever, tudo bem também.

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Com cuidado,
Equipe A Vida Não Colabora$b$,
  '', 'selfcare_reminder', true
),
(
  'value_onboarding_plan_return',
  'Se quiser, seu {{plano}} já tem novos caminhos para explorar',
  'Os recursos do seu plano ficam disponíveis no seu ritmo.',
  $b$Olá, {{nome}}.

Seu {{plano}} já está ativo e os novos recursos continuam disponíveis por aqui.

Você não precisa conhecer tudo de uma vez. Quando voltar, pode começar pelo que fizer mais sentido:

{{recursos_do_plano}}

Algumas áreas ficam mais úteis conforme seus registros vão criando histórico. Isso acontece aos poucos — não existe nada para “colocar em dia”.

Explorar meu plano:
{{cta_link}}

Você pode ajustar suas preferências de e-mail quando quiser:
{{link_preferencias}}

Com cuidado,
Equipe A Vida Não Colabora$b$,
  '', 'selfcare_reminder', true
)
ON CONFLICT (template_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  preheader = EXCLUDED.preheader,
  body_text = EXCLUDED.body_text,
  body_html = EXCLUDED.body_html,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = now();

-- 3) Base administrativa de onboarding --------------------------------------
CREATE OR REPLACE FUNCTION public.admin_onboarding_base()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  plan text,
  created_at timestamptz,
  plan_activated_at timestamptz,
  last_seen_at timestamptz,
  checkins_total int,
  diaries_total int,
  last_onboarding_email timestamptz,
  last_onboarding_template text,
  onboarding_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH diary AS (
    SELECT d.user_id,
      count(*) FILTER (WHERE d.entry_type = 'checkin')::int AS checkins_total,
      count(*) FILTER (WHERE d.entry_type = 'diary')::int AS diaries_total
    FROM public.diary_entries d
    GROUP BY d.user_id
  ), mail AS (
    SELECT DISTINCT ON (l.user_id)
      l.user_id, l.created_at AS last_onboarding_email, l.template_key AS last_onboarding_template
    FROM public.email_logs l
    WHERE l.user_id IS NOT NULL
      AND l.template_key LIKE 'value_onboarding_%'
      AND l.status IN ('pending','sent','delivered')
    ORDER BY l.user_id, l.created_at DESC
  )
  SELECT
    p.user_id, p.full_name, p.email, p.plan, p.created_at, p.plan_activated_at,
    p.last_seen_at,
    coalesce(d.checkins_total, 0)::int,
    coalesce(d.diaries_total, 0)::int,
    m.last_onboarding_email,
    m.last_onboarding_template,
    CASE
      WHEN coalesce(p.role, 'user') = 'admin' THEN 'fora_da_jornada'
      WHEN p.created_at >= now() - interval '30 days' AND coalesce(d.checkins_total,0) = 0 THEN 'aguardando_checkin'
      WHEN p.created_at >= now() - interval '30 days' AND coalesce(d.checkins_total,0) > 0 AND coalesce(d.diaries_total,0) = 0 THEN 'aguardando_diario'
      WHEN p.plan IN ('essential','plus','therapeutic','therapeutic-plus')
        AND p.plan_activated_at >= now() - interval '21 days' THEN 'conhecendo_plano'
      WHEN coalesce(d.checkins_total,0) > 0 AND coalesce(d.diaries_total,0) > 0 THEN 'concluido'
      ELSE 'fora_da_jornada'
    END AS onboarding_status
  FROM public.profiles p
  LEFT JOIN diary d ON d.user_id = p.user_id
  LEFT JOIN mail m ON m.user_id = p.user_id;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_base() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_onboarding_summary(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := nullif(btrim(coalesce(p_search,'')), '');
  v jsonb;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  SELECT jsonb_build_object(
    'total', count(*) FILTER (WHERE onboarding_status <> 'fora_da_jornada'),
    'aguardando_checkin', count(*) FILTER (WHERE onboarding_status = 'aguardando_checkin'),
    'aguardando_diario', count(*) FILTER (WHERE onboarding_status = 'aguardando_diario'),
    'conhecendo_plano', count(*) FILTER (WHERE onboarding_status = 'conhecendo_plano'),
    'concluido', count(*) FILTER (WHERE onboarding_status = 'concluido')
  ) INTO v
  FROM public.admin_onboarding_base() b
  WHERE (nullif(coalesce(p_plan,''),'') IS NULL OR p_plan = 'todos' OR b.plan = p_plan)
    AND (nullif(coalesce(p_status,''),'') IS NULL OR p_status = 'todos' OR b.onboarding_status = p_status)
    AND (v_q IS NULL OR b.full_name ILIKE '%' || v_q || '%' OR b.email ILIKE '%' || v_q || '%');
  RETURN coalesce(v, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_summary(text,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_summary(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_onboarding_page(
  p_search text DEFAULT NULL,
  p_plan text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 10,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  plan text,
  created_at timestamptz,
  plan_activated_at timestamptz,
  last_seen_at timestamptz,
  checkins_total int,
  diaries_total int,
  last_onboarding_email timestamptz,
  last_onboarding_template text,
  onboarding_status text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := nullif(btrim(coalesce(p_search,'')), '');
  v_limit int := least(greatest(coalesce(p_limit,10),1),5000);
  v_offset int := greatest(coalesce(p_offset,0),0);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Acesso restrito a administradores'; END IF;
  RETURN QUERY
  SELECT b.user_id, b.full_name, b.email, b.plan, b.created_at, b.plan_activated_at,
    b.last_seen_at, b.checkins_total, b.diaries_total, b.last_onboarding_email,
    b.last_onboarding_template, b.onboarding_status, count(*) OVER() AS total_count
  FROM public.admin_onboarding_base() b
  WHERE b.onboarding_status <> 'fora_da_jornada'
    AND (nullif(coalesce(p_plan,''),'') IS NULL OR p_plan = 'todos' OR b.plan = p_plan)
    AND (nullif(coalesce(p_status,''),'') IS NULL OR p_status = 'todos' OR b.onboarding_status = p_status)
    AND (v_q IS NULL OR b.full_name ILIKE '%' || v_q || '%' OR b.email ILIKE '%' || v_q || '%')
  ORDER BY
    CASE b.onboarding_status
      WHEN 'aguardando_checkin' THEN 1
      WHEN 'aguardando_diario' THEN 2
      WHEN 'conhecendo_plano' THEN 3
      ELSE 4
    END,
    coalesce(b.last_onboarding_email, b.created_at) DESC,
    b.user_id
  LIMIT v_limit OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_onboarding_page(text,text,text,int,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_onboarding_page(text,text,text,int,int) TO authenticated;

-- 4) Candidatos para o cron de onboarding (somente service_role) -------------
CREATE OR REPLACE FUNCTION public.get_onboarding_email_candidates()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  plan text,
  created_at timestamptz,
  plan_activated_at timestamptz,
  last_seen_at timestamptz,
  checkins_total int,
  diaries_total int,
  last_nurture_email timestamptz,
  email_enabled boolean,
  receive_product_updates boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito ao serviço';
  END IF;

  RETURN QUERY
  WITH diary AS (
    SELECT d.user_id,
      count(*) FILTER (WHERE d.entry_type = 'checkin')::int AS checkins_total,
      count(*) FILTER (WHERE d.entry_type = 'diary')::int AS diaries_total
    FROM public.diary_entries d
    GROUP BY d.user_id
  ), nurture AS (
    SELECT l.user_id, max(l.created_at) AS last_nurture_email
    FROM public.email_logs l
    WHERE l.user_id IS NOT NULL
      AND (l.template_key LIKE 'selfcare_%' OR l.template_key LIKE 'value_%')
      AND l.status IN ('pending','sent','delivered')
    GROUP BY l.user_id
  )
  SELECT p.user_id, p.email, p.full_name, p.plan, p.created_at, p.plan_activated_at,
    p.last_seen_at, coalesce(d.checkins_total,0)::int, coalesce(d.diaries_total,0)::int,
    n.last_nurture_email,
    coalesce(pref.email_enabled, true), coalesce(pref.receive_product_updates, true)
  FROM public.profiles p
  LEFT JOIN diary d ON d.user_id = p.user_id
  LEFT JOIN nurture n ON n.user_id = p.user_id
  LEFT JOIN public.user_notification_preferences pref ON pref.user_id = p.user_id
  WHERE p.email IS NOT NULL
    AND coalesce(p.email_notifications, true) = true
    AND coalesce(p.role,'user') <> 'admin'
    AND (
      p.created_at >= now() - interval '30 days'
      OR p.plan_activated_at >= now() - interval '21 days'
    )
  ORDER BY p.created_at DESC
  LIMIT 3000;
END;
$$;

REVOKE ALL ON FUNCTION public.get_onboarding_email_candidates() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_email_candidates() TO service_role;

-- 5) Agendamento --------------------------------------------------------------
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
  BEGIN
    PERFORM cron.unschedule('run-onboarding-emails');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  PERFORM cron.schedule(
    'run-onboarding-emails',
    '0 13 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://lejvvhzluggyxlfwfoxl.supabase.co/functions/v1/run-onboarding-emails',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM private.cron_config WHERE key = 'automation_token')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 40000
      );
    $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net indisponível (%): onboarding não agendado.', SQLERRM;
END;
$$;
