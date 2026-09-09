import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const migration = read('supabase/migrations/20260909110000_ai_incident_entity_key.sql')
const genContent = read('supabase/functions/generate-content/index.ts')
const runner = read('supabase/functions/run-emotional-automations/runner.ts')
const explainMap = read('supabase/functions/explain-emotional-map/index.ts')
const fabrica = read('src/components/admin/AdminFabricaIA.tsx')
const aiContent = read('src/lib/aiContent.ts')

test('todos os produtores de log de IA definem incident_entity_key', () => {
  // generate-content: explícito (entityKey) ou derivado de user+período
  assert.match(genContent, /const incidentKey = \(body\.entityKey && body\.entityKey\.trim\(\)\)/)
  assert.match(genContent, /`\$\{ct\}:u:\$\{body\.userId\}:p:\$\{body\.sourcePeriodStart \?\? '-'\}`/)
  assert.match(genContent, /incident_entity_key: incidentKey/)
  // cron emocional: por usuário + período
  assert.match(runner, /incident_entity_key: `\$\{promptType\}:u:\$\{profile\.user_id\}:p:\$\{job\.start\}`/)
  assert.match(runner, /incident_entity_key: `self_care_plan:u:\$\{profile\.user_id\}:p:\$\{s\.period_start\}`/)
  // mapa emocional
  assert.match(explainMap, /incident_entity_key: `emotional_map_explanation:u:\$\{user\.id\}:p:/)
})

test('geração editorial (sem usuário) usa uma chave de operação própria', () => {
  assert.match(fabrica, /entityKey: `editorial_article:\$\{input\.operationId\}`/)
  assert.match(fabrica, /operationId: `single:\$\{tema\}`/)
  assert.match(fabrica, /operationId: `mass:\$\{temas\[i\]\}`/)
  assert.match(aiContent, /entityKey\?: string/)
  assert.match(aiContent, /\.\.\.\(meta\?\.entityKey \? \{ entityKey: meta\.entityKey \} : \{\}\)/)
})

test('a RPC agrupa por incident_entity_key e a falha só sai de ativa com sucesso da MESMA entidade', () => {
  // distinct on da entity_key + só a última ocorrência conta
  assert.match(migration, /select distinct on \(\s*coalesce\(\s*nullif\(btrim\(incident_entity_key\), ''\)/s)
  assert.match(migration, /lower\(coalesce\(generation_status, status\)\) as outcome/)
  assert.match(migration, /where outcome in \('error','failed','fallback'\)/)
})
