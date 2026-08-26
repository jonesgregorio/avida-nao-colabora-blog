import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Sistema abre a visão amigável e mantém diagnóstico técnico como detalhe secundário', () => {
  const area = read('src/components/admin/AdminAreaSistema.tsx')
  const friendly = read('src/components/admin/AdminSystemHealthFriendly.tsx')

  assert.match(area, /import AdminSystemHealthFriendly/)
  assert.match(area, /tab === 'saude' && <AdminSystemHealthFriendly \/>/)
  assert.doesNotMatch(area, /tab === 'saude' && <AdminSystemHealth \/>/)

  assert.match(friendly, /Diagnóstico técnico e ferramentas de reparo/)
  assert.match(friendly, /technicalOpen && <div className="border-t border-line"><AdminSystemHealth \/><\/div>/)
})

test('Saúde do sistema usa linguagem de produto e categorias legíveis', () => {
  const src = read('src/components/admin/AdminSystemHealthFriendly.tsx')

  for (const label of [
    'Site e dados',
    'Recursos do produto',
    'Inteligência artificial',
    'Pagamentos',
    'Comunicação',
    'Automações',
    'Acesso e segurança',
  ]) {
    assert.match(src, new RegExp(label))
  }

  for (const status of ['Funcionando', 'Precisa de atenção', 'Com problema', 'Ainda não verificado', 'Verificando']) {
    assert.match(src, new RegExp(status))
  }
})

test('detalhes técnicos permanecem disponíveis sem dominar a leitura principal', () => {
  const src = read('src/components/admin/AdminSystemHealthFriendly.tsx')

  assert.match(src, /Detalhe técnico/)
  assert.match(src, /Nome técnico:/)
  assert.match(src, /Categoria técnica:/)
  assert.match(src, /Erro bruto:/)
  assert.match(src, /FRIENDLY_IMPACT/)
  assert.match(src, /Motivo detectado:/)
})
