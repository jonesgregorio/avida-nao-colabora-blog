import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const adminSource = read('src/components/admin/AdminGuidanceRequests.tsx')
const promptSource = read('src/lib/aiPrompts/emotionalPrompts.ts')
const migrationSource = read('supabase/migrations/20260824200000_monthly_guidance_answered_requires_primary_text.sql')

test('Admin entrega relatório mensal e plano de autocuidado ao prompt da orientação', () => {
  assert.match(
    adminSource,
    /buildProfessionalGuidancePrompt\([\s\S]*monthly_report_summary:\s*combined\.monthly_report_summary[\s\S]*self_care_plan:\s*combined\.self_care_plan/,
  )
})

test('prompt da orientação usa somente contexto mensal compactado e permitido', () => {
  assert.match(promptSource, /export interface ProfessionalGuidanceRelatedContext/)
  assert.match(promptSource, /monthly_report_summary:\s*compactGuidanceText\(context\?\.monthly_report_summary,\s*2200\)/)
  assert.match(promptSource, /self_care_plan:\s*compactSelfCarePlan\(context\?\.self_care_plan\)/)
  assert.match(promptSource, /somente sínteses estruturadas\/revisadas; nunca texto bruto do Diário/)

  const careHelper = promptSource.match(
    /function compactSelfCarePlan\(value: unknown\) \{([\s\S]*?)\n\}\n\nfunction compactProfessionalGuidanceContext/,
  )?.[1] ?? ''

  assert.match(careHelper, /main_focus:/)
  assert.match(careHelper, /plan\.three_care_priorities/)
  assert.match(careHelper, /suggested_micro_actions:/)
  assert.doesNotMatch(careHelper, /\.\.\.plan/)
})

test('migration impede answered estruturado sem narrativa principal', () => {
  assert.match(migrationSource, /final_response_json requires gentle_guidance or final_message_draft/)
  assert.match(migrationSource, /v_primary_text is null/)
  assert.match(migrationSource, /new\.response := v_primary_text/)
  assert.match(migrationSource, /and new\.final_response_json is null/)
})
