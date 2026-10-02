import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const faq = readFileSync(new URL('../src/lib/faqContent.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20261002164500_revisar_faq_planos.sql', import.meta.url), 'utf8')

test('FAQ do cliente não usa upgrade/downgrade como linguagem de interface', () => {
  assert.doesNotMatch(faq, /\bupgrade\b/i)
  assert.doesNotMatch(faq, /\bdowngrade\b/i)
})

test('FAQ descreve os três planos atuais e seus recursos principais', () => {
  assert.match(faq, /Gratuito: Check-in diário \(1 por dia\)/)
  assert.match(faq, /Essencial: inclui tudo do Gratuito/)
  assert.match(faq, /Plus: inclui tudo do Essencial/)
  assert.match(faq, /Diário sem limite mensal/)
  assert.match(faq, /Mapa Emocional/)
  assert.match(faq, /Relatório Semanal/)
  assert.match(faq, /Relatório Mensal Aprofundado/)
  assert.match(faq, /Plano de Autocuidado Mensal/)
  assert.match(faq, /Orientação Mensal/)
})

test('FAQ mantém limites canônicos do Diário e Aprofundamentos', () => {
  assert.match(faq, /até 5 dias por mês/i)
  assert.match(faq, /Um Check-in por dia/)
  assert.match(faq, /até 3 aprofundamentos por dia/i)
})

test('FAQ explica elegibilidade e prazo do Plano de Autocuidado', () => {
  assert.match(faq, /12 sinais de uso distribuídos em 8 dias/)
  assert.match(faq, /revisão humana/)
  assert.match(faq, /até o dia 5 do mês seguinte/)
})

test('FAQ explica janela e prazo da Orientação Mensal', () => {
  assert.match(faq, /Entre os dias 1 e 10 do mês seguinte/)
  assert.match(faq, /em até 7 dias corridos/)
})

test('migração sincroniza o CMS com a mesma linguagem simples', () => {
  assert.match(migration, /Como funciona a mudança do Essencial para o Plus\?/)
  assert.match(migration, /O que acontece se eu escolher um plano com menos recursos\?/)
  assert.match(migration, /12 sinais de uso distribuídos em 8 dias/)
})
