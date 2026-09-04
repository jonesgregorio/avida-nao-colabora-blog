import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const hero = readFileSync(new URL('../src/components/Hero.tsx', import.meta.url), 'utf8')
const content = readFileSync(new URL('../src/components/HomeContent.tsx', import.meta.url), 'utf8')
const header = readFileSync(new URL('../src/components/Header.tsx', import.meta.url), 'utf8')

test('22.9 usa a narrativa pública do mockup aprovado no Hero', () => {
  assert.match(hero, /Pequenos registros\. Grandes percepções/)
  assert.match(hero, /Entender o que você sente pode começar com um registro por dia/)
  assert.match(hero, /perceber padrões e transformar o que você vive em possibilidades de cuidado/)
  assert.match(hero, /Criar minha conta gratuita/)
  assert.match(hero, /Conhecer como funciona/)
  assert.match(hero, /Gratuito para começar/)
  assert.match(hero, /Seguro e privado/)
  assert.match(hero, /Sem julgamentos/)
})

test('Hero público mantém CTA principal e CTA de descoberta sem virar dashboard', () => {
  assert.match(hero, /data-cta="hero-comecar-gratis"/)
  assert.match(hero, /scrollHowItWorks/)
  assert.doesNotMatch(hero, /Recursos Plus|Três caminhos para o seu cuidado diário|MOODS|PLUS_ITEMS|PATHS|selectedMood/)
})

test('Home explica jornada, ferramentas e contexto antes dos planos', () => {
  const journey = content.indexOf('Uma jornada simples e significativa')
  const tools = content.indexOf('Ferramentas que fazem sentido na vida real')
  const context = content.indexOf('Mais contexto para enxergar o que importa')
  const garden = content.indexOf('Seu cuidado também pode ganhar forma')
  const plans = content.indexOf('Escolha o seu momento')
  assert.ok(journey >= 0)
  assert.ok(tools > journey)
  assert.ok(context > tools)
  assert.ok(garden > context)
  assert.ok(plans > garden)
})

test('Home pública apresenta as quatro etapas da experiência', () => {
  assert.match(content, /Registre seu dia/)
  assert.match(content, /Visualize sua trajetória/)
  assert.match(content, /Entenda seus padrões/)
  assert.match(content, /Cuide de você/)
})

test('preços continuam vindo da fonte canônica e detalhes completos permanecem em Planos', () => {
  assert.match(content, /from '\.\.\/lib\/planPricing'/)
  assert.match(content, /usePlanPricing\(\)/)
  assert.match(content, /onNavigate\('pricing'\)/)
  assert.match(content, /Comparar todos os planos/)
  assert.match(content, /Check-in diário — 1 por dia/)
  assert.match(content, /Aprofundamentos do Diário/)
})

test('Home pública preserva privacidade e limite de escopo do produto', () => {
  assert.match(content, /Seus registros são seus/)
  assert.match(content, /Seus dados são privados por padrão/)
  assert.match(content, /Não substitui acompanhamento profissional/)
  assert.match(content, /Apoio, não diagnóstico/)
  assert.match(content, /Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência/)
})

test('Header público acompanha a navegação do mockup e mantém criação gratuita em destaque', () => {
  assert.match(header, /Como funciona/)
  assert.match(header, /Planos/)
  assert.match(header, /Conteúdos/)
  assert.match(header, /Sobre/)
  assert.match(header, /Criar conta gratuita/)
  assert.match(header, /como-funciona/)
})
