import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const page = read('src/components/MyHistoryPageLegacy.tsx')
const modernPage = read('src/components/MyHistoryPage.tsx')

// Achado ao vivo (14/09/2026, conta Gratuita real): "Minha História" no plano Gratuito mostrava
// um bloqueio TOTAL ("Seu histórico completo começa no Essencial"), sem nenhuma "visão inicial"
// — mesmo o README prometendo "Minha História: visão inicial" pro Gratuito. Não existia código
// nenhum implementando essa visão inicial; foi prometida mas nunca construída.

test('Gratuito vê números básicos reais (total de registros, dias com você, início) — não mais um bloqueio total', () => {
  assert.match(page, /const \[freeStats, setFreeStats\] = useState<\{ total: number; startedAt: string \| null \} \| null>\(null\)/)
  assert.match(page, /registros no total/)
  assert.match(page, /dias com você/)
  assert.match(page, /início da sua história/)
  // nunca mais o headline de bloqueio total antigo
  assert.doesNotMatch(page, /Seu histórico completo começa no Essencial/)
})

test('a busca da visão inicial é leve (count + 1 linha), não a busca pesada da história completa', () => {
  const freeEffect = page.split("if (!user || hasHistory) { setFreeStatsLoading(false); return }")[1]?.split('if (!hasHistory) {')[0] ?? ''
  assert.match(freeEffect, /select\('id', \{ count: 'exact', head: true \}\)/)
  assert.match(freeEffect, /\.limit\(1\)\.maybeSingle\(\)/)
  assert.doesNotMatch(freeEffect, /loadStructuredHistory|loadReportHistory|fetchDiscoveryMemories/)
})

test('a busca leve só roda quando falta Essencial — quem já tem Essencial+ não paga esse custo extra', () => {
  assert.match(page, /if \(!user \|\| hasHistory\) \{ setFreeStatsLoading\(false\); return \}/)
})

test('visão inicial ainda deixa claro que a linha do tempo completa é Essencial+, com CTA', () => {
  assert.match(page, /A linha do tempo completa, marcos, comparações entre períodos e relatórios ficam disponíveis a partir do Essencial\./)
  assert.match(page, /onClick=\{onNavigatePricing\}[^>]*>Conhecer o Essencial/)
})

// Mesmo padrão de correção já aplicado em SelfCarePlanPage.tsx e MyEvolutionPage.tsx nesta
// sessão: usar profile?.plan cru bloqueia indevidamente quem tem unlimited_access=true mas
// profile.plan ainda não migrado no banco.
test('MyHistoryPageLegacy e MyHistoryPage usam getEffectivePlan (reconhece acesso liberado pelo Admin), não plan cru', () => {
  assert.match(page, /import \{ getEffectivePlan, hasPlanAccess \} from '\.\.\/lib\/officialPlans'/)
  assert.match(page, /const plan = getEffectivePlan\(profile\)/)
  assert.match(modernPage, /import \{ getEffectivePlan, hasPlanAccess \} from '\.\.\/lib\/officialPlans'/)
  assert.match(modernPage, /const plan=getEffectivePlan\(profile\)/)
})
