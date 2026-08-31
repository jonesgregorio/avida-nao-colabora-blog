import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const estudio = read('../src/components/admin/AdminEstudio.tsx')
const index = read('../src/components/admin/index.tsx')
const layout = read('../src/components/admin/AdminLayout.tsx')
const types = read('../src/components/admin/types.ts')

test('a área "estudio" está registrada nos quatro pontos obrigatórios', () => {
  // 1. tipo
  assert.match(types, /\|\s*'estudio'/)
  // 2. lista de áreas que realmente abrem
  assert.match(index, /'conteudos',\s*'estudio',\s*'analytics'/)
  // 3. import lazy + case no switch
  assert.match(index, /const AdminEstudio = lazy\(\(\) => import\('\.\/AdminEstudio'\)\)/)
  assert.match(index, /case 'estudio': return <AdminEstudio \/>/)
  // 4. item no menu lateral
  assert.match(layout, /id: 'estudio', label: 'Estúdio de Conteúdo'/)
})

test('o Estúdio traz as sete abas do mockup', () => {
  for (const id of ['novo', 'calendario', 'grade', 'destaques', 'inspiracao', 'comunidade', 'desempenho']) {
    assert.match(estudio, new RegExp(`id: '${id}'`))
  }
})

test('o assistente "Nova publicação" tem os cinco passos e rascunho local', () => {
  assert.match(estudio, /const STEPS = \['Ideia', 'Visual', 'Formatos', 'Textos', 'Pacote'\]/)
  assert.match(estudio, /localStorage\.setItem\(DRAFT_KEY/)
  assert.match(estudio, /localStorage\.setItem\(TAB_KEY/)
})

test('formatos declaram a dimensão exata do Instagram', () => {
  assert.match(estudio, /1080 × 1350 · 4:5/)
  assert.match(estudio, /1080 × 1920 · 9:16/)
  assert.match(estudio, /até 20 slides/)
})

test('usa a marca oficial (LogoIcon), não emoji de folha', () => {
  assert.match(estudio, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.doesNotMatch(estudio, /🌿/)
})

test('deixa explícito o que fica fora de escopo nesta fase', () => {
  assert.match(estudio, /nunca vem do Diário/)
  assert.match(estudio, /fora de escopo/)
  assert.match(estudio, /API do Instagram/)
})
