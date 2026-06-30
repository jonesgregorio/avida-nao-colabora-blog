-- ============================================================
-- Migration 020: Versão final dos planos, recursos, templates
-- ============================================================

-- 1. plan_features — catálogo oficial de recursos
CREATE TABLE IF NOT EXISTS plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  feature_description TEXT,
  category TEXT,
  display_order INTEGER DEFAULT 0,
  is_implemented BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. plan_feature_access — quais recursos cada plano tem
CREATE TABLE IF NOT EXISTS plan_feature_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_key TEXT NOT NULL,
  feature_key TEXT NOT NULL REFERENCES plan_features(feature_key) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  limit_value INTEGER,
  custom_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_key, feature_key)
);

-- 3. support_reply_templates — templates editáveis pelo admin
CREATE TABLE IF NOT EXISTS support_reply_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. professional_comments — comentários do profissional sobre relatório
CREATE TABLE IF NOT EXISTS professional_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID,
  report_month TEXT,
  report_id UUID,
  title TEXT,
  comment TEXT NOT NULL,
  visibility TEXT DEFAULT 'user',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. self_care_plan_reviews — revisão mensal do plano de autocuidado (Plus)
CREATE TABLE IF NOT EXISTS self_care_plan_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  professional_id UUID,
  review_month TEXT NOT NULL,
  summary TEXT,
  suggested_adjustments TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. monthly_guidance_requests — orientação mensal por mensagem (Terapêutico)
CREATE TABLE IF NOT EXISTS monthly_guidance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_key)
);

-- 7. Colunas extras em notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_view TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_label TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. RLS
ALTER TABLE plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_feature_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_reply_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE self_care_plan_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_guidance_requests ENABLE ROW LEVEL SECURITY;

-- plan_features: read by all, write by admin
DROP POLICY IF EXISTS "plan_features_read" ON plan_features;
CREATE POLICY "plan_features_read" ON plan_features FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_features_admin" ON plan_features;
CREATE POLICY "plan_features_admin" ON plan_features FOR ALL USING (is_admin());

-- plan_feature_access: read by all, write by admin
DROP POLICY IF EXISTS "plan_feature_access_read" ON plan_feature_access;
CREATE POLICY "plan_feature_access_read" ON plan_feature_access FOR SELECT USING (true);
DROP POLICY IF EXISTS "plan_feature_access_admin" ON plan_feature_access;
CREATE POLICY "plan_feature_access_admin" ON plan_feature_access FOR ALL USING (is_admin());

-- support_reply_templates: read by admin, write by admin
DROP POLICY IF EXISTS "templates_admin" ON support_reply_templates;
CREATE POLICY "templates_admin" ON support_reply_templates FOR ALL USING (is_admin());

-- professional_comments: user reads own, admin reads all
DROP POLICY IF EXISTS "prof_comments_user" ON professional_comments;
CREATE POLICY "prof_comments_user" ON professional_comments FOR SELECT USING (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "prof_comments_admin" ON professional_comments;
CREATE POLICY "prof_comments_admin" ON professional_comments FOR ALL USING (is_admin());

-- self_care_plan_reviews: user reads own, admin all
DROP POLICY IF EXISTS "scpr_user" ON self_care_plan_reviews;
CREATE POLICY "scpr_user" ON self_care_plan_reviews FOR SELECT USING (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "scpr_admin" ON self_care_plan_reviews;
CREATE POLICY "scpr_admin" ON self_care_plan_reviews FOR ALL USING (is_admin());

-- monthly_guidance_requests: user reads own, admin all
DROP POLICY IF EXISTS "mgr_user" ON monthly_guidance_requests;
CREATE POLICY "mgr_user" ON monthly_guidance_requests FOR SELECT USING (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "mgr_insert" ON monthly_guidance_requests;
CREATE POLICY "mgr_insert" ON monthly_guidance_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "mgr_admin" ON monthly_guidance_requests;
CREATE POLICY "mgr_admin" ON monthly_guidance_requests FOR ALL USING (is_admin());

-- Ensure columns exist (table may have been created without them)
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS is_implemented BOOLEAN DEFAULT true;
ALTER TABLE plan_features ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- SEED: plan_features (versão final oficial)
-- ============================================================
INSERT INTO plan_features (feature_key, feature_name, feature_description, category, display_order, is_implemented) VALUES
  -- CONTEÚDO
  ('articles_free','Artigos gratuitos','Acesso a artigos do blog sem custo','Conteúdo',1,true),
  ('guided_text_meditations','Meditações guiadas em texto','Meditações em formato de leitura guiada','Conteúdo',2,true),
  ('emotional_exercise_library','Biblioteca de exercícios emocionais','Exercícios práticos de autocuidado','Conteúdo',3,false),
  ('personalized_content_recommendations','Recomendações personalizadas de conteúdo','Sugestões baseadas no seu estado emocional','Conteúdo',4,false),
  ('early_access_content','Acesso antecipado a novos conteúdos','Veja novos artigos e recursos antes dos outros planos','Conteúdo',5,false),
  -- DIÁRIO
  ('wellbeing_diary_limited','Diário de bem-estar (até 5 entradas/mês)','Registro emocional com limite mensal','Diário',10,true),
  ('diary_monthly_limit_5','Limite de 5 entradas/mês no diário','Controle de limite de entradas','Diário',11,true),
  ('simple_mood_checkin','Registro simples de humor','Marcação rápida de como você está se sentindo','Diário',12,true),
  ('diary_unlimited','Diário ilimitado','Registro emocional sem limite de entradas','Diário',13,true),
  ('guided_diary_notes','Notas guiadas no diário','Perguntas guiadas para reflexão no diário','Diário',14,true),
  ('advanced_diary','Diário avançado','Diário com campos aprofundados de análise emocional','Diário',15,true),
  ('extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy','Marcadores extras (sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima, energia)','Marcadores emocionais avançados para acompanhamento detalhado','Diário',16,true),
  -- AVALIAÇÕES
  ('basic_self_assessment','Questionário básico de autoavaliação','Questionário introdutório de bem-estar emocional','Avaliações',20,true),
  ('biweekly_auto_challenges','Mini-desafios quinzenais automatizados','Desafios de autocuidado enviados automaticamente','Avaliações',21,true),
  ('weekly_assessments','Avaliações semanais','Avaliações periódicas do seu estado emocional','Avaliações',22,false),
  ('deep_questionnaire','Questionário aprofundado','Questionário extenso de análise emocional personalizada','Avaliações',23,true),
  -- RELATÓRIOS
  ('monthly_pdf_reports','Relatórios mensais em PDF','Exportação mensal do seu histórico emocional','Relatórios',30,false),
  ('diary_mood_symptoms_summary','Resumo do diário, humor e sintomas','Síntese mensal do que foi registrado','Relatórios',31,false),
  ('evolution_highlights_no_clinical_analysis','Destaques de evolução, sem análise clínica','Pontos de melhora identificados sem linguagem clínica','Relatórios',32,false),
  ('simple_evolution_charts','Gráficos simples de evolução','Visualização gráfica do histórico emocional','Relatórios',33,false),
  ('monthly_comparative_charts','Gráficos comparativos mensais','Comparação de dados emocionais entre meses','Relatórios',34,false),
  ('advanced_monthly_report','Relatório mensal avançado','Relatório detalhado com análise de padrões','Relatórios',35,false),
  -- HISTÓRICO
  ('limited_history','Histórico limitado','Acesso ao histórico dos últimos 30 dias','Histórico',40,true),
  ('full_history','Histórico completo','Acesso a todo o histórico de registros','Histórico',41,true),
  -- AUTOCUIDADO
  ('personalized_self_care_plan','Plano de autocuidado personalizado','Plano de práticas de autocuidado baseado no seu perfil','Autocuidado',50,false),
  ('weekly_self_care_plan','Plano semanal de autocuidado','Organização semanal de práticas de autocuidado','Autocuidado',51,false),
  ('monthly_self_care_plan_review','Revisão mensal do plano de autocuidado','Profissional revisa e ajusta seu plano mensalmente','Autocuidado',52,false),
  -- SUPORTE
  ('priority_email_support','Suporte por e-mail prioritário','Atendimento com prioridade por e-mail','Suporte',60,true),
  ('maximum_priority_support','Suporte prioritário máximo','Atendimento com máxima prioridade','Suporte',61,true),
  -- SESSÃO/PROFISSIONAL
  ('monthly_message_guidance','Orientação mensal por mensagem','Uma solicitação de orientação por mês respondida por mensagem','Sessão/Profissional',70,true),
  ('monthly_psychoanalyst_session_30min','1 sessão mensal de 30 min com Psicanalista','Sessão individual mensal com profissional habilitado','Sessão/Profissional',71,false),
  ('professional_comment_on_monthly_report','Comentário individual sobre o relatório do mês','Profissional escreve devolutiva sobre seu relatório mensal','Sessão/Profissional',72,true),
  -- ANÚNCIOS
  ('ads_enabled','Conteúdos com anúncios','O site exibe anúncios durante a navegação','Anúncios',80,true),
  ('no_ads','Sem anúncios','Navegação sem anúncios','Anúncios',81,true)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  feature_description = EXCLUDED.feature_description,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============================================================
-- SEED: plan_feature_access
-- ============================================================

-- GRATUITO
INSERT INTO plan_feature_access (plan_key, feature_key, enabled) VALUES
  ('free','articles_free',true),
  ('free','basic_self_assessment',true),
  ('free','wellbeing_diary_limited',true),
  ('free','diary_monthly_limit_5',true),
  ('free','simple_mood_checkin',true),
  ('free','biweekly_auto_challenges',true),
  ('free','limited_history',true),
  ('free','ads_enabled',true),
  ('free','guided_text_meditations',false),
  ('free','emotional_exercise_library',false),
  ('free','diary_unlimited',false),
  ('free','full_history',false),
  ('free','weekly_assessments',false),
  ('free','monthly_pdf_reports',false),
  ('free','no_ads',false)
ON CONFLICT (plan_key, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ESSENCIAL
INSERT INTO plan_feature_access (plan_key, feature_key, enabled) VALUES
  ('essential','articles_free',true),
  ('essential','basic_self_assessment',true),
  ('essential','simple_mood_checkin',true),
  ('essential','biweekly_auto_challenges',true),
  ('essential','diary_unlimited',true),
  ('essential','full_history',true),
  ('essential','weekly_assessments',true),
  ('essential','simple_evolution_charts',true),
  ('essential','guided_text_meditations',true),
  ('essential','guided_diary_notes',true),
  ('essential','monthly_pdf_reports',true),
  ('essential','diary_mood_symptoms_summary',true),
  ('essential','evolution_highlights_no_clinical_analysis',true),
  ('essential','emotional_exercise_library',true),
  ('essential','no_ads',true),
  ('essential','priority_email_support',true),
  ('essential','ads_enabled',false),
  ('essential','limited_history',false),
  ('essential','wellbeing_diary_limited',false),
  ('essential','diary_monthly_limit_5',false)
ON CONFLICT (plan_key, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- TERAPÊUTICO
INSERT INTO plan_feature_access (plan_key, feature_key, enabled) VALUES
  ('therapeutic','articles_free',true),
  ('therapeutic','basic_self_assessment',true),
  ('therapeutic','simple_mood_checkin',true),
  ('therapeutic','biweekly_auto_challenges',true),
  ('therapeutic','diary_unlimited',true),
  ('therapeutic','full_history',true),
  ('therapeutic','weekly_assessments',true),
  ('therapeutic','simple_evolution_charts',true),
  ('therapeutic','guided_text_meditations',true),
  ('therapeutic','guided_diary_notes',true),
  ('therapeutic','monthly_pdf_reports',true),
  ('therapeutic','diary_mood_symptoms_summary',true),
  ('therapeutic','evolution_highlights_no_clinical_analysis',true),
  ('therapeutic','emotional_exercise_library',true),
  ('therapeutic','no_ads',true),
  ('therapeutic','priority_email_support',true),
  ('therapeutic','deep_questionnaire',true),
  ('therapeutic','personalized_self_care_plan',true),
  ('therapeutic','advanced_diary',true),
  ('therapeutic','extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy',true),
  ('therapeutic','monthly_comparative_charts',true),
  ('therapeutic','advanced_monthly_report',true),
  ('therapeutic','personalized_content_recommendations',true),
  ('therapeutic','weekly_self_care_plan',true),
  ('therapeutic','early_access_content',true),
  ('therapeutic','monthly_message_guidance',true),
  ('therapeutic','ads_enabled',false),
  ('therapeutic','limited_history',false)
ON CONFLICT (plan_key, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- TERAPÊUTICO PLUS
INSERT INTO plan_feature_access (plan_key, feature_key, enabled) VALUES
  ('therapeutic-plus','articles_free',true),
  ('therapeutic-plus','basic_self_assessment',true),
  ('therapeutic-plus','simple_mood_checkin',true),
  ('therapeutic-plus','biweekly_auto_challenges',true),
  ('therapeutic-plus','diary_unlimited',true),
  ('therapeutic-plus','full_history',true),
  ('therapeutic-plus','weekly_assessments',true),
  ('therapeutic-plus','simple_evolution_charts',true),
  ('therapeutic-plus','guided_text_meditations',true),
  ('therapeutic-plus','guided_diary_notes',true),
  ('therapeutic-plus','monthly_pdf_reports',true),
  ('therapeutic-plus','diary_mood_symptoms_summary',true),
  ('therapeutic-plus','evolution_highlights_no_clinical_analysis',true),
  ('therapeutic-plus','emotional_exercise_library',true),
  ('therapeutic-plus','no_ads',true),
  ('therapeutic-plus','priority_email_support',true),
  ('therapeutic-plus','deep_questionnaire',true),
  ('therapeutic-plus','personalized_self_care_plan',true),
  ('therapeutic-plus','advanced_diary',true),
  ('therapeutic-plus','extra_markers_sleep_depression_fear_compulsion_triggers_anxiety_selfesteem_energy',true),
  ('therapeutic-plus','monthly_comparative_charts',true),
  ('therapeutic-plus','advanced_monthly_report',true),
  ('therapeutic-plus','personalized_content_recommendations',true),
  ('therapeutic-plus','weekly_self_care_plan',true),
  ('therapeutic-plus','early_access_content',true),
  ('therapeutic-plus','monthly_message_guidance',true),
  ('therapeutic-plus','monthly_psychoanalyst_session_30min',true),
  ('therapeutic-plus','monthly_self_care_plan_review',true),
  ('therapeutic-plus','professional_comment_on_monthly_report',true),
  ('therapeutic-plus','maximum_priority_support',true),
  ('therapeutic-plus','ads_enabled',false),
  ('therapeutic-plus','limited_history',false)
ON CONFLICT (plan_key, feature_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

-- ============================================================
-- SEED: support_reply_templates
-- ============================================================
INSERT INTO support_reply_templates (title, category, body, is_active, is_favorite) VALUES

('Recebemos sua solicitação','Boas-vindas','Olá! Recebemos sua solicitação e ela já está registrada por aqui.

Vou analisar as informações com atenção e te retornar assim que possível.

Enquanto isso, você pode acompanhar o andamento por esta conversa dentro do site.',true,true),

('Como o blog funciona','Uso do blog','Olá! O "A Vida Não Colabora" funciona como um espaço de apoio ao autoconhecimento e à organização emocional.

Você pode usar o site para ler artigos, registrar como está se sentindo no diário, responder questionários, acompanhar sua evolução, salvar conteúdos importantes e acessar recursos extras conforme o seu plano.

A ideia não é oferecer diagnóstico ou substituir acompanhamento profissional, mas ajudar você a perceber padrões, organizar sentimentos e criar pequenos passos de cuidado no dia a dia.',true,false),

('Objetivo do site','Missão e propósito','O objetivo do "A Vida Não Colabora" é oferecer um espaço simples, acolhedor e sem julgamentos para quem quer se entender melhor.

O site ajuda você a organizar pensamentos, registrar emoções, perceber padrões, encontrar conteúdos úteis para o seu momento e construir uma rotina de autocuidado possível.

Ele é uma ferramenta complementar de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.',true,false),

('Missão do blog','Missão e propósito','Nossa missão é transformar temas de saúde emocional em algo mais próximo da vida real.

Falamos sobre autocuidado, cansaço, ansiedade, autoestima, limites, rotina e emoções difíceis de uma forma simples, humana e prática.

Queremos que você encontre aqui um espaço para respirar, se organizar e dar pequenos passos, sem cobrança de perfeição.',true,false),

('Diferença entre os planos','Planos','Olá! Os planos foram pensados para diferentes níveis de uso dentro do site.

O Gratuito permite começar com artigos, questionário básico, diário limitado, registro simples de humor e mini-desafios.

O Essencial libera uso contínuo, com diário ilimitado, histórico completo, avaliações semanais, gráficos simples, relatórios mensais, meditações, notas guiadas e biblioteca de exercícios.

O Terapêutico adiciona uma experiência mais personalizada, com questionário aprofundado, plano de autocuidado, diário avançado, marcadores extras, recomendações, plano semanal e orientação mensal por mensagem.

O Terapêutico Plus inclui o Terapêutico e acrescenta 1 sessão mensal de 30 minutos com Psicanalista, revisão mensal do plano de autocuidado, comentário individual sobre o relatório do mês e suporte prioritário máximo.',true,true),

('Plano Gratuito','Planos','O plano Gratuito é uma forma de começar a usar o site sem compromisso.

Ele inclui artigos gratuitos, questionário básico de autoavaliação, diário de bem-estar com até 5 entradas por mês, registro simples de humor, mini-desafios quinzenais automatizados, histórico limitado e conteúdos com anúncios.

É ideal para conhecer o projeto e começar a registrar emoções de forma simples.',true,false),

('Plano Essencial','Planos','O plano Essencial custa R$ 19,90 por mês e é indicado para quem quer usar o site de forma contínua.

Ele inclui tudo do Gratuito e também diário ilimitado, histórico completo, avaliações semanais, gráficos simples de evolução, meditações guiadas em texto, notas guiadas no diário, relatórios mensais em PDF, resumo do diário, humor e sintomas, destaques de evolução sem análise clínica, biblioteca de exercícios emocionais, uso sem anúncios e suporte por e-mail prioritário.',true,false),

('Plano Terapêutico','Planos','O plano Terapêutico custa R$ 39,90 por mês e oferece uma experiência mais personalizada.

Ele inclui tudo do Essencial e também questionário aprofundado, plano de autocuidado personalizado, diário avançado, marcadores extras como sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia, gráficos comparativos mensais, relatório mensal avançado, recomendações personalizadas de conteúdo, plano semanal de autocuidado, acesso antecipado a novos conteúdos e orientação mensal por mensagem.',true,false),

('Plano Terapêutico Plus','Planos','O plano Terapêutico Plus custa R$ 79,90 por mês e é o plano mais completo.

Ele inclui tudo do Terapêutico e também 1 sessão mensal de 30 minutos com Psicanalista, revisão mensal do plano de autocuidado, comentário individual sobre o relatório do mês e suporte prioritário máximo.

É indicado para quem quer usar o site com acompanhamento mais próximo e recursos mensais adicionais.',true,false),

('Qual plano escolher','Planos','Para escolher o plano, pense no tipo de uso que você deseja.

Se você quer apenas conhecer o site, o Gratuito pode ser suficiente.
Se quer registrar emoções com frequência e acompanhar sua evolução, o Essencial costuma fazer mais sentido.
Se quer recursos personalizados, diário avançado, plano de autocuidado e orientação mensal por mensagem, o Terapêutico pode ser melhor.
Se você quer também sessão mensal com Psicanalista, revisão do plano de autocuidado e comentário individual sobre relatório, o Terapêutico Plus é o plano mais completo.',true,true),

('Orientação mensal por mensagem','Orientação mensal','A orientação mensal por mensagem é um recurso do plano Terapêutico.

Ela permite enviar uma solicitação mensal para receber uma orientação breve dentro do próprio site.

A ideia é ajudar você a organizar dúvidas, revisar dificuldades do mês e receber um direcionamento simples de cuidado, sempre sem substituir acompanhamento psicológico, psiquiátrico ou médico.',true,false),

('Sessão mensal Plus','Sessão Plus','O plano Terapêutico Plus inclui 1 sessão mensal de 30 minutos com Psicanalista.

Essa sessão é um recurso adicional do plano e pode ser usada para conversar sobre temas que apareceram ao longo do mês, revisar pontos importantes e apoiar sua organização emocional.

O site pode ajudar registrando histórico, relatórios e comentários, mas a sessão acontece conforme a disponibilidade e regras definidas para o serviço.',true,false),

('Comentário sobre relatório do mês','Profissional','No plano Terapêutico Plus, o usuário pode receber um comentário individual sobre o relatório do mês.

Esse comentário deve ser uma devolutiva breve e organizada, feita a partir das informações autorizadas e disponíveis no relatório.

A proposta é ajudar o usuário a refletir sobre padrões, avanços, dificuldades e possíveis próximos passos, sem linguagem diagnóstica ou promessa clínica.',true,false),

('Precisamos de mais informações','Suporte técnico','Olá! Para eu conseguir te ajudar melhor, preciso de mais algumas informações.

Você pode me enviar mais detalhes sobre o que aconteceu? Se possível, informe:
- em qual página ou recurso ocorreu;
- o que você tentou fazer;
- se apareceu alguma mensagem de erro;
- se o problema aconteceu no celular ou computador.

Assim consigo analisar com mais precisão.',true,true),

('Problema técnico em análise','Suporte técnico','Olá! Obrigado por avisar.

Esse comportamento parece estar relacionado a uma instabilidade ou problema técnico. Vou verificar com mais cuidado e acompanhar por aqui.

Assim que eu tiver uma atualização, te respondo nesta mesma solicitação.',true,false),

('Problema resolvido','Suporte técnico','Olá! Fizemos uma verificação e o problema informado foi corrigido.

Você pode testar novamente, por favor?

Caso ainda perceba algo errado, responda esta solicitação com mais detalhes para que eu continue acompanhando.',true,false),

('Não consegui reproduzir o erro','Suporte técnico','Olá! Fiz alguns testes, mas por enquanto não consegui reproduzir o erro informado.

Você pode me enviar mais detalhes, como:
- print da tela, se possível;
- passo a passo do que você fez;
- navegador ou aparelho usado;
- horário aproximado em que aconteceu.

Com isso, consigo investigar melhor.',true,false),

('Recurso em implantação','Suporte','Olá! Esse recurso já faz parte do planejamento da plataforma, mas ainda está em implantação.

Estamos organizando a funcionalidade para que ela funcione de forma segura, clara e integrada ao seu plano.

Assim que estiver disponível, ela aparecerá dentro do site com instruções de uso.',true,false),

('Recurso disponível em outro plano','Planos','Olá! Esse recurso faz parte de um plano superior ao seu plano atual.

Você ainda pode continuar usando os recursos disponíveis no seu plano, mas para acessar essa funcionalidade específica será necessário fazer upgrade.

Se quiser, posso te explicar a diferença entre os planos e te ajudar a escolher a melhor opção.',true,false),

('Solicitação de cancelamento','Comercial','Olá! Recebi sua solicitação de cancelamento.

Vou verificar as informações da sua assinatura e te orientar sobre os próximos passos.

Se puder, me diga também o motivo do cancelamento. Isso nos ajuda a melhorar o serviço.',true,false),

('Pagamento ou assinatura','Pagamento','Olá! Vou te ajudar com sua assinatura.

Para analisar melhor, me informe o que aconteceu:
- pagamento não aprovado;
- cobrança duplicada;
- plano não liberado;
- desconto não aplicado;
- dúvida sobre renovação;
- cancelamento.

Com essas informações, consigo direcionar melhor o atendimento.',true,false),

('Privacidade dos registros','Privacidade','Seus registros no diário, respostas de questionários e relatórios são informações pessoais.

A proposta do site é que esses dados sejam usados para melhorar sua própria experiência dentro da plataforma, como gráficos, resumos e sugestões.

Qualquer uso envolvendo comentário profissional ou revisão mensal deve respeitar as permissões e autorizações do usuário.',true,false),

('Atendimento prioritário Plus','Suporte','Olá! Vi que você está no plano Terapêutico Plus, então sua solicitação será tratada com prioridade máxima.

Vou analisar o caso com atenção e te retornar por aqui assim que possível.',true,false),

('Encerramento cordial','Encerramento','Olá! Como não tivemos novas mensagens por aqui e a solicitação parece ter sido resolvida, vou encerrar este atendimento.

Se precisar de ajuda novamente, você pode abrir uma nova solicitação pelo Suporte dentro do site.',true,true)

ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATE plan_configs com versão final dos planos
-- ============================================================
INSERT INTO plan_configs (plan_key, label, price, description, recommended, active, diary_limit)
VALUES
  ('free',             'Gratuito',         'R$ 0',    'Para começar a se conhecer melhor, sem custo.', false, true, 5),
  ('essential',        'Essencial',        'R$ 19,90','Diário ilimitado, histórico completo e relatórios mensais.',    false, true, null),
  ('therapeutic',      'Terapêutico',      'R$ 39,90','Experiência personalizada de autocuidado com orientação mensal.', true, true, null),
  ('therapeutic-plus', 'Terapêutico Plus', 'R$ 79,90','Sessão mensal com Psicanalista e acompanhamento individual.',   false, true, null)
ON CONFLICT (plan_key) DO UPDATE SET
  label = EXCLUDED.label,
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  recommended = EXCLUDED.recommended,
  active = EXCLUDED.active,
  diary_limit = EXCLUDED.diary_limit,
  updated_at = now();
