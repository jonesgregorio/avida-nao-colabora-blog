import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260907160000_admin_user_360.sql')
const server = read('src/components/admin/adminUsersServer.ts')
const tabs = read('src/components/admin/AdminUser360Tabs.tsx')
const impl = read('src/components/admin/AdminUsersImpl.tsx')
const model = read('src/components/admin/adminUsersModel.ts')

test('RPC admin_user_360 é admin-only, SECURITY DEFINER e não exposta a anon', () => {
  assert.match(migration, /create or replace function public\.admin_user_360\(target_user_id uuid\)/i)
  assert.match(migration, /security definer/i)
  assert.match(migration, /if not public\.is_admin\(\) then/i)
  assert.match(migration, /revoke all on function public\.admin_user_360\(uuid\) from public, anon/i)
  assert.match(migration, /grant execute on function public\.admin_user_360\(uuid\) to authenticated/i)
})

test('a RPC agrega dados mas NÃO devolve texto livre de diário / conteúdo privado', () => {
  // Só conta/agrega — nada de colunas de texto livre.
  assert.doesNotMatch(migration, /\b(d\.text|de\.text|free_note|content_html|answers|recurring_thoughts|ai_summary\b)/i)
  // As seções esperadas estão presentes.
  for (const section of ['header', 'diary', 'checkins', 'mapa', 'questionnaires', 'care_plans', 'content', 'reports', 'guidance', 'subscription', 'history']) {
    assert.match(migration, new RegExp(`'${section}'`), `seção ${section} ausente na RPC`)
  }
})

test('loadUser360 degrada só quando a RPC não existe, e propaga erro real', () => {
  assert.match(server, /export async function loadUser360/)
  assert.match(server, /supabase\.rpc\('admin_user_360', \{ target_user_id: userId \}\)/)
  // "não publicada" só para PGRST202 / função ausente — não para erro de coluna.
  assert.match(server, /code === 'PGRST202'|could not find the function\|schema cache/i)
  assert.doesNotMatch(server, /\|does not exist\|schema cache/)
})

test('a Ficha 360º entra na gaveta sem duplicar componente nem quebrar as abas existentes', () => {
  assert.match(model, /export interface User360/)
  assert.match(model, /export const is360Tab/)
  assert.match(impl, /import AdminUser360Tabs from '\.\/AdminUser360Tabs'/)
  assert.match(impl, /is360Tab\(drawerTab\) \?/)
  assert.match(impl, /loadUser360\(u\.user_id\)/)
  // Cabeçalho com pendências.
  assert.match(impl, /Pagamento pendente/)
  assert.match(impl, /Cancelamento agendado/)
})

test('as abas 360 são somente-leitura e avisam o admin que o texto do diário não é exibido', () => {
  assert.match(tabs, /o texto livre do diário nunca é exibido no Admin/i)
  // Não faz mutações (nada de insert/update/delete/rpc de escrita).
  assert.doesNotMatch(tabs, /\.(insert|update|delete)\(|supabase\.rpc/)
})

const moodFix = read('supabase/migrations/20260907300000_fix_admin_user_360_mood.sql')

test('hotfix: avg_mood_90d usa mood_score (int 1-5), não mood (texto)', () => {
  assert.match(moodFix, /create or replace function public\.admin_user_360\(target_user_id uuid\)/i)
  assert.match(moodFix, /select round\(avg\(mood_score\)::numeric, 2\) from public\.diary_entries/i)
  assert.match(moodFix, /where user_id = target_user_id and mood_score is not null/i)
  assert.doesNotMatch(moodFix, /avg\(mood\)::numeric/)
  assert.match(moodFix, /grant execute on function public\.admin_user_360\(uuid\) to authenticated/i)
})

test('erro real da Ficha 360 aparece para o admin, não vira "aguardando deploy"', () => {
  assert.match(impl, /setUser360Error/)
  assert.match(impl, /<AdminUser360Tabs tab=\{drawerTab\} data=\{user360\} loading=\{loading360\} error=\{user360Error\}/)
  assert.match(tabs, /if \(error\)/)
  assert.match(tabs, /Não foi possível carregar o retrato do usuário/)
  assert.match(tabs, /AAL2|verificação em duas etapas/i)
  assert.doesNotMatch(tabs, /após o deploy desta etapa/)
})
