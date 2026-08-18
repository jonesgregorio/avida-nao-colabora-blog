import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const readOuter = (path: string) => readFileSync(resolve(root, '../../../..', path), 'utf8')

test('Admin não ensina mais service_role_key manual para automações', () => {
  const admin = read('src/components/admin/AdminAutomacoesBlog.tsx')
  assert.doesNotMatch(admin, /vault\.create_secret/i)
  assert.match(admin, /automation_token/i)
})

test('README oficial documenta apenas Gratuito, Essencial e Plus como planos atuais', () => {
  const readme = read('README.md')
  assert.match(readme, /Gratuito/)
  assert.match(readme, /Essencial/)
  assert.match(readme, /Plus/)
  assert.doesNotMatch(readme, /4 planos/i)
  assert.match(readme, /Registrar.*Visualizar.*Entender.*Planejar.*Receber apoio/s)
})

test('Saúde do sistema consulta automações emocional e editorial', () => {
  const health = read('src/lib/systemHealth.ts')
  assert.match(health, /get_emotional_automation_health/)
  assert.match(health, /get_editorial_automation_health/)
})

test('CI valida dependências de produção, testes, TypeScript, Deno, lint e build', () => {
  const ci = readOuter('.github/workflows/ci.yml')
  assert.match(ci, /npm audit --omit=dev --audit-level=high/)
  assert.match(ci, /npm test/)
  assert.match(ci, /npm run typecheck/)
  assert.match(ci, /deno check/)
  assert.match(ci, /npm run lint/)
  assert.match(ci, /npm run build/)
})

test('fluxo colaborativo exige branch, PR e CI na documentação do repositório', () => {
  const contributing = readOuter('CONTRIBUTING.md')
  assert.match(contributing, /branch/i)
  assert.match(contributing, /Pull Request|PR/i)
  assert.match(contributing, /CI/i)
  assert.match(contributing, /main/i)
})
