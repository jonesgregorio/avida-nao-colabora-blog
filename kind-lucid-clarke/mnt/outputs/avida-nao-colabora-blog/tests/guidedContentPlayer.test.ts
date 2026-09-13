import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260913000000_guided_content_player.sql')
const lib = read('src/lib/guidedContentPlayer.ts')
const player = read('src/components/GuidedContentPlayer.tsx')
const articleView = read('src/components/ArticleView.tsx')
const editor = read('src/components/admin/AdminArticleEditor.tsx')

// Contrato: Conteúdos Guiados ganham um player por etapas (objetivo, intensidade, etapas,
// iniciar/pausar/retomar/concluir, reflexão final, próximo conteúdo) — mas um artigo sem etapas
// cadastradas continua sendo lido exatamente como hoje. Estritamente aditivo: nenhuma coluna
// existente é alterada, nenhuma tabela antiga é tocada.

test('migration é estritamente aditiva: só ADD COLUMN IF NOT EXISTS e CREATE TABLE IF NOT EXISTS novas', () => {
  assert.doesNotMatch(migration, /DROP TABLE|ALTER TABLE public\.articles (DROP COLUMN|ALTER COLUMN)/)
  assert.match(migration, /ALTER TABLE public\.articles ADD COLUMN IF NOT EXISTS objective TEXT/)
  assert.match(migration, /ALTER TABLE public\.articles ADD COLUMN IF NOT EXISTS intensity TEXT/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.guided_content_steps/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.guided_content_progress/)
})

test('leitura de etapas usa a MESMA regra de plano do corpo do artigo (current_user_has_plan), nunca mais permissiva', () => {
  assert.match(migration, /CREATE POLICY "guided_steps_read" ON public\.guided_content_steps/)
  assert.match(migration, /public\.current_user_has_plan\(COALESCE\(a\.plan_required, 'free'\)\)/)
  assert.match(migration, /a\.status = 'published' OR \(a\.status = 'scheduled'/)
})

test('progresso é sempre do próprio usuário — RLS restringe a auth.uid() = user_id, admin só lê', () => {
  assert.match(migration, /CREATE POLICY "guided_progress_own" ON public\.guided_content_progress[\s\S]{0,80}USING \(auth\.uid\(\) = user_id\)/)
  assert.match(migration, /CREATE POLICY "guided_progress_admin_read" ON public\.guided_content_progress[\s\S]{0,60}FOR SELECT/)
})

test('get_guided_catalog() continua sem expor o corpo das etapas — só sinaliza has_steps', () => {
  assert.match(migration, /has_steps BOOLEAN/)
  assert.match(migration, /EXISTS \(SELECT 1 FROM public\.guided_content_steps s WHERE s\.article_id = a\.id\)/)
  assert.doesNotMatch(migration, /guided_content_steps\.instruction/)
})

test('lib do player cobre iniciar, avançar, pausar, retomar e concluir com reflexão', () => {
  assert.match(lib, /export async function startGuidedContent/)
  assert.match(lib, /export async function advanceGuidedStep/)
  assert.match(lib, /export async function pauseGuidedContent/)
  assert.match(lib, /export async function resumeGuidedContent/)
  assert.match(lib, /export async function completeGuidedContent/)
  assert.match(lib, /onConflict: 'user_id,article_id'/)
})

test('componente do player não renderiza nada quando o conteúdo não tem etapas (artigo comum intocado)', () => {
  assert.match(player, /if \(loading \|\| steps\.length === 0\) return null/)
})

test('ArticleView renderiza o player sempre, mas ele é um no-op pra artigos sem etapas — leitura comum não muda', () => {
  assert.match(articleView, /<GuidedContentPlayer article={article} user={user} plan={profile\?\.plan \?\? 'free'} onOpenArticle={onSelectArticle} \/>/)
  assert.match(articleView, /objective,intensity/)
})

test('admin cadastra etapas e salva best-effort (não quebra o salvamento do artigo se a migration ainda não aplicou)', () => {
  assert.match(editor, /interface StepDraft/)
  assert.match(editor, /function addStep\(\) \{ setSteps/)
  assert.match(editor, /supabase\.from\('guided_content_steps'\)\.delete\(\)\.eq\('article_id', savedId\)/)
  assert.match(editor, /catch \{ \/\* guided_content_steps ainda não migrada \*\/ \}/)
})
