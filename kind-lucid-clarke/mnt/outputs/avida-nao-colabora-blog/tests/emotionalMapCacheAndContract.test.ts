import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const fn = read('supabase/functions/explain-emotional-map/index.ts')
const baseMigration = read('supabase/migrations/20260825210000_emotional_map_insights_cache.sql')
const contractMigration = read('supabase/migrations/20260826000124_emotional_map_cache_contract.sql')
const clientLib = read('src/lib/explainEmotionalMap.ts')
const page = read('src/components/MyEvolutionPageLegacy.tsx')

test('explain-emotional-map retorna o contrato JSON exato da Etapa 3', () => {
  for (const field of ['title', 'summary', 'what_stood_out', 'possible_connection', 'something_to_observe', 'positive_resource', 'reflection_question', 'data_quality_notice']) {
    assert.ok(fn.includes(field), `campo ausente no contrato: ${field}`)
    assert.ok(clientLib.includes(`${field}: string`), `campo ausente no tipo da API: ${field}`)
  }
  assert.match(fn, /Retorne EXCLUSIVAMENTE JSON com EXATAMENTE estes campos/)
})

test('IA recebe todas as fontes estruturadas pedidas e nenhuma coluna de texto livre', () => {
  for (const source of [
    'dias_ativos', 'numero_de_registros', 'checkins', 'diarios', 'emocoes', 'medias',
    'marcadores_emocionais', 'contextos', 'necessidades', 'acoes_de_cuidado',
    'gatilhos_reais', 'conexoes_do_mes', 'qualidade_dos_dados',
  ]) assert.ok(fn.includes(source), `fonte estruturada ausente: ${source}`)

  assert.match(fn, /QUESTIONÁRIOS ESTRUTURADOS/)
  assert.match(fn, /COMPARAÇÃO COM PERÍODO ANTERIOR/)
  assert.match(clientLib, /select\('context_tags,emotional_tags,need_tags,care_action_tags'\)/)
  assert.doesNotMatch(clientLib, /select\([^)]*\btext\b/)
  assert.doesNotMatch(fn, /body\.text|current\.text|questionnaire.*open/i)
})

test('gatilhos reais só entram no payload para Plus', () => {
  assert.match(fn, /gatilhos_reais: plan === 'plus' \? topLabels\(current\.real_triggers\) : \[\]/)
})

test('cache usa user_id + period_key + source_hash de todas as fontes estruturadas', () => {
  assert.match(fn, /const sourceBundle = \{/)
  assert.match(fn, /contract_version: CONTRACT_VERSION/)
  assert.match(fn, /current: payload/)
  assert.match(fn, /previous: previousPayload/)
  assert.match(fn, /questionnaires: questionnairePayload/)
  assert.match(fn, /const sourceHash = await sha256Hex\(JSON\.stringify\(sourceBundle\)\)/)
  assert.match(fn, /const periodKey = `\$\{current\.period_start\}:\$\{current\.period_end\}`/)
  assert.match(fn, /\.eq\('user_id', user\.id\)\.eq\('period_key', periodKey\)/)
  assert.match(fn, /cached\.source_hash === sourceHash/)

  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS period_key text/)
  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS source_hash text/)
  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS result_json jsonb/)
  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS provider text/)
  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS model text/)
  assert.match(contractMigration, /ADD COLUMN IF NOT EXISTS generated_at timestamptz/)
  assert.match(contractMigration, /ON public\.emotional_map_insights \(user_id, period_key\)/)
})

test('cache persiste provider, model, generated_at e mantém compatibilidade histórica', () => {
  assert.match(fn, /period_key: periodKey/)
  assert.match(fn, /source_hash: sourceHash/)
  assert.match(fn, /result_json: result/)
  assert.match(fn, /provider,/)
  assert.match(fn, /model,/)
  assert.match(fn, /generated_at: generatedAt/)
  assert.match(fn, /data_fingerprint: sourceHash/)
  assert.match(fn, /result,/)
  assert.match(baseMigration, /data_fingerprint/)
})

test('botão Atualizar leitura pula o cache de propósito', () => {
  assert.match(fn, /const force = body\.force === true/)
  assert.match(fn, /if \(!force\) \{/)
  assert.match(clientLib, /force\?: boolean/)
  assert.match(page, /Atualizar leitura/)
  assert.match(page, /handleClick\(true\)/)
})

test('RLS permite ao usuário somente ler o próprio resultado; escrita continua server-side', () => {
  assert.match(contractMigration, /FOR SELECT TO authenticated/)
  assert.match(contractMigration, /\(select auth\.uid\(\)\) = user_id/)
  assert.doesNotMatch(contractMigration, /FOR (INSERT|UPDATE|ALL) TO authenticated/)
})

test('poucos dados ficam explícitos e não disparam interpretação inventada', () => {
  const lowSample = fn.match(/function lowSampleFallback\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.notEqual(lowSample, '')
  assert.match(lowSample, /poucos registros/i)
  assert.match(fn, /if \(!dataQuality\.has_enough_data\)/)
  for (const field of ['title', 'summary', 'what_stood_out', 'possible_connection', 'something_to_observe', 'positive_resource', 'reflection_question', 'data_quality_notice']) {
    assert.match(lowSample, new RegExp(field))
  }
})

test('guardas de linguagem proíbem diagnóstico, causalidade e prescrição', () => {
  assert.match(fn, /Nunca diagnostique, prescreva, prometa cura ou atribua causalidade/)
  assert.match(fn, /Não diga que a pessoa "tem ansiedade"/)
  assert.match(fn, /seus registros sugerem/)
  assert.match(fn, /pode valer observar/)
  assert.match(fn, /FORBIDDEN/)
})
