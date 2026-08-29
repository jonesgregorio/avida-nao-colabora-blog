import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e renomeia a entrada principal para Hoje', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('sidebar da Ideia 1 organiza recursos existentes sem ressuscitar módulos legados', () => {
  for (const group of ['Seu espaço', 'Entender', 'Cuidar', 'Conta']) {
    assert.match(source, new RegExp(`label: '${group}'`))
  }

  for (const id of [
    'home', 'diary', 'my-evolution', 'my-report', 'articles', 'questionarios',
    'self-care', 'monthly-guidance', 'my-plan', 'profile', 'support',
  ]) {
    assert.match(source, new RegExp(`id: '${id}'`), `destino existente ausente da navegação: ${id}`)
  }

  assert.doesNotMatch(source, /label: 'Caixa de Cuidado'/)
  assert.doesNotMatch(source, /label: 'Trilhas'/)
  assert.doesNotMatch(source, /label: 'Meditações'/)
})

test('mobile possui barra inferior persistente e Mais abre os recursos secundários', () => {
  assert.match(source, /const MOBILE_PRIMARY_IDS = \['home', 'diary', 'my-evolution', 'articles'\]/)
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
