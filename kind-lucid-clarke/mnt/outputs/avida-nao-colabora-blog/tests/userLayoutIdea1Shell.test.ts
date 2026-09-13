import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e mantém Hoje como ponto de partida', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('desktop consolida a arquitetura e resume Conta em um único destino', () => {
  for (const label of ['Hoje', 'Registrar', 'Evolução', 'Meu Jardim', 'Conteúdos', 'Cuidar']) {
    assert.match(source, new RegExp(`label: '${label}'`), `destino ausente: ${label}`)
  }
  assert.match(source, /const ACCOUNT_NAV: NavItem\[] = \[\s*\{ id: 'my-plan', label: 'Conta'/)
  assert.match(source, /description: 'Meu Plano e Suporte'/)
  assert.doesNotMatch(source, /const ACCOUNT_NAV:[\s\S]*?label: 'Perfil'/)
  assert.match(source, /const EVOLUTION_VIEWS = \['descobertas', 'my-evolution', 'my-report', 'my-history'\]/)
  assert.match(source, /label: 'Sua jornada'/)
  assert.match(source, /groups=\{DESKTOP_NAV_GROUPS\}/)
})

test('Evolução possui navegação contextual própria e nomes completos', () => {
  for (const id of ['descobertas', 'my-evolution', 'my-report', 'my-history']) {
    assert.match(source, new RegExp(`id: '${id}'`))
  }
  assert.match(source, /const EVOLUTION_TABS/)
  assert.match(source, /label: 'Minha História'/)
  assert.match(source, /title: 'Descobertas'/)
  assert.match(source, /title: 'Mapa Emocional'/)
  assert.match(source, /title: 'Relatórios'/)
  assert.match(source, /title: 'Minha História'/)
})

test('Cuidar identifica Plano de Autocuidado e explica seu ciclo', () => {
  assert.match(source, /label: 'Plano de Autocuidado'/)
  assert.match(source, /title: 'Plano de Autocuidado'/)
  assert.match(source, /Como o plano funciona/)
  assert.match(source, /Foco do ciclo/)
  assert.match(source, /Escolha ações/)
  assert.match(source, /Adapte sem culpa/)
  assert.match(source, /Dê retorno/)
})

test('mobile usa Hoje, Registrar, Evolução, Cuidar e Menu explícito', () => {
  assert.match(source, /const MOBILE_MAIN/)
  assert.match(source, /aria-label="Navegação principal"/)
  assert.match(source, />Menu\s*<\/button>/)
  assert.match(source, /Recursos e conta/)
  assert.match(source, /label: 'Conta'/)
  assert.match(source, /Seu perfil fica na sua foto no topo/)
  assert.doesNotMatch(source, />Mais\s*<\/button>/)
  assert.match(source, /pb-24 lg:pb-0/)
})

test('menu mobile mantém recursos e retira Perfil da grade de Conta', () => {
  assert.match(source, /id: 'my-garden', label: 'Meu Jardim'/)
  assert.match(source, /id: 'articles', label: 'Conteúdos'/)
  assert.match(source, /id: 'questionarios', label: 'Questionários'/)
  const mobileGroups = source.match(/const MOBILE_MENU_GROUPS:[\s\S]*?const DESKTOP_NAV_GROUPS/)?.[0] || ''
  assert.match(mobileGroups, /id: 'my-plan', label: 'Meu Plano'/)
  assert.match(mobileGroups, /id: 'support', label: 'Suporte'/)
  assert.doesNotMatch(mobileGroups, /id: 'profile'/)
})

test('shell continua usando exclusivamente os tokens visuais oficiais do projeto', () => {
  assert.match(source, /bg-paper/)
  assert.match(source, /bg-sand-50/)
  assert.match(source, /text-forest-900/)
  assert.match(source, /bg-mint/)
  assert.match(source, /border-line/)
})
