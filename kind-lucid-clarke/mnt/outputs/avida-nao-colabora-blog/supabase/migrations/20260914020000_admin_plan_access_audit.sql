-- Ferramenta administrativa de auditoria de acesso por plano (Gratuito/Essencial/Plus).
-- Só LÊ metadados do próprio Postgres (pg_proc/pg_policies) — nunca dado de usuário — e
-- só compara com o que a matriz oficial (README "Planos oficiais") já documenta. Não
-- corrige nada sozinha, só aponta.
--
-- Duas camadas de item:
--  - "banco de dados": verificado ao vivo aqui, a cada chamada (RLS/trigger real existe e
--    tem o texto esperado). Isso é o que de fato impede alguém de pular a tela e pedir o
--    dado direto pela API.
--  - "frontend (auditoria manual)": o React decide o que a TELA mostra, mas nada no
--    Postgres consegue ler código TypeScript — por isso esses itens ficam com status fixo
--    'info' e a data da última revisão manual, sem fingir que são verificados ao vivo.
CREATE OR REPLACE FUNCTION public.admin_plan_access_audit()
RETURNS TABLE(area text, item text, layer text, expected text, status text, detail text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  diary_fn_src text;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT pg_get_functiondef(p.oid) INTO diary_fn_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'enforce_diary_entry_rules'
  LIMIT 1;

  RETURN QUERY
  -- 1) Check-in: 1x/dia, todos os planos.
  SELECT 'Diário'::text, 'Check-in diário'::text, 'banco de dados'::text, '1 por dia, todos os planos'::text,
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'diary_entries_one_checkin_per_user_day_idx') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'diary_entries_one_checkin_per_user_day_idx')
      THEN 'Índice único diary_entries_one_checkin_per_user_day_idx impede duplicar check-in no mesmo dia, direto no banco.'
      ELSE 'Índice único não encontrado — o limite de 1 check-in/dia pode não estar garantido pelo banco.' END

  UNION ALL
  -- 2) Diário: 5 registros básicos/mês no Gratuito.
  SELECT 'Diário', 'Limite de 5 registros/mês no Gratuito', 'banco de dados', 'Gratuito: até 5/mês; Essencial/Plus: sem limite',
    CASE WHEN diary_fn_src IS NOT NULL AND diary_fn_src ILIKE '%monthly_count >= 5%' THEN 'ok' ELSE 'attention' END,
    CASE WHEN diary_fn_src IS NULL THEN 'Função enforce_diary_entry_rules não encontrada.'
      WHEN diary_fn_src ILIKE '%monthly_count >= 5%' THEN 'Trigger enforce_diary_entry_rules recusa o 6º registro básico do mês para plano Gratuito.'
      ELSE 'Trigger existe, mas não encontrei a checagem de limite mensal esperada.' END

  UNION ALL
  -- 3) Diário: tipo de registro (basic/main/advanced) respeita o plano.
  SELECT 'Diário', 'Tipo de registro respeita o plano (básico só Gratuito, avançado só Plus)', 'banco de dados', 'Gratuito=básico; Essencial+Plus=principal; Plus=avançado',
    CASE WHEN diary_fn_src IS NOT NULL AND diary_fn_src ILIKE '%exclusivo do plano Gratuito%' AND diary_fn_src ILIKE '%disponível no Plus%' THEN 'ok' ELSE 'attention' END,
    CASE WHEN diary_fn_src IS NULL THEN 'Função enforce_diary_entry_rules não encontrada.'
      WHEN diary_fn_src ILIKE '%exclusivo do plano Gratuito%' AND diary_fn_src ILIKE '%disponível no Plus%' THEN 'Trigger recusa registro do tipo errado pra cada plano.'
      ELSE 'Trigger existe, mas não encontrei as duas mensagens de recusa esperadas.' END

  UNION ALL
  -- 4) Aprofundamentos: limite de 3/dia.
  SELECT 'Diário', 'Aprofundamentos: até 3 por dia', 'banco de dados', 'Máximo 3 edições significativas por registro/dia',
    CASE WHEN diary_fn_src IS NOT NULL AND diary_fn_src ILIKE '%deepening_count, 0) >= 3%' THEN 'ok' ELSE 'attention' END,
    CASE WHEN diary_fn_src IS NULL THEN 'Função enforce_diary_entry_rules não encontrada.'
      WHEN diary_fn_src ILIKE '%deepening_count, 0) >= 3%' THEN 'Trigger recusa o 4º aprofundamento do dia.'
      ELSE 'Trigger existe, mas não encontrei a checagem de limite de 3 aprofundamentos.' END

  UNION ALL
  -- 5) Aprofundamentos: exige plano Plus (corrigido nesta auditoria — antes só a tela checava).
  SELECT 'Diário', 'Aprofundamentos exigem plano Plus', 'banco de dados', 'Só Plus pode aprofundar (antes era só a tela)',
    CASE WHEN diary_fn_src IS NOT NULL AND diary_fn_src ILIKE '%Aprofundar o registro do dia%' THEN 'ok' ELSE 'attention' END,
    CASE WHEN diary_fn_src IS NULL THEN 'Função enforce_diary_entry_rules não encontrada.'
      WHEN diary_fn_src ILIKE '%Aprofundar o registro do dia%' THEN 'Trigger recusa aprofundamento de quem não é Plus, mesmo chamando a API direto.'
      ELSE 'Trigger existe, mas não recusa aprofundamento de não-Plus — só a tela impede hoje.' END

  UNION ALL
  -- 6) Questionários por plano.
  SELECT 'Questionários', 'Catálogo filtrado por plano (Gratuito/Essencial/Plus)', 'banco de dados', 'RLS usa o plano efetivo (considera acesso liberado pelo Admin)',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaires' AND policyname='questionnaires_user_access' AND qual ILIKE '%can_access_questionnaire%') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questionnaires' AND policyname='questionnaires_user_access' AND qual ILIKE '%can_access_questionnaire%')
      THEN 'Policy questionnaires_user_access usa can_access_questionnaire(), que já considera acesso liberado pelo Admin.'
      ELSE 'Policy esperada não encontrada ou não usa mais can_access_questionnaire() — reveja a RLS de questionnaires.' END

  UNION ALL
  -- 7) Conteúdos Guiados por plano.
  SELECT 'Conteúdos Guiados', 'Etapas do conteúdo filtradas por plano', 'banco de dados', 'RLS usa o plano efetivo',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guided_content_steps' AND policyname='guided_steps_read' AND qual ILIKE '%current_user_has_plan%') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='guided_content_steps' AND policyname='guided_steps_read' AND qual ILIKE '%current_user_has_plan%')
      THEN 'Policy guided_steps_read usa current_user_has_plan() — mesmo pulando a listagem, as etapas do conteúdo não vazam.'
      ELSE 'Policy esperada não encontrada ou mudou de nome — reveja a RLS de guided_content_steps.' END

  UNION ALL
  -- 8) Relatório semanal (Essencial+) e mensal (Plus).
  SELECT 'Relatórios', 'Semanal exige Essencial+; mensal aprofundado exige Plus', 'banco de dados', 'weekly: essential/plus; monthly: plus',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_own_eligible' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%weekly%' AND qual ILIKE '%monthly%') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_own_eligible' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%weekly%' AND qual ILIKE '%monthly%')
      THEN 'Policy reports_own_eligible distingue weekly (essential/plus) de monthly (plus) usando o plano efetivo.'
      ELSE 'Policy esperada não encontrada ou não distingue mais weekly/monthly por plano — reveja a RLS de reports.' END

  UNION ALL
  -- 9) Plano de Autocuidado (Plus).
  SELECT 'Plano de Autocuidado', 'Conteúdo do plano exige Plus', 'banco de dados', 'plus + assinatura ativa, ou acesso ilimitado',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_care_plans' AND policyname='mcp_own_sent' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%plus%') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_care_plans' AND policyname='mcp_own_sent' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%plus%')
      THEN 'Policy mcp_own_sent exige plano Plus efetivo (ou acesso ilimitado) para ler um plano enviado.'
      ELSE 'Policy esperada não encontrada ou não exige mais Plus — reveja a RLS de monthly_care_plans.' END

  UNION ALL
  -- 10) Orientação mensal (Plus).
  SELECT 'Orientação Mensal', 'Solicitações e respostas exigem Plus', 'banco de dados', 'plus + assinatura ativa, ou acesso ilimitado',
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_guidance_requests' AND policyname='guidance_own_eligible' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%plus%') THEN 'ok' ELSE 'attention' END,
    CASE WHEN EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='monthly_guidance_requests' AND policyname='guidance_own_eligible' AND qual ILIKE '%effective_plan_for_user%' AND qual ILIKE '%plus%')
      THEN 'Policy guidance_own_eligible exige plano Plus efetivo (ou acesso ilimitado).'
      ELSE 'Policy esperada não encontrada ou não exige mais Plus — reveja a RLS de monthly_guidance_requests.' END

  -- 11-13) Itens que hoje só têm gate na TELA (React), sem reforço equivalente no banco.
  -- Postgres não consegue ler código TypeScript — por isso ficam com status fixo 'info' e a
  -- data da última auditoria manual, em vez de fingir uma verificação ao vivo que não existe.
  UNION ALL
  SELECT 'Mapa Emocional', 'Tela exige Essencial+', 'frontend (auditoria manual)', 'essential',
    'info', 'Gate em MyEvolutionPage.tsx via hasPlanAccess(). Dado subjacente (diário do próprio usuário) não tem RLS específica de plano — risco baixo (é o próprio dado do usuário), mas sem reforço de backend dedicado a esta tela. Última revisão manual: 2026-09-13.'

  UNION ALL
  SELECT 'Descobertas', 'Tela exige Essencial+', 'frontend (auditoria manual)', 'essential',
    'info', 'Gate em DescobertasPage.tsx via hasPlanAccess(). Mesma observação do Mapa Emocional: dado vem do diário do próprio usuário, sem RLS de plano dedicada. Última revisão manual: 2026-09-13.'

  UNION ALL
  SELECT 'Minha História', 'Visão completa exige Essencial+ (Gratuito vê versão inicial)', 'frontend (auditoria manual)', 'essential',
    'info', 'Gate em MyHistoryPage.tsx via hasPlanAccess(). Mesma observação: dado vem do diário do próprio usuário, sem RLS de plano dedicada. Última revisão manual: 2026-09-13.';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_plan_access_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_plan_access_audit() TO authenticated;
