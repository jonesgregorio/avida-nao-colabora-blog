import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e mantém a entrada principal como Hoje', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('desktop recupera o menu direto anterior e acrescenta Descobertas e Meu Jardim', () => {
  for (const id of ['home', 'diary', 'descobertas', 'my-evolution', 'my-report', 'my-history', 'my-garden', 'articles', 'questionarios', 'self-care', 'monthly-guidance', 'my-plan', 'profile', 'support']) {
    assert.match(source, new RegExp(`id: '${id}'`), `destino ausente da navegação desktop: ${id}`)
  }

  for (const group of ['Seu espaço', 'Entender', 'Cuidar', 'Conta']) {
    assert.match(source, new RegExp(`label: '${group}'`), `grupo desktop ausente: ${group}`)
  }

  assert.match(source, /\['descobertas', 'my-evolution', 'my-report', 'my-history', 'my-garden', 'articles', 'questionarios'\]/)
  assert.match(source, /groups=\{DESKTOP_NAV_GROUPS\}/)
})

test('Cuidar e Mais continuam disponíveis sem substituir os atalhos diretos do desktop', () => {
  assert.match(source, /id: 'cuidar'/)
  assert.match(source, /id: 'mais'/)
  assert.match(source, /const NAV_GROUPS/)
  assert.match(source, /groups=\{NAV_GROUPS\}/)
})

test('Ideia 1 não ressuscita módulos legados nem gamificação', () => {
  assert.doesNotMatch(source, /label: 'Caixa de Cuidado'/)
  assert.doesNotMatch(source, /label: 'Trilhas'/)
  assert.doesNotMatch(source, /label: 'Meditações'/)
  assert.doesNotMatch(source, /label: 'Jornada'/)
})

test('mobile mantém Hoje, Diário, Descobertas, Mapa + Mais', () => {
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
