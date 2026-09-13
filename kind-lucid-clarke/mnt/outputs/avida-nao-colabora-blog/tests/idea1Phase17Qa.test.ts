import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const profile = readFileSync(new URL('../src/components/Profile.tsx', import.meta.url), 'utf8')
const layout = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8')
const notifications = readFileSync(new URL('../src/components/NotificationsPage.tsx', import.meta.url), 'utf8')
const journeyE2e = readFileSync(new URL('./e2e/idea1-authenticated-journey.spec.mjs', import.meta.url), 'utf8')

test('Perfil mostra continuidade recente sem streak, chama ou pressão por sequência', () => {
  assert.match(profile, /activeDays30/)
  assert.match(profile, /dias com registro nos últimos 30 dias/)
  assert.match(profile, /CalendarDays/)
  assert.doesNotMatch(profile, /\bstreak\b/i)
  assert.doesNotMatch(profile, /dias seguidos/i)
  assert.doesNotMatch(profile, /<Flame\b/)
})

test('navegação mobile usa cinco intenções diretas sem drawer intermediário', () => {
  assert.match(layout, /const MOBILE_IDS = \['home', 'diary', 'descobertas', 'cuidar', 'mais'\]/)
  for (const label of ['Hoje', 'Registrar', 'Evolução', 'Cuidar', 'Conta']) {
    assert.match(layout, new RegExp(`label: '${label}'`))
  }
  assert.doesNotMatch(layout, /MobileMoreSheet|Mais recursos|aria-haspopup="dialog"/)
})

test('cabeçalho de Notificações empilha no mobile e preserva filtros estreitos', () => {
  assert.match(notifications, /mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4/)
  assert.match(notifications, /self-start sm:flex-shrink-0 inline-flex/)
  assert.match(notifications, /overflow-x-auto pb-1/)
})

test('CI autenticado cobre a jornada principal em desktop e mobile', () => {
  for (const route of [
    '/diario', '/descobertas', '/mapa-emocional', '/meu-relatorio', '/minha-historia',
    '/cuidar', '/mais', '/plano-de-autocuidado', '/conteudos', '/questionarios', '/guia-mensal',
    '/meu-plano', '/perfil', '/suporte', '/notificacoes',
  ]) assert.match(journeyE2e, new RegExp(route.replaceAll('/', '\\/')))

  assert.match(journeyE2e, /width: 390, height: 844/)
  assert.match(journeyE2e, /width: 320, height: 760/)
  assert.match(journeyE2e, /AxeBuilder/)
  assert.match(journeyE2e, /scrollWidth - window\.innerWidth/)
  for (const label of ['Hoje', 'Registrar', 'Evolução', 'Cuidar', 'Conta']) {
    assert.match(journeyE2e, new RegExp(`name: '${label}'`))
  }
  assert.doesNotMatch(journeyE2e, /Mais recursos|keyboard\.press\('Escape'\)/)
})
