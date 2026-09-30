import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const guide = readFileSync(new URL('../src/components/PlanOnboardingGuide.tsx', import.meta.url), 'utf8')
const admin = readFileSync(new URL('../src/components/admin/AdminOnboarding.tsx', import.meta.url), 'utf8')
const communication = readFileSync(new URL('../src/components/admin/AdminAreaComunicacao.tsx', import.meta.url), 'utf8')
const runner = readFileSync(new URL('../supabase/functions/run-onboarding-emails/index.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260930185000_onboarding_por_plano.sql', import.meta.url), 'utf8')
const config = readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8')

test('onboarding no app é compacto, por plano e pode ser ocultado temporariamente', () => {
  assert.match(guide, /DISMISS_FOR_MS = 7 \* 24 \* 60 \* 60 \* 1000/)
  assert.match(guide, /pending\.slice\(0, 3\)/)
  assert.match(guide, /plan === 'essential'/)
  assert.match(guide, /Plano de Autocuidado/)
  assert.match(guide, /Orientação Mensal/)
  assert.match(guide, /isso não é uma meta/i)
})

test('onboarding usa comportamento real para Check-in e Diário', () => {
  assert.match(guide, /entry_type/)
  assert.match(guide, /row\.entry_type === 'checkin'/)
  assert.match(guide, /row\.entry_type === 'diary'/)
  assert.match(runner, /candidate\.checkins_total === 0/)
  assert.match(runner, /candidate\.checkins_total > 0 && candidate\.diaries_total === 0/)
})

test('e-mails de onboarding respeitam cooldown e não repetem etapa concluída', () => {
  assert.match(runner, /COOLDOWN_DAYS = 3/)
  assert.match(runner, /last_nurture_email/)
  assert.match(runner, /idempotency_key: `\$\{template\}:\$\{candidate\.user_id\}`/)
  assert.match(runner, /returnedAfterActivation/)
  assert.match(migration, /value_onboarding_first_checkin/)
  assert.match(migration, /value_onboarding_diary/)
  assert.match(migration, /value_onboarding_plan_return/)
})

test('textos de boas-vindas e plano mantêm tom humano e sem cobrança', () => {
  assert.match(migration, /Que bom ter você por aqui/)
  assert.match(migration, /Sem sequência obrigatória\. Sem cobrança/)
  assert.match(migration, /Você não precisa conhecer tudo de uma vez/)
  assert.match(migration, /não existe nada para “colocar em dia”/)
})

test('Admin possui aba de onboarding com filtros, paginação e CSV', () => {
  assert.match(communication, /id: 'onboarding'/)
  assert.match(communication, /<AdminOnboarding/)
  assert.match(admin, /PAGE_SIZES = \[10, 20, 50, 100\]/)
  assert.match(admin, /admin_onboarding_page/)
  assert.match(admin, /admin_onboarding_summary/)
  assert.match(admin, /Exportar CSV/)
  assert.match(admin, /p_limit: 5000/)
})

test('cron de onboarding passa pela validação interna da própria Edge Function', () => {
  assert.match(config, /\[functions\.run-onboarding-emails\][\s\S]*verify_jwt = false/)
  assert.match(runner, /get_automation_token/)
  assert.match(runner, /Não autorizado/)
  assert.match(migration, /run-onboarding-emails/)
})
