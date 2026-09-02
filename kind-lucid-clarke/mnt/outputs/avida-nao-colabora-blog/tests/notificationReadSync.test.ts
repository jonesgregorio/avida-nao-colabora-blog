import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/NotificationsPage.tsx', import.meta.url), 'utf8')

test('clique individual persiste leitura antes de navegar', () => {
  const start = source.indexOf('async function openNotif')
  const end = source.indexOf('async function markAll')
  const block = source.slice(start, end)

  assert.match(block, /const \{ error \} = await supabase/)
  assert.match(block, /\.update\(\{ is_read: true, read_at: new Date\(\)\.toISOString\(\) \}\)/)
  assert.match(block, /\.eq\('id', n\.id\)/)
  assert.match(block, /\.eq\('user_id', n\.user_id\)/)
  assert.ok(block.indexOf('await supabase') < block.indexOf("navigate('article'"))
  assert.match(block, /setItems\(prev => prev\.map\(x => \(x\.id === n\.id \? \{ \.\.\.x, is_read: true \} : x\)\)\)/)
  assert.match(block, /if \(error\)[\s\S]*is_read: false/)
})
