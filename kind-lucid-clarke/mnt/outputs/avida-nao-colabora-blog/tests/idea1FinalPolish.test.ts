import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

test('19R.C permite restaurar descobertas ocultas pela própria interface', () => {
  const page = source('../src/components/DescobertasPage.tsx')
  assert.match(page, /Ocultas/)
  assert.match(page, /Descobertas ocultas/)
  assert.match(page, /Voltar a acompanhar/)
  assert.match(page, /hiddenDiscoveries/)
  assert.match(page, /onRestore=\{key => choose\(key, 'not_following'\)\}/)
})

test('19R.C deixa Cuidar com três caminhos reais de cuidado', () => {
  const page = source('../src/components/CuidarPage.tsx')
  assert.match(page, /Conteúdos Guiados/)
  assert.match(page, /Plano de Autocuidado/)
  assert.match(page, /Orientação mensal/)
  assert.match(page, /guidanceAccess/)
  assert.doesNotMatch(page, /Caixa de Cuidado/)
})

test('19R.C unifica o ticket do usuário com os tokens visuais atuais', () => {
  const detail = source('../src/components/SupportTicketDetail.tsx')
  const picker = source('../src/components/support/SupportAttachmentPicker.tsx')
  const list = source('../src/components/support/SupportAttachmentList.tsx')

  for (const file of [detail, picker, list]) {
    assert.doesNotMatch(file, /stone-/)
    assert.doesNotMatch(file, /emerald-/)
  }
  assert.match(detail, /bg-forest-900 text-white/)
  assert.match(detail, /bg-paper-soft/)
  assert.match(detail, /border-line/)
})
