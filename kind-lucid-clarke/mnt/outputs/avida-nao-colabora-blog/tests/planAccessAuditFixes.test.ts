import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const deepeningMigration = read('supabase/migrations/20260914010000_diary_deepening_requires_plus.sql')
const auditMigration = read('supabase/migrations/20260914020000_admin_plan_access_audit.sql')
const carePage = read('src/components/SelfCarePlanPage.tsx')
const auditComponent = read('src/components/admin/AdminPlanAccessAudit.tsx')
const assinaturasArea = read('src/components/admin/AdminAreaAssinaturas.tsx')

// Achado 1 da auditoria de permissões: o trigger garantia o LIMITE de 3 aprofundamentos/dia,
// mas não confirmava que quem está aprofundando é Plus — só a tela confirmava isso.
test('trigger de diário passa a exigir plano Plus para aprofundar (edição significativa do registro já salvo)', () => {
  assert.match(deepeningMigration, /CREATE OR REPLACE FUNCTION public\.enforce_diary_entry_rules\(\)/)
  assert.match(deepeningMigration, /IF meaningful_update THEN/)
  assert.match(deepeningMigration, /IF user_plan <> 'plus' THEN\s*\n\s*RAISE EXCEPTION 'Aprofundar o registro do dia \(editar depois de salvo\) está disponível no plano Plus\.';/)
  // a checagem de plano vem ANTES da checagem de limite de 3 (não muda a ordem de erro que já existia)
  const planCheckIdx = deepeningMigration.indexOf("user_plan <> 'plus'")
  const limitCheckIdx = deepeningMigration.indexOf('deepening_count, 0) >= 3')
  assert.ok(planCheckIdx > 0 && limitCheckIdx > 0 && planCheckIdx < limitCheckIdx, 'checagem de plano deveria vir antes da checagem de limite')
})

test('o resto da função de regras do diário permanece intacto (não regride check-in, limite mensal, tipos por plano)', () => {
  assert.match(deepeningMigration, /monthly_count >= 5/)
  assert.match(deepeningMigration, /No Gratuito, use o registro básico do dia\./)
  assert.match(deepeningMigration, /O registro básico é exclusivo do plano Gratuito\./)
  assert.match(deepeningMigration, /O aprofundamento avançado está disponível no Plus\./)
})

// Achado 2 da auditoria: SelfCarePlanPage usava profile?.plan cru (normalizePlan), diferente
// do padrão hasPlanAccess/getEffectivePlan usado por Descobertas/Jardim/Orientação Mensal —
// um usuário com acesso liberado manualmente pelo Admin (unlimited_access) mas profile.plan
// ainda não migrado pra 'plus' no banco ficaria bloqueado indevidamente.
test('Plano de Autocuidado usa getEffectivePlan (reconhece acesso liberado pelo Admin), não profile.plan cru', () => {
  assert.doesNotMatch(carePage, /normalizePlan\(profile\?\.plan\)/)
  assert.match(carePage, /import \{ getEffectivePlan \} from '\.\.\/lib\/officialPlans'/)
  assert.match(carePage, /const plus=getEffectivePlan\(profile\)==='plus'/)
})

// Nova ferramenta administrativa: verificação de acesso por plano, pedida explicitamente
// pelo usuário pra não depender de eu reler o código toda vez.
test('RPC admin_plan_access_audit() existe, é restrita a admin, e cobre as 10 regras de banco + 3 informativas de frontend', () => {
  assert.match(auditMigration, /CREATE OR REPLACE FUNCTION public\.admin_plan_access_audit\(\)/)
  assert.match(auditMigration, /IF NOT is_admin\(\) THEN RAISE EXCEPTION 'Acesso negado'; END IF;/)
  assert.match(auditMigration, /REVOKE ALL ON FUNCTION public\.admin_plan_access_audit\(\) FROM PUBLIC, anon, authenticated;/)
  assert.match(auditMigration, /GRANT EXECUTE ON FUNCTION public\.admin_plan_access_audit\(\) TO authenticated;/)
  const bancoChecks = auditMigration.match(/'banco de dados'/g) ?? []
  assert.equal(bancoChecks.length, 10, 'esperava 10 itens de banco de dados (check-in, diário 5\\/mês, tipo por plano, aprofundamento 3\\/dia, aprofundamento plus, questionários, guiados, relatórios, autocuidado, orientação)')
  const frontendChecks = auditMigration.match(/'frontend \(auditoria manual\)'/g) ?? []
  assert.equal(frontendChecks.length, 3, 'esperava 3 itens informativos de frontend (Mapa Emocional, Descobertas, Minha História)')
})

test('a auditoria de acesso confere exatamente as policies/trigger reais já verificados manualmente (nomes certos, não inventados)', () => {
  for (const policy of ['questionnaires_user_access', 'guided_steps_read', 'reports_own_eligible', 'mcp_own_sent', 'guidance_own_eligible']) {
    assert.match(auditMigration, new RegExp(`policyname='${policy}'`), `esperava checar a policy real ${policy}`)
  }
  assert.match(auditMigration, /pg_get_functiondef\(p\.oid\)/)
  assert.match(auditMigration, /p\.proname = 'enforce_diary_entry_rules'/)
})

test('tela do Admin chama a RPC (não Edge Function) e explica a diferença entre "banco de dados" e "frontend (auditoria manual)"', () => {
  assert.match(auditComponent, /supabase\.rpc\('admin_plan_access_audit'\)/)
  assert.match(auditComponent, /Como ler:/)
  assert.match(auditComponent, /Postgres não lê código React/)
  // nunca corrige nada sozinho — só aponta, mesmo padrão do verificador de preços
  assert.doesNotMatch(auditComponent, /\.update\(|\.insert\(|\.delete\(|\.upsert\(/)
})

test('nova aba "Verificação de acesso" está conectada em Assinaturas, ao lado da verificação de preços (que é outra coisa)', () => {
  assert.match(assinaturasArea, /import AdminPlanAccessAudit from '\.\/AdminPlanAccessAudit'/)
  assert.match(assinaturasArea, /\{ id: 'verificacao-acesso', label: 'Verificação de acesso', icon: SearchCheck \}/)
  assert.match(assinaturasArea, /\{tab === 'verificacao-acesso' && <AdminPlanAccessAudit \/>\}/)
})
