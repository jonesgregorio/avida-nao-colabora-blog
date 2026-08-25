-- Auditoria de segurança (Parte 10, item P2 fechado agora a pedido do
-- usuário): 14 policies em 12 tabelas checavam profiles.role = 'admin'
-- diretamente, sem exigir AAL2 (MFA) como o resto do painel administrativo
-- (is_admin() já exige aal2 desde 20260819222500_auth_p0_hardening.sql).
-- Um admin autenticado só com senha (AAL1) já conseguia ler/escrever nessas
-- tabelas -- nenhuma é financeira ou clínica, mas a inconsistência não faz
-- sentido mantida.
--
-- Bônus encontrado ao corrigir: 4 dessas policies (custom_email_templates,
-- email_automations, email_logs, email_preferences) comparavam
-- "profiles.id = auth.uid()" -- profiles.id é a PK própria da tabela
-- (gen_random_uuid()), NUNCA igual ao auth.uid() do usuário. Essas policies
-- estavam de fato quebradas (nunca concediam acesso a ninguém via RLS);
-- passavam despercebidas porque essas tabelas são geridas via Edge
-- Functions com service_role, que ignora RLS. is_admin() usa a coluna
-- certa (profiles.user_id), corrigindo isso de graça.

DROP POLICY IF EXISTS "Admin lê logs" ON public.admin_logs;
CREATE POLICY "Admin lê logs" ON public.admin_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin lê todos os eventos" ON public.analytics_events;
CREATE POLICY "Admin lê todos os eventos" ON public.analytics_events
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_automated_contents" ON public.automated_contents;
CREATE POLICY "admin_automated_contents" ON public.automated_contents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_custom_email_templates" ON public.custom_email_templates;
CREATE POLICY "admin_all_custom_email_templates" ON public.custom_email_templates
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_all_email_automations" ON public.email_automations;
CREATE POLICY "admin_all_email_automations" ON public.email_automations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin vê todos os logs" ON public.email_logs;
CREATE POLICY "Admin vê todos os logs" ON public.email_logs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_email_preferences" ON public.email_preferences;
CREATE POLICY "admin_all_email_preferences" ON public.email_preferences
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia notificações" ON public.notifications;
CREATE POLICY "Admin gerencia notificações" ON public.notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia profissionais" ON public.professionals;
CREATE POLICY "Admin gerencia profissionais" ON public.professionals
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia opções" ON public.questionnaire_options;
CREATE POLICY "Admin gerencia opções" ON public.questionnaire_options
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia perguntas" ON public.questionnaire_questions;
CREATE POLICY "Admin gerencia perguntas" ON public.questionnaire_questions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia resultados" ON public.questionnaire_results;
CREATE POLICY "Admin gerencia resultados" ON public.questionnaire_results
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin lê métricas" ON public.site_metrics;
CREATE POLICY "Admin lê métricas" ON public.site_metrics
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Sistema atualiza métricas" ON public.site_metrics;
CREATE POLICY "Sistema atualiza métricas" ON public.site_metrics
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
