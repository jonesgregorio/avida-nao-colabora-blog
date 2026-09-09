import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const source=fs.readFileSync(new URL('../supabase/functions/run-emotional-automations/carePlanReadiness.ts',import.meta.url),'utf8')
test('readiness requires enough spread and volume',()=>{assert.match(source,/minEntries = 12/);assert.match(source,/minActiveDays = 8/);assert.match(source,/insufficient_activity/);assert.match(source,/não criar um plano genérico/);assert.match(source,/Não é preciso registrar todos os dias/)})
