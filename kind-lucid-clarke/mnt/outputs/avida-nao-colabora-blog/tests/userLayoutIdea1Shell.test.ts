import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e mantém a entrada principal como Hoje', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('a navegação principal segue a jornada da Ideia 1 (Fase 19R.1)', () => {
  for (const id of ['home', 'diary', 'descobertas', 'my-evolution', 'my-report', 'my-history', 'cuidar', 'mais']) {
    assert.match(source, new RegExp(`id: '${id}'`), `passo da jornada ausente da navegação: ${id}`)
  }

  assert.match(source, /label: 'Descobertas'/)
  assert.match(source, /label: 'Cuidar'/)
  assert.match(source, /label: 'Mais'/)

  // "Conteúdos Guiados" deixa de ocupar o mesmo nível da jornada — vira recurso de Cuidar.
  assert.doesNotMatch(source, /id: 'articles',\s+label: 'Conteúdos Guiados'/)
})

test('grupos da sidebar separam a jornada do cuidado e da conta', () => {
  for (const group of ['Sua jornada', 'Cuidado e conta']) {
    assert.match(source, new RegExp(`label: '${group}'`))
  }
})

test('nenhum destino existente foi removido — só reorganizado sob Cuidar/Mais', () => {
  for (const view of ['self-care', 'articles', 'questionarios', 'monthly-guidance', 'my-plan', 'profile', 'support', 'notifications']) {
    assert.match(source, new RegExp(`'${view}'`), `destino existente sumiu da navegação: ${view}`)
  }
})

test('Ideia 1 não ressuscita módulos legados nem gamificação', () => {
  assert.doesNotMatch(source, /label: 'Caixa de Cuidado'/)
  assert.doesNotMatch(source, /label: 'Trilhas'/)
  assert.doesNotMatch(source, /label: 'Meditações'/)
  assert.doesNotMatch(source, /label: 'Jornada'/)
})

test('mobile prioriza os quatro passos da jornada mais frequentes + Mais', () => {
  assert.match(source, /const MOBILE_PRIMARY_IDS = \['home', 'diary', 'descobertas', 'my-evolution'\]/)
  assert.match(source, /aria-label="Navegação principal"/)
  assert.match(source, />\s*Mais\s*<\/button>/)
  assert.match(source, /aria-label="Mais recursos"/)
  assert.match(source, /pb-24 lg:pb-0/)
})

test('shell continua usando exclusivamente os tokens visuais oficiais do projeto', () => {
  assert.match(source, /bg-paper/)
  assert.match(source, /bg-sand-50/)
  assert.match(source, /text-forest-900/)
  assert.match(source, /bg-mint/)
  assert.match(source, /border-line/)
})
