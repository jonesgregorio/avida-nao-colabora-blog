import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e mantém Hoje como ponto de partida', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('desktop consolida a arquitetura em jornada, evolução, cuidado e conta', () => {
  for (const label of ['Hoje', 'Registrar', 'Evolução', 'Meu Jardim', 'Conteúdos', 'Cuidar', 'Perfil', 'Meu Plano', 'Suporte']) {
    assert.match(source, new RegExp(`label: '${label}'`), `destino ausente: ${label}`)
  }
  assert.match(source, /const EVOLUTION_VIEWS = \['descobertas', 'my-evolution', 'my-report', 'my-history'\]/)
  assert.match(source, /label: 'Sua jornada'/)
  assert.match(source, /label: 'Conta'/)
  assert.match(source, /groups=\{DESKTOP_NAV_GROUPS\}/)
})

test('Evolução possui navegação contextual própria sem fundir funcionalidades', () => {
  for (const id of ['descobertas', 'my-evolution', 'my-report', 'my-history']) {
    assert.match(source, new RegExp(`id: '${id}'`))
  }
  assert.match(source, /const EVOLUTION_TABS/)
  assert.match(source, /Padrões e conexões percebidos/)
  assert.match(source, /Veja como seus sinais mudam/)
  assert.match(source, /Fechamentos semanais e mensais/)
  assert.match(source, /Sua trajetória emocional/)
})

test('mobile usa Hoje, Registrar, Evolução, Cuidar e Menu explícito', () => {
  assert.match(source, /const MOBILE_MAIN/)
  assert.match(source, /aria-label="Navegação principal"/)
  assert.match(source, />Menu\s*<\/button>/)
  assert.match(source, /Recursos e conta/)
  assert.match(source, /Conta e suporte/)
  assert.doesNotMatch(source, />Mais\s*<\/button>/)
  assert.match(source, /pb-24 lg:pb-0/)
})

test('menu mobile mantém Jardim e Conteúdos acessíveis sem alterar o Jardim', () => {
  assert.match(source, /id: 'my-garden', label: 'Meu Jardim'/)
  assert.match(source, /id: 'articles', label: 'Conteúdos'/)
  assert.match(source, /id: 'questionarios', label: 'Questionários'/)
})

test('shell continua usando exclusivamente os tokens visuais oficiais do projeto', () => {
  assert.match(source, /bg-paper/)
  assert.match(source, /bg-sand-50/)
  assert.match(source, /text-forest-900/)
  assert.match(source, /bg-mint/)
  assert.match(source, /border-line/)
})
