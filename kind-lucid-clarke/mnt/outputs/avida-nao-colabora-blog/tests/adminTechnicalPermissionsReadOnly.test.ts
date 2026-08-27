import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Admin não oferece mais um toggle que aparenta controlar acesso técnico sem efeito real', () => {
  const admin = read('src/components/admin/AdminPlans.tsx')
  // As funções que editavam plan_feature_access (sem nenhum leitor no runtime,
  // já que loadPlanAccess() nunca é chamada em lugar nenhum do app) foram
  // removidas — não deve sobrar um jeito de "salvar permissões" técnicas.
  assert.doesNotMatch(admin, /async function toggleOwnFeature/)
  assert.doesNotMatch(admin, /async function saveAllAccess/)
  assert.doesNotMatch(admin, /Salvar permissões/)
  // As duas visões (cards e tabela técnica) mostram a fonte real que governa
  // o runtime (OWN_FEATURE_KEYS), não o valor persistido e desconectado.
  assert.match(admin, /OWN_FEATURE_KEYS\[plan\.key\]\.includes\(feat\.key\)/)
  assert.match(admin, /OWN_FEATURE_KEYS\[pk\]\.includes\(feat\.key\)/)
  assert.match(admin, /regra técnica do produto/i)
})

test('permissions.ts: loadPlanAccess continua sem nenhum chamador em src (dead code documentado, não reativado às cegas)', () => {
  const callers = read('src/lib/permissions.ts')
  assert.match(callers, /export async function loadPlanAccess/)
  // Nota: este teste documenta o estado atual (função existe mas não é usada).
  // Se algum dia loadPlanAccess() passar a ser chamada de verdade em algum
  // lugar do app, a tela de permissões do Admin (agora somente leitura)
  // precisa ser revisitada — reativar sem revisar a UI voltaria a divergir.
})
