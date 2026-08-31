import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/hooks/useAuth.ts', import.meta.url), 'utf8')

test('bootstrap de profile tolera ausência/concorrência sem gerar 406 por single()', () => {
  assert.match(source, /\.from\('profiles'\)[\s\S]*?\.maybeSingle\(\)/)
  assert.doesNotMatch(source, /\.from\('profiles'\)[\s\S]{0,220}?\.single\(\)/)
  assert.match(source, /ignoreDuplicates:\s*true/)
  assert.match(source, /const \{ data: resolvedProfile, error: refetchError \} = await readProfile\(\)/)
})

test('falha de leitura de profile não dispara criação automática', () => {
  const errorGuard = source.indexOf('if (error)')
  const upsert = source.indexOf(".upsert(")
  assert.ok(errorGuard >= 0, 'deve existir guarda explícita para erro de leitura')
  assert.ok(upsert > errorGuard, 'o upsert só pode ocorrer depois da guarda de erro')
  assert.match(source.slice(errorGuard, upsert), /setProfile\(null\)/)
  assert.match(source.slice(errorGuard, upsert), /return/)
})
