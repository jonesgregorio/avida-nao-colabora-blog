import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/components/admin/AdminPersonalization.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('Personalização inicia em modo Padrão e mantém modo Avançado opcional', () => {
  assert.match(src, /type ViewMode = 'default' \| 'advanced'/)
  assert.match(src, /useState<ViewMode>\('default'\)/)
  assert.match(src, />Padrão<\/button>/)
  assert.match(src, /> Avançado<\/button>/)
  assert.match(src, /mode === 'advanced'/)
})

test('busca principal prioriza usuário por nome ou e-mail e oferece sugestões', () => {
  assert.match(src, /Buscar usuário por nome ou e-mail/)
  assert.match(src, /profiles\.filter\(profile =>/)
  assert.match(src, /profile\.full_name/)
  assert.match(src, /profile\.email/)
  assert.match(src, /suggestions\.map\(profile =>/)
})

test('filtros operacionais ficam consolidados no modo Avançado', () => {
  assert.match(src, /mode === 'advanced' &&/)
  for (const filter of ['filters.plan', 'filters.taskKey', 'filters.priority', 'filters.deadline']) {
    assert.match(src, new RegExp(filter.replace('.', '\\.')))
  }
  assert.match(src, /changeMode\('default'\)/)
  assert.match(src, /plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all'/)
})

test('revisão abre como painel lateral direito com fechamento explícito', () => {
  assert.match(src, /fixed inset-0 z-50 bg-black\/35 flex justify-end/)
  assert.match(src, /<aside role="dialog" aria-modal="true"/)
  assert.match(src, /h-full w-full max-w-2xl/)
  assert.match(src, /aria-label="Fechar painel de personalização"/)
})

test('Dados usados pela IA ficam legíveis e distinguem sinais estruturados de diagnóstico', () => {
  assert.match(src, />Dados usados pela IA<\/summary>/)
  for (const label of ['Período', 'Diário', 'Humor médio', 'Questionários', 'Marcadores emocionais', 'Contextos percebidos', 'Necessidades registradas', 'Ações de cuidado', 'Gatilhos reais']) {
    assert.ok(src.includes(label), `rótulo ausente: ${label}`)
  }
  assert.match(src, /sinais estruturados usados como base/)
  assert.match(src, /não autorizam diagnóstico/)
})

test('rascunhos mostram jornada Gerado → Editado → Enviado', () => {
  assert.match(src, /function DeliveryJourney/)
  assert.match(src, /label: 'Gerado'/)
  assert.match(src, /label: 'Editado'/)
  assert.match(src, /label: 'Enviado'/)
  assert.match(src, /<DeliveryJourney delivery=\{delivery\}/)
})

test('admin pode gerar imediatamente sem depender do worker periódico', () => {
  assert.match(src, /if \(phase === 'generate' && !delivery\) void generateContent\(\)/)
  assert.match(src, /não precisa aguardar o ciclo automático/)
  assert.match(src, /Tudo será salvo como/)
  assert.match(src, /Nada será enviado automaticamente/)
})
