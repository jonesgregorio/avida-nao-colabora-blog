-- ============================================================================
-- 061 — Modelo de dados do CMS editorial
-- ============================================================================
-- Fundação para: editor com versões/rollback, Fábrica IA (geração em massa),
-- Templates de IA editáveis, Calendário Editorial, Automações e Performance.
-- Todas as tabelas são de uso administrativo → RLS restrito a is_admin().
-- ============================================================================

-- Gatilho genérico de updated_at (idempotente).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. content_versions — histórico de versões por artigo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_versions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id  uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version     integer NOT NULL DEFAULT 1,
  snapshot    jsonb NOT NULL,               -- estado completo do artigo naquele ponto
  change_note text,
  source      text NOT NULL DEFAULT 'manual', -- manual | ai | seo | publish | rollback
  ai_provider text,
  ai_prompt   text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_versions_article ON content_versions(article_id, version DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. editorial_calendar — pauta/planejamento editorial
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS editorial_calendar (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id     uuid REFERENCES articles(id) ON DELETE SET NULL, -- nulo = ideia sem artigo ainda
  title          text NOT NULL,
  content_type   text NOT NULL DEFAULT 'article',
  category       text,
  plan_required  text NOT NULL DEFAULT 'free',
  status         text NOT NULL DEFAULT 'ideia'
                 CHECK (status IN ('ideia','gerado_ia','em_revisao','aprovado','agendado','publicado','arquivado','precisa_atualizar')),
  scheduled_date date,
  origin         text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ia')),
  notes          text,
  assigned_to    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_editorial_calendar_date   ON editorial_calendar(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_editorial_calendar_status ON editorial_calendar(status);
DROP TRIGGER IF EXISTS trg_editorial_calendar_touch ON editorial_calendar;
CREATE TRIGGER trg_editorial_calendar_touch BEFORE UPDATE ON editorial_calendar
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 3. ai_prompt_templates — templates de prompt editáveis
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_prompt_templates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  name         text NOT NULL,
  content_type text NOT NULL DEFAULT 'article',
  prompt       text NOT NULL,
  variables    jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active    boolean NOT NULL DEFAULT true,
  version      integer NOT NULL DEFAULT 1,
  author       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_ai_prompt_templates_touch ON ai_prompt_templates;
CREATE TRIGGER trg_ai_prompt_templates_touch BEFORE UPDATE ON ai_prompt_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. content_generation_jobs — geração em massa (Fábrica IA)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_generation_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','running','completed','failed','partial')),
  briefing    jsonb NOT NULL DEFAULT '{}'::jsonb,
  total       integer NOT NULL DEFAULT 0,
  completed   integer NOT NULL DEFAULT 0,
  failed      integer NOT NULL DEFAULT 0,
  result      jsonb,
  error_msg   text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_status ON content_generation_jobs(status, created_at DESC);
DROP TRIGGER IF EXISTS trg_gen_jobs_touch ON content_generation_jobs;
CREATE TRIGGER trg_gen_jobs_touch BEFORE UPDATE ON content_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 5. content_automations — regras de automação do blog
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_automations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL,               -- generate_daily | publish_scheduled | notify_after_publish | ...
  frequency     text NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','biweekly','monthly')),
  category      text,
  plan_required text,
  status        text NOT NULL DEFAULT 'paused' CHECK (status IN ('active','paused')),
  mode          text NOT NULL DEFAULT 'require_approval' CHECK (mode IN ('auto_publish','require_approval')),
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  last_result   text,
  last_error    text,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automations_status ON content_automations(status);
DROP TRIGGER IF EXISTS trg_automations_touch ON content_automations;
CREATE TRIGGER trg_automations_touch BEFORE UPDATE ON content_automations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 6. content_performance — métricas agregadas por artigo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_performance (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id        uuid NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
  views             integer NOT NULL DEFAULT 0,
  reads             integer NOT NULL DEFAULT 0,
  saves             integer NOT NULL DEFAULT 0,
  cta_clicks        integer NOT NULL DEFAULT 0,
  feedback_positive integer NOT NULL DEFAULT 0,
  feedback_negative integer NOT NULL DEFAULT 0,
  avg_read_seconds  numeric,
  last_computed_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_perf_views ON content_performance(views DESC);
DROP TRIGGER IF EXISTS trg_content_perf_touch ON content_performance;
CREATE TRIGGER trg_content_perf_touch BEFORE UPDATE ON content_performance
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 7. media_library — estúdio de mídia (metadados; arquivos no Storage)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url          text NOT NULL,
  storage_path text,
  alt_text     text,
  credit       text,
  prompt       text,                          -- prompt de IA quando gerada
  width        integer,
  height       integer,
  mime_type    text,
  kind         text NOT NULL DEFAULT 'inline' CHECK (kind IN ('cover','og','social','inline')),
  article_id   uuid REFERENCES articles(id) ON DELETE SET NULL,
  uploaded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_library_article ON media_library(article_id);
CREATE INDEX IF NOT EXISTS idx_media_library_created ON media_library(created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- RLS — todas restritas a admin (is_admin())
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'content_versions','editorial_calendar','ai_prompt_templates',
    'content_generation_jobs','content_automations','content_performance','media_library'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_admin_all', t);
    EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING (is_admin()) WITH CHECK (is_admin())', t || '_admin_all', t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Seed de templates de IA (não sobrescreve edições do admin)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ai_prompt_templates (template_key, name, content_type, prompt, variables) VALUES
('artigo_gratuito','Artigo — Gratuito','article',
 'Escreva um artigo de blog acolhedor sobre saúde emocional. Tema: {{tema}}. Categoria: {{categoria}}. Tom: {{tom}}. Público: {{publico}}. Palavra-chave principal: {{palavra_chave}}. Estrutura: introdução acolhedora, explicação simples, exemplo real (sem nomes), reflexão guiada, exercício prático, 1 pergunta para o diário, CTA gentil e 1 linha de aviso de responsabilidade. Português brasileiro, sem prometer cura, sem diagnóstico.',
 '["tema","categoria","tom","publico","palavra_chave"]'),
('artigo_essential','Artigo — Essencial','article',
 'Escreva um artigo aprofundado (plano Essencial) sobre {{tema}} (categoria {{categoria}}, tom {{tom}}). Inclua contexto, passos práticos, um mini-mapa emocional relacionado, pergunta para o diário e CTA. Sem diagnóstico nem promessa de cura.',
 '["tema","categoria","tom"]'),
('artigo_plus','Artigo — Plus','article',
 'Escreva um artigo premium (plano Plus) sobre {{tema}}. Mais profundidade, plano de ação em etapas, sugestão de rotina e pergunta para o diário. Tom {{tom}}. Sem diagnóstico.',
 '["tema","tom"]'),
('pratica_guiada','Prática guiada','practice',
 'Crie uma prática guiada curta sobre {{tema}} para momentos de {{emocao}}. Passo a passo simples (5 a 7 passos), linguagem acolhedora, duração aproximada e frase final de encorajamento. Sem markdown pesado.',
 '["tema","emocao"]'),
('meditacao_texto','Meditação em texto','meditation',
 'Escreva uma meditação guiada em texto sobre {{tema}}, com respiração, ancoragem no corpo e acolhimento. Ritmo calmo, 200 a 350 palavras.',
 '["tema"]'),
('mini_desafio','Mini-desafio','challenge',
 'Crie um mini-desafio de {{dias}} dias sobre {{tema}}. Para cada dia: uma ação simples e possível. Tom leve, sem cobrança.',
 '["tema","dias"]'),
('trilha','Trilha','trail',
 'Monte uma trilha de autoconhecimento sobre {{tema}}: nome, descrição, objetivo, duração sugerida, 5 etapas (nome + descrição curta), exercício final e 1 pergunta para o diário.',
 '["tema"]'),
('seo','SEO','seo',
 'Gere metadados SEO para o artigo. Título: {{titulo}}. Trecho: {{conteudo}}. Retorne EXATO: META TITLE (máx 60), META DESCRIPTION (máx 155), SLUG (kebab-case), KEYWORDS (5), ALT IMAGE.',
 '["titulo","conteudo"]'),
('cta','CTA','cta',
 'Escreva 3 opções de CTA gentis para o final de um artigo sobre {{titulo}}, convidando a escrever no diário ou explorar mais conteúdo. Sem pressão.',
 '["titulo"]'),
('pergunta_diario','Pergunta para diário','diary_question',
 'Gere 3 perguntas reflexivas para o diário, relacionadas a {{titulo}}. Convidativas, sem julgamento.',
 '["titulo"]'),
('notificacao','Notificação','notification',
 'Escreva uma notificação in-app. Tipo: {{tipo}}. Contexto: {{contexto}}. Retorne: TÍTULO (máx 60), MENSAGEM (máx 120), CTA (máx 3 palavras).',
 '["tipo","contexto"]'),
('email_divulgacao','E-mail de divulgação','email',
 'Escreva um e-mail curto divulgando o conteúdo "{{titulo}}". Retorne ASSUNTO (máx 60) e CORPO (2 parágrafos + 1 CTA). Tom acolhedor, sem sensacionalismo.',
 '["titulo"]'),
('legenda_social','Legenda social','social',
 'Escreva uma legenda curta para redes sociais divulgando "{{titulo}}". 2 a 4 linhas, tom humano, 1 chamada gentil e 3 hashtags relevantes.',
 '["titulo"]'),
('atualizar_artigo','Atualizar artigo antigo','article',
 'Revise e atualize o artigo abaixo mantendo a intenção, melhorando clareza, atualidade e SEO. Sinalize o que mudou ao final. Conteúdo: {{conteudo}}.',
 '["conteudo"]'),
('reescrever','Reescrever (acolhedor)','rewrite',
 'Reescreva o texto abaixo com tom mais acolhedor e linguagem mais simples, sem mudar o significado. Texto: {{conteudo}}.',
 '["conteudo"]'),
('melhorar_texto','Melhorar texto','improve',
 'Melhore o texto abaixo (clareza, fluidez, acolhimento) mantendo o sentido. Texto: {{conteudo}}.',
 '["conteudo"]'),
('resumo_card','Resumo para card','summary',
 'Faça um resumo de 1 a 2 frases, direto e convidativo, para o card da listagem do artigo "{{titulo}}".',
 '["titulo"]'),
('pauta_editorial','Pauta editorial','pauta',
 'Sugira uma pauta editorial com {{quantidade}} ideias de conteúdo sobre {{temas}}, distribuídas entre os planos Gratuito/Essencial/Plus. Para cada: título, tipo, categoria, plano e ângulo emocional.',
 '["quantidade","temas"]'),
('pacote_mensal','Pacote mensal','pacote',
 'Monte um pacote mensal de {{quantidade}} conteúdos para {{mes}} sobre os temas {{temas}}, 1 por dia útil, distribuídos entre Gratuito/Essencial/Plus. Retorne uma lista com título, tipo, categoria, plano e data sugerida.',
 '["quantidade","mes","temas"]')
ON CONFLICT (template_key) DO NOTHING;
