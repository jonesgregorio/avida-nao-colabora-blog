import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, '..', p), 'utf8')

const ref = read('src/components/admin/AdminInfraReference.tsx')
const sistema = read('src/components/admin/AdminAreaSistema.tsx')

test('a referência cobre as configs que ficam fora do painel', () => {
  for (const topic of ['Autenticação', 'Supabase Auth', 'Chaves de API', 'schema, RLS e migrations', 'pg_cron', 'Domínio e DNS', 'Hospedagem', 'reembolsos']) {
    assert.ok(ref.includes(topic), `faltou o tópico: ${topic}`)
  }
  // deixa claro que schema/RLS é só código + PR
  assert.match(ref, /Só por código \+ PR/)
  assert.match(ref, /nunca executa DDL pelo navegador/i)
  // não é uma tela que muda nada — só links
  assert.doesNotMatch(ref, /supabase\.rpc|functions\.invoke|\.update\(|\.insert\(/)
})

test('a aba está registrada na área Sistema', () => {
  assert.match(sistema, /import AdminInfraReference/)
  assert.match(sistema, /id: 'infra'/)
  assert.match(sistema, /tab === 'infra' && <AdminInfraReference \/>/)
})
