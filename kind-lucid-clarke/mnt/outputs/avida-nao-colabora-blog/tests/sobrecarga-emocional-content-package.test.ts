import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20260917011500_sobrecarga_emocional_first_content_package.sql', import.meta.url), 'utf8')
const guides = readFileSync(new URL('../src/lib/seoGuides.ts', import.meta.url), 'utf8')

const actionableSlug = 'o-que-fazer-quando-voce-percebe-que-esta-sobrecarregado'
const pillarSlug = 'como-perceber-se-hoje-foi-um-dia-de-sobrecarga'

function executableSql(sql: string) {
  return sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

test('pacote cria apenas uma nova lacuna editorial de ação', () => {
  const insertOccurrences = migration.match(/INSERT INTO public\.articles/gi) ?? []
  assert.equal(insertOccurrences.length, 1)
  assert.match(migration, new RegExp(actionableSlug))
  assert.doesNotMatch(migration, /sobrecarga-emocional-no-trabalho/)
  assert.doesNotMatch(migration, /burnout-no-trabalho/)
})

test('novo artigo é público, educativo e não se apresenta como diagnóstico', () => {
  assert.match(migration, /'published', true, now\(\), 'free'/)
  assert.match(migration, /não é um diagnóstico|não servem para diagnosticar|não substitui acompanhamento profissional/i)
  assert.doesNotMatch(migration, /cura a sobrecarga|trata a sobrecarga|elimina o estresse/i)
})

test('páginas existentes recebem papéis de intenção distintos', () => {
  assert.match(migration, new RegExp(`WHERE slug = '${pillarSlug}'`))
  assert.match(migration, /WHERE slug = 'como-saber-se-estou-so-cansando-ou-sobrecarregando-demais'/)
  assert.match(migration, /WHERE slug = '5-sinais-de-que-voce-precisa-desacelerar'/)
  assert.match(migration, /WHERE slug = 'o-que-observar-quando-a-cabeca-esta-cheia'/)
  assert.match(migration, /WHERE slug = 'como-lidar-com-dias-em-que-tudo-parece-pesado'/)
  assert.match(migration, /WHERE slug = 'como-fazer-uma-pausa-quando-a-mente-nao-desacelera'/)
  assert.match(migration, /WHERE slug = 'um-exercicio-de-pausa-para-dias-pesados'/)
})

test('guia Sobrecarga emocional incorpora a jornada reconhecer → agir → diferenciar → pausar', () => {
  assert.match(guides, new RegExp(actionableSlug))
  assert.match(guides, /o que fazer quando estou sobrecarregado/i)
  assert.match(guides, /Reconhecer e reorganizar/)
})

test('pacote não altera superfícies sensíveis', () => {
  const sql = executableSql(migration)
  assert.doesNotMatch(sql, /CREATE POLICY|ALTER POLICY|DROP POLICY/i)
  assert.doesNotMatch(sql, /stripe|price_id|subscription_status/i)
  assert.doesNotMatch(sql, /UPDATE\s+public\.(diary|checkin|profiles|subscriptions)/i)
  assert.doesNotMatch(sql, /INSERT INTO\s+public\.(diary|checkin|profiles|subscriptions)/i)
})
