import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DEFAULT_SUPPORT_CATEGORY,
  SUPPORT_CATEGORIES,
  isSupportCategory,
} from '../src/lib/supportCategories.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const supportPage = read('src/components/SupportPage.tsx')
const contactPage = read('src/components/ContactPage.tsx')
const endpoint = read('supabase/functions/submit-contact-ticket/index.ts')

const expected = [
  'Uso do site',
  'Problema técnico',
  'Conta e acesso',
  'Planos e assinatura',
  'Pagamento',
  'Privacidade e dados',
  'Sugestão de melhoria',
  'Outro',
]

test('Suporte possui uma taxonomia oficial curta e estável', () => {
  assert.deepEqual([...SUPPORT_CATEGORIES], expected)
  assert.equal(DEFAULT_SUPPORT_CATEGORY, 'Uso do site')
  assert.equal(isSupportCategory('Pagamento'), true)
  assert.equal(isSupportCategory('categoria inventada'), false)
})

test('Suporte e Contato consomem a mesma fonte de categorias', () => {
  for (const source of [supportPage, contactPage]) {
    assert.match(source, /from '..\/lib\/supportCategories'/)
    assert.match(source, /SUPPORT_CATEGORIES\.map/)
  }
  assert.match(supportPage, /category: form\.category/)
  assert.doesNotMatch(supportPage, /category: 'Suporte'/)
  assert.doesNotMatch(contactPage, /const CATEGORIES =/)
})

test('endpoint valida as mesmas categorias e mantém fallback para FAQ', () => {
  for (const category of expected) assert.match(endpoint, new RegExp(`'${category}'`))
  assert.match(endpoint, /requestedCategory && !SUPPORT_CATEGORIES\.has\(requestedCategory\)/)
  assert.match(endpoint, /requestedCategory \|\| DEFAULT_SUPPORT_CATEGORY/)
  assert.match(endpoint, /Categoria inválida\./)
})

test('prioridade Urgente oferecida no Suporte é aceita pelo servidor', () => {
  assert.match(supportPage, /option value="urgent">Urgente/)
  assert.match(endpoint, /new Set\(\['low', 'medium', 'high', 'urgent'\]\)/)
})
