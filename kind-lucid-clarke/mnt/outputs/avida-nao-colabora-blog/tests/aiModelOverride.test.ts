import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8')

const migration = read('supabase/migrations/20260903130000_ai_model_override.sql')
const shared = read('supabase/functions/_shared/aiModels.ts')
const status = read('supabase/functions/admin-config-status/index.ts')
const genContent = read('supabase/functions/generate-content/index.ts')
const config = read('src/components/admin/AdminAIConfig.tsx')
const usage = read('src/components/admin/AdminAIUsage.tsx')

test('migration adiciona override de modelo e RPC protegida', () => {
  assert.match(migration, /alter table public\.ai_settings add column if not exists gemini_model text/i)
  assert.match(migration, /alter table public\.ai_settings add column if not exists groq_model text/i)
  assert.match(migration, /create or replace function public\.admin_set_ai_models\(p_gemini text, p_groq text\)/i)
  assert.match(migration, /if not public\.is_admin\(\) then\s*raise exception/i)
  // não deixa reativar modelo aposentado
  assert.match(migration, /gemini-2\.5-flash/)
  assert.match(migration, /aposentado/i)
  assert.match(migration, /grant execute on function public\.admin_set_ai_models\(text, text\) to authenticated/i)
})

test('resolveAiModels: banco > secret > default, e bloqueia modelo legado', () => {
  assert.match(shared, /export async function resolveAiModels\(\): Promise<AiModels>/)
  assert.match(shared, /\.from\('ai_settings'\)\s*\.select\('gemini_model, groq_model'\)/)
  assert.match(shared, /LEGACY_GEMINI\.has\(gemini\)\)?\s*\{ gemini = DEFAULT_GEMINI_MODEL/)
  assert.match(shared, /export const DEFAULT_GEMINI_MODEL = 'gemini-3\.6-flash'/)
})

test('as funções de IA passam a respeitar o override', () => {
  assert.match(genContent, /\.select\('gemini_model, groq_model'\)/)
  assert.match(genContent, /GEMINI_MODEL = normalizeGeminiModel\(models\.gemini_model\)/)
  for (const f of [
    'supabase/functions/diary-companion/index.ts',
    'supabase/functions/explain-emotional-map/index.ts',
    'supabase/functions/run-automations/index.ts',
    'supabase/functions/run-emotional-automations/runner.ts',
  ]) {
    assert.match(read(f), /import \{ resolveAiModels \} from '\.\.\/_shared\/aiModels\.ts'/, f)
    assert.match(read(f), /resolveAiModels\(\)/, f)
  }
})

test('admin-config-status é admin-AAL2 e devolve booleano, nunca o valor', () => {
  assert.match(status, /requireAdminAal2\(req\)/)
  assert.match(status, /secrets\[k\] = !!\(Deno\.env\.get\(k\) \|\| ''\)\.trim\(\)/)
  assert.doesNotMatch(status, /value:\s*Deno\.env\.get/)
  assert.match(status, /'OPENAI_API_KEY'/)
  assert.match(status, /'TURNSTILE_SECRET_KEY'/)
})

test('o painel do Admin edita o modelo e mostra o status das chaves', () => {
  assert.match(config, /supabase\.functions\.invoke\('admin-config-status'\)/)
  assert.match(config, /supabase\.rpc\('admin_set_ai_models'/)
  assert.match(config, /nunca aparece aqui/i)
  assert.match(usage, /import AdminAIConfig/)
  assert.match(usage, /<AdminAIConfig \/>/)
})
