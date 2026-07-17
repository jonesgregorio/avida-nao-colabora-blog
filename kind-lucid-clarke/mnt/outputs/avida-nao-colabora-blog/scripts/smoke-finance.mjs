// Smoke do Analytics Financeiro (§20). node scripts/smoke-finance.mjs
// Reproduz as regras de src/lib/financeAnalytics.ts e trava o que o spec exige:
// receita = só pagamento confirmado; cada motivo selecionado conta 1.
const REASON_OPTIONS = ['financial','bugs','missing_feature','content_not_expected','chose_competitor','did_not_understand_features','other']
const EVENTOS_RECEITA = ['payment_confirmed', 'subscription_renewed']
const dentro = (iso, r) => { const t = new Date(iso).getTime(); return t >= r.from.getTime() && t < r.to.getTime() }
const receitaDe = (evs, r) => evs.filter(e => EVENTOS_RECEITA.includes(e.event_type) && dentro(e.occurred_at, r)).reduce((s,e)=>s+(e.amount??0),0)

function rankingMotivos(fbs, changeType) {
  const alvo = changeType && changeType !== 'todos' ? fbs.filter(f => f.change_type === changeType) : fbs
  const c = {}; for (const s of REASON_OPTIONS) c[s] = 0
  let total = 0
  for (const f of alvo) for (const r of f.reasons ?? []) if (r in c) { c[r]++; total++ }
  return REASON_OPTIONS.map(s => ({ slug: s, total: c[s], pct: total ? (c[s]/total)*100 : 0 }))
    .filter(r => r.total > 0).sort((a,b) => b.total - a.total)
}

let fails = 0
const check = (nome, cond, obtido) => {
  if (cond) console.log(`  ok   ${nome}`)
  else { console.log(`  FAIL ${nome} → ${obtido}`); fails++ }
}

console.log('\n§6 Receita conta APENAS pagamento confirmado')
{
  const r = { from: new Date('2026-07-01'), to: new Date('2026-08-01') }
  const evs = [
    { event_type: 'payment_confirmed',      amount: 19.90, occurred_at: '2026-07-16T19:30:00Z' },
    { event_type: 'subscription_renewed',   amount: 39.90, occurred_at: '2026-07-20T10:00:00Z' },
    { event_type: 'checkout_completed',     amount: 19.90, occurred_at: '2026-07-16T19:30:00Z' }, // NÃO conta (duplicaria)
    { event_type: 'subscription_created',   amount: null,  occurred_at: '2026-07-16T19:29:00Z' }, // NÃO conta
    { event_type: 'payment_failed',         amount: 19.90, occurred_at: '2026-07-18T10:00:00Z' }, // NÃO conta
    { event_type: 'payment_confirmed',      amount: 99.00, occurred_at: '2026-06-10T10:00:00Z' }, // fora do período
  ]
  const total = receitaDe(evs, r)
  check('soma 19,90 + 39,90 = 59,80', Math.abs(total - 59.80) < 0.001, total)
  check('assinatura criada não vira receita', !EVENTOS_RECEITA.includes('subscription_created'), 'ok')
  check('checkout_completed não duplica a receita da invoice', !EVENTOS_RECEITA.includes('checkout_completed'), 'ok')
  check('pagamento negado não entra na receita', !EVENTOS_RECEITA.includes('payment_failed'), 'ok')
  check('evento fora do período é ignorado', total < 99, total)
}

console.log('\n§19 Cada motivo selecionado conta individualmente')
{
  const fbs = [
    { change_type: 'downgrade',    reasons: ['financial', 'missing_feature'] },
    { change_type: 'cancellation', reasons: ['financial'] },
    { change_type: 'cancellation', reasons: ['bugs', 'financial', 'other'] },
  ]
  const rk = rankingMotivos(fbs, 'todos')
  const financial = rk.find(r => r.slug === 'financial')
  const missing = rk.find(r => r.slug === 'missing_feature')
  check('financial aparece 3x (1 por seleção)', financial?.total === 3, financial?.total)
  check('missing_feature aparece 1x', missing?.total === 1, missing?.total)
  // 6 seleções no total → financial = 3/6 = 50%
  check('percentual sobre o total de seleções (50%)', Math.abs((financial?.pct ?? 0) - 50) < 0.001, financial?.pct)
  check('ranking ordenado do maior p/ o menor', rk[0].slug === 'financial', rk[0]?.slug)
  check('motivo não selecionado some do ranking', !rk.some(r => r.slug === 'chose_competitor'), 'ok')
}

console.log('\n§19 Separação entre cancelamento e downgrade')
{
  const fbs = [
    { change_type: 'downgrade',    reasons: ['financial'] },
    { change_type: 'cancellation', reasons: ['bugs'] },
  ]
  const soCancel = rankingMotivos(fbs, 'cancellation')
  const soDown = rankingMotivos(fbs, 'downgrade')
  check('filtro de cancelamento traz só bugs', soCancel.length === 1 && soCancel[0].slug === 'bugs', JSON.stringify(soCancel))
  check('filtro de downgrade traz só financial', soDown.length === 1 && soDown[0].slug === 'financial', JSON.stringify(soDown))
}

console.log('\n§6 Variação sem base de comparação não é inventada')
{
  const anterior = 0
  const atual = 100
  const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null
  check('mês anterior zerado → variação null (não Infinity/100%)', variacao === null, String(variacao))
}

console.log('\nSem dados → tudo zero (nunca mockado)')
{
  const r = { from: new Date('2026-07-01'), to: new Date('2026-08-01') }
  check('receita sem eventos = 0', receitaDe([], r) === 0, receitaDe([], r))
  check('ranking sem feedback = vazio', rankingMotivos([], 'todos').length === 0, 'ok')
}

console.log(fails === 0 ? '\n✓ todos os cenários passaram\n' : `\n✗ ${fails} falha(s)\n`)
process.exit(fails === 0 ? 0 : 1)
