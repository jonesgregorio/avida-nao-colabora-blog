import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('hardening final do Admin fixa search_path das funções apontadas pelo linter', () => {
  const sql = read('supabase/migrations/20260923170000_admin_safe_security_hardening.sql')
  for (const signature of [
    'set_user_history_items_updated_at()',
    'set_updated_at()',
    'content_versions_block_mutation()',
    'sync_admin_role()',
    'feature_flag_is_critical(text)',
    'feature_flag_bucket(text, uuid)',
  ]) {
    assert.match(sql, new RegExp(`alter function public\\.${signature.replace(/[()]/g, m => '\\\\' + m)} set search_path = public, pg_temp;`, 'i'))
  }
})

test('RPCs de RBAC administrativo deixam de ser executáveis por anon/PUBLIC', () => {
  const sql = read('supabase/migrations/20260923170000_admin_safe_security_hardening.sql')
  for (const signature of ['admin_my_role()', 'admin_my_permissions()', 'admin_can(text, text)']) {
    const escaped = signature.replace(/[()]/g, m => '\\' + m)
    assert.match(sql, new RegExp(`revoke all on function public\\.${escaped} from public, anon;`, 'i'))
  }
  assert.doesNotMatch(sql, /feature_flag_enabled.*revoke/i, 'flags públicas não devem ser quebradas pelo hardening do Admin')
  assert.doesNotMatch(sql, /get_active_feature_flags.*revoke/i, 'flags públicas não devem ser quebradas pelo hardening do Admin')
})
