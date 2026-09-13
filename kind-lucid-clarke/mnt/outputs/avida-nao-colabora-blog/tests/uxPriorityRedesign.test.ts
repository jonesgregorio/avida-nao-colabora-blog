import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const layout = read('src/components/user/UserLayout.tsx')
const today = read('src/components/TodayJourney.tsx')
const evolution = read('src/components/EvolutionContext.tsx')
const evolutionNav = read('src/components/EvolutionSectionNav.tsx')
const care = read('src/components/CuidarPage.tsx')
const account = read('src/components/MaisPage.tsx')
const articles = read('src/components/Articles.tsx')
const history = read('src/components/MyHistoryPage.tsx')
const navigation = read('src/lib/navigation.ts')

test('mobile apresenta Hoje, Registrar, Evolução, Cuidar e Conta', () => {
  assert.match(layout, /const MOBILE_IDS = \['home', 'diary', 'descobertas', 'cuidar', 'mais'\]/)
  for (const label of ['Hoje', 'Registrar', 'Evolução', 'Cuidar', 'Conta']) assert.match(layout, new RegExp(`label: '${label}'`))
  assert.doesNotMatch(layout, /Mais recursos/)
})

test('Evolução preserva rotas existentes e separa os quatro olhares', () => {
  assert.match(evolutionNav, /Descobertas/)
  assert.match(evolutionNav, /Mapa/)
  assert.match(evolutionNav, /Relatórios/)
  assert.match(evolutionNav, /História/)
  assert.match(evolution, /Perceber → visualizar → sintetizar → lembrar/)
  assert.match(navigation, /'\/evolucao': 'descobertas'/)
  assert.doesNotMatch(evolutionNav, /onNavigate\('evolution'\)/)
})

test('Hoje orienta o próximo passo sem duplicar cálculos emocionais', () => {
  assert.match(today, /Registrar/)
  assert.match(today, /Entender/)
  assert.match(today, /Cuidar/)
  assert.match(today, /onNavigate\('my-garden'\)/)
  assert.doesNotMatch(today, /supabase|generate|prompt|rpc\(/i)
})

test('Cuidar reúne plano, orientação, questionários e conteúdos e usa rota real da orientação', () => {
  for (const label of ['Plano de Autocuidado', 'Orientação mensal', 'Questionários', 'Conteúdos']) assert.match(care, new RegExp(label))
  assert.match(care, /'monthly-guidance'/)
  assert.doesNotMatch(care, /onNavigate\(guidanceAccess \? 'guidance'/)
})

test('Conta substitui a nomenclatura Mais e concentra itens de conta', () => {
  assert.match(account, />Conta</)
  for (const label of ['Perfil', 'Meu Plano', 'Notificações', 'Suporte']) assert.match(account, new RegExp(label))
  assert.doesNotMatch(account, /<h1[^>]*>Mais<\/h1>/)
})

test('Conteúdos separa Ler e Praticar sem alterar o catálogo automático', () => {
  assert.match(articles, /title="Ler"/)
  assert.match(articles, /title="Praticar"/)
  assert.match(articles, /fetchGuidedCatalog\(\)/)
  assert.match(articles, /has_steps/)
  assert.match(articles, /Iniciar prática/)
  assert.match(articles, /Ler conteúdo/)
})

test('Minha História mantém timeline vertical e diferencia marcos', () => {
  assert.match(history, /Sua trajetória em ordem cronológica/)
  assert.match(history, /border-l/)
  assert.match(history, /Marco pessoal/)
  assert.match(history, /Identificado automaticamente/)
  assert.match(history, /Resumo por ano/)
})
