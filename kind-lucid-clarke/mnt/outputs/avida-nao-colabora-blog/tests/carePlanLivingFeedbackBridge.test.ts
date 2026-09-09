import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../src/components/SelfCarePlanPage.tsx', import.meta.url), 'utf8')
const base = fs.readFileSync(new URL('../supabase/migrations/20260908211000_living_self_care_plan.sql', import.meta.url), 'utf8')
const bridge = fs.readFileSync(new URL('../supabase/migrations/20260908215500_care_plan_living_feedback_bridge.sql', import.meta.url), 'utf8')

test('readiness is loaded through a narrow safe RPC', () => {
  assert.match(page, /get_my_care_plan_readiness/)
  assert.match(base, /RETURNS TABLE[\s\S]*readiness jsonb/)
  assert.match(base, /REVOKE ALL ON FUNCTION public\.get_my_care_plan_readiness\(\) FROM PUBLIC, anon/)
  assert.doesNotMatch(base, /CREATE POLICY "mcp_own_readiness"/)
})

test('action state is bound to the owner sent plan', () => {
  assert.match(base, /p\.id = care_plan_id AND p\.user_id = auth\.uid\(\) AND p\.status = 'sent'/)
})

test('living feedback feeds the existing next-cycle AI contract', () => {
  assert.match(bridge, /sync_living_care_feedback/)
  assert.match(bridge, /WHEN 'helped' THEN 'helpful'/)
  assert.match(bridge, /WHEN 'not_for_me' THEN 'not_for_me'/)
  assert.match(bridge, /care_plan_action_feedback/)
  assert.match(bridge, /ON CONFLICT \(care_plan_id, action_index\)/)
})
