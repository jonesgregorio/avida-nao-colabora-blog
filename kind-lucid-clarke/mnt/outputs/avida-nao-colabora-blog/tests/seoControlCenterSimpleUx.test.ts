import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const wrapper = readFileSync(resolve(root, 'src/components/admin/AdminSEOCockpitWithSelfTest.tsx'), 'utf8')

test('SEO Control Center começa por resumo simples e deixa detalhes técnicos recolhidos', () => {
  assert.match(wrapper, /Resumo simples/)
  assert.match(wrapper, /Como está o SEO agora\?/)
  assert.match(wrapper, /O que precisa de ação/)
  assert.match(wrapper, /O que depende do Google/)
  assert.match(wrapper, /O que está bem/)
  assert.match(wrapper, /<details/)
  assert.match(wrapper, /Ver detalhes técnicos e ferramentas avançadas/)
})

test('fluxo principal apresenta sequência atualizar, analisar e corrigir', () => {
  assert.match(wrapper, /1\. Atualizar e analisar/)
  assert.match(wrapper, /2\. Corrigir/)
  assert.match(wrapper, /Correções automáticas/)
  assert.match(wrapper, /Aguardando Google/)
  assert.match(wrapper, /Erros críticos/)
})

test('correção em lote gera relatório explícito do que aconteceu', () => {
  assert.match(wrapper, /Relatório da correção/)
  assert.match(wrapper, /O que foi feito e o que ficou pendente/)
  assert.match(wrapper, /Corrigido/)
  assert.match(wrapper, /Não corrigido/)
  assert.match(wrapper, /Precisa de revisão/)
  assert.match(wrapper, /Nenhuma mudança necessária/)
  assert.match(wrapper, /Alterado:/)
  assert.match(wrapper, /Pendente:/)
})

test('corretor não declara sucesso sem mudança real e revalida depois', () => {
  assert.match(wrapper, /status: changed\.length \? 'fixed'/)
  assert.match(wrapper, /A alteração foi salva/)
  assert.match(wrapper, /smartFixArticle/)
  assert.match(wrapper, /submit_sitemap/)
  assert.match(wrapper, /await load\(true\)/)
  assert.match(wrapper, /O sistema só marca como corrigido quando uma alteração foi realmente salva/)
})
