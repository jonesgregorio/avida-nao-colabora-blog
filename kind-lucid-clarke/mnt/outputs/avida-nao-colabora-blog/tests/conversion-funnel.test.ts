import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const funnel = readFileSync(new URL('../src/components/admin/AdminConversionFunnel.tsx', import.meta.url), 'utf8')
const wrapper = readFileSync(new URL('../src/components/admin/AnalyticsPage.tsx', import.meta.url), 'utf8')

 test('P3.19 usa a confirmação financeira do servidor e separa upgrades', () => {
  assert.match(funnel, /from\('subscription_events'\)/)
  assert.match(funnel, /event_type.*checkout_completed/)
  assert.match(funnel, /previous_plan/)
  assert.match(funnel, /upgrade_confirmed/)
  assert.match(funnel, /newPaidUsers/)
  assert.match(funnel, /upgradeUsers/)
})

test('P3.19 mede ativação sem ler conteúdo sensível', () => {
  assert.match(funnel, /from\('diary_entries'\)/)
  assert.match(funnel, /select\('user_id,created_at'\)/)
  assert.match(funnel, /from\('questionnaire_responses'\)/)
  assert.doesNotMatch(funnel, /diary_text|answers|message_body|personal_note|health_description/)
})

test('Analytics legado permanece disponível sem regressão das outras abas', () => {
  assert.match(wrapper, /AdminConversionFunnel/)
  assert.match(wrapper, /AnalyticsPageLegacy/)
  assert.match(wrapper, /<AnalyticsPageLegacy \{\.\.\.props\} \/>/)
})
