import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const userPage = read('src/components/MonthlyGuidancePage.tsx')
const adminPage = read('src/components/admin/AdminGuidanceRequests.tsx')

// Contrato: Orientação Mensal precisa mostrar "Recebida"/"Em análise"/"Respondida" — não só um
// binário "em análise vs respondida". "Em análise" é um sinal REAL (um profissional abriu o
// pedido pra trabalhar nele), nunca inferido pelo tempo decorrido desde o envio.

test('MonthlyGuidancePage reconhece os 3 estágios a partir do status real, nunca por tempo decorrido', () => {
  assert.match(userPage, /type GuidanceStage = 'received' \| 'in_review' \| 'answered'/)
  assert.match(userPage, /function guidanceStage\(req: GuidanceRequest\): GuidanceStage/)
  assert.match(userPage, /if \(isRequestAnswered\(req\)\) return 'answered'/)
  assert.match(userPage, /if \(req\.status === 'in_review'\) return 'in_review'/)
  assert.doesNotMatch(userPage, /Date\.now\(\)[\s\S]{0,80}in_review|daysSince[\s\S]{0,80}in_review/)
})

test('página do usuário mostra uma trilha de 3 etapas e rótulos "Recebida"/"Em análise"/"Respondida"', () => {
  assert.match(userPage, /function guidanceStageLabel\(stage: GuidanceStage\): string/)
  assert.match(userPage, /return 'Respondida'/)
  assert.match(userPage, /return 'Em análise'/)
  assert.match(userPage, /return 'Recebida'/)
  assert.match(userPage, /Etapas da sua orientação/)
  assert.match(userPage, /\['received', 'in_review', 'answered'\] as const/)
})

test('histórico de orientações usa o mesmo estágio de 3 valores no badge da linha (não mais um binário)', () => {
  assert.match(userPage, /const stage = guidanceStage\(req\)/)
  assert.match(userPage, /const stageBadgeClass = stage === 'answered'[\s\S]{0,40}stage === 'in_review'/)
  assert.match(userPage, /\{guidanceStageLabel\(stage\)\}/)
})

test('admin transiciona "Recebida" -> "Em análise" quando abre o pedido pra trabalhar (sinal real, não estimado)', () => {
  assert.match(adminPage, /function openRequest\(r: GuidanceRequest\) \{/)
  assert.match(adminPage, /if \(r\.status === 'open'\) \{/)
  assert.match(adminPage, /supabase\.from\('monthly_guidance_requests'\)\.update\(\{ status: 'in_review' \}\)\.eq\('id', r\.id\)\.eq\('status', 'open'\)/)
})

test('admin mostra badge "Em análise" distinto de "Recebida" e continua contando os dois como pendentes de resposta', () => {
  assert.match(adminPage, /if \(status === 'in_review'\) return[\s\S]{0,220}Em análise/)
  assert.match(adminPage, /return <span className="inline-flex items-center gap-1 text-\[11px\] bg-amber-100 text-amber-700[\s\S]{0,120}Recebida/)
  assert.match(adminPage, /const openReqs = requests\.filter\(r => r\.status === 'open' \|\| r\.status === 'in_review'\)/)
})

test('não altera a regra de "respondida" (status===answered com narrativa válida) nem os limites do plano', () => {
  assert.doesNotMatch(userPage, /isGuidanceAnswered\(status: string.*in_review/)
  assert.match(userPage, /const DEADLINE_DAY = 23/)
  assert.match(userPage, /getEffectivePlan\(profile\) === 'plus'/)
})
