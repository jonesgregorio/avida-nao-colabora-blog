import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('src/components/MyEvolutionPage.tsx')

// Achado da auditoria ao vivo de permissões por plano (13/09/2026, conta Gratuita real): o Mapa
// Emocional não tinha NENHUM bloqueio — isEssential só controlava o widget FreeMapComparison,
// deixando o calendário completo aberto pra quem não tem o plano Essencial. README "Planos
// oficiais" → Gratuito → "Sem Mapa Emocional...". Mesmo padrão de bloqueio de Descobertas/Meu
// Jardim/Relatórios/Minha História.
test('Mapa Emocional bloqueia quem não tem Essencial, com a mesma tela de paywall dos outros itens do grupo', () => {
  assert.match(page, /if \(!isEssential\) \{/)
  assert.match(page, /O Mapa Emocional completo reúne como seus sinais mudam ao longo do tempo\. Está disponível a partir do plano Essencial\./)
  assert.match(page, /<LockKeyhole className="mx-auto h-9 w-9 text-forest-500" \/>/)
  assert.match(page, /onClick=\{props\.onNavigatePricing\}/)
})

test('o bloqueio vale tanto pro resumo quanto pra aba de gráficos (showDetails) — não dá pra contornar', () => {
  const gateIdx = page.indexOf('if (!isEssential) {')
  const showDetailsIdx = page.indexOf('if (showDetails) {')
  assert.ok(gateIdx > 0 && showDetailsIdx > 0 && gateIdx < showDetailsIdx, 'o bloqueio de plano precisa vir ANTES do branch de showDetails, senão initialTab="graficos" pula o paywall')
})

test('busca de registros do diário também é interrompida sem Essencial (evita fetch desnecessário antes do paywall)', () => {
  assert.match(page, /if \(!user \|\| !isEssential\) \{ setEntries\(\[\]\); setPreviousEntries\(\[\]\); setLoading\(false\); return \}/)
  assert.match(page, /\}, \[periodKey, user, isEssential\]\)/)
})

// Mesmo tipo de bug que já tínhamos corrigido em SelfCarePlanPage.tsx: usar profile?.plan cru em
// vez de getEffectivePlan(profile) bloqueia indevidamente quem tem acesso liberado pelo Admin
// (unlimited_access=true) mas profile.plan ainda não migrado no banco.
test('usa getEffectivePlan (reconhece acesso liberado pelo Admin), não profile?.plan cru', () => {
  assert.doesNotMatch(page, /const plan = profile\?\.plan \?\? 'free'/)
  assert.match(page, /import \{ getEffectivePlan, hasPlanAccess \} from '\.\.\/lib\/officialPlans'/)
  assert.match(page, /const plan = getEffectivePlan\(profile\)/)
})
