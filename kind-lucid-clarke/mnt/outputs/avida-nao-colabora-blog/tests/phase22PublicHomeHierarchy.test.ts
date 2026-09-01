import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hero = readFileSync(new URL('../src/components/Hero.tsx', import.meta.url), 'utf8')
const content = readFileSync(new URL('../src/components/HomeContent.tsx', import.meta.url), 'utf8')

test('22.9 usa a narrativa pública aprovada no Hero', () => {
  assert.match(hero, /A vida nem sempre colabora/)
  assert.match(hero, /Você não precisa organizar tudo sozinho/)
  assert.match(hero, /Escreva como foi seu dia/)
  assert.match(hero, /Começar gratuitamente/)
  assert.match(hero, /Privado · sem julgamentos · no seu ritmo/)
})

test('Hero público mantém uma decisão principal e deixa de funcionar como dashboard', () => {
  assert.match(hero, /data-cta="hero-comecar-gratis"/)
  assert.doesNotMatch(hero, /Como você está hoje\?|Recursos Plus|Três caminhos para o seu cuidado diário/)
  assert.doesNotMatch(hero, /MOODS|PLUS_ITEMS|PATHS|selectedMood/)
})

test('Home explica a experiência antes dos planos na ordem registrar perceber entender cuidar', () => {
  const register = content.indexOf('Você registra')
  const perceive = content.indexOf('O sistema percebe')
  const understand = content.indexOf('Você entende')
  const care = content.indexOf('Você cuida')
  const plans = content.indexOf('Comece gratuitamente. Aprofunde quando fizer sentido.')
  assert.ok(register >= 0)
  assert.ok(perceive > register)
  assert.ok(understand > perceive)
  assert.ok(care > understand)
  assert.ok(plans > care)
})

test('preços continuam vindo da fonte canônica e detalhes completos permanecem em Planos', () => {
  assert.match(content, /from '\.\.\/lib\/planPricing'/)
  assert.match(content, /usePlanPricing\(\)/)
  assert.match(content, /onNavigate\('pricing'\)/)
  assert.match(content, /Comparar todos os planos/)
})

test('Home pública preserva privacidade e limite de escopo do produto', () => {
  assert.match(content, /Privacidade em primeiro lugar/)
  assert.match(content, /Apoio, não diagnóstico/)
  assert.match(content, /Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência/)
})
