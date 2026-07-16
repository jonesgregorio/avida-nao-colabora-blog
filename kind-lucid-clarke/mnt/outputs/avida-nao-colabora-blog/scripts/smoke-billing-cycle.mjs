// Smoke dos cenários de ciclo (§14). Roda sem infra: node scripts/smoke-billing-cycle.mjs
// Reproduz a lógica de src/lib/billingCycle.ts e trava o bug da data fixa.
const MS_DAY = 86_400_000, MS_CYCLE = 30 * MS_DAY, TZ = 'America/Sao_Paulo'

const toDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d }
const rollForward = (b, now) => { const d = now.getTime() - b.getTime(); return d <= 0 ? b : new Date(b.getTime() + Math.ceil(d / MS_CYCLE) * MS_CYCLE) }
const fallbackEnd = (act, now) => { const a = toDate(act); return a ? rollForward(new Date(a.getTime() + MS_CYCLE), now) : null }
const periodEnd = (sub, now) => { const e = toDate(sub?.current_period_end); return e ? rollForward(e, now) : null }
const resolve = (sub, act, now) => periodEnd(sub, now) ?? (toDate(sub?.pending_plan_starts_at) ? rollForward(toDate(sub.pending_plan_starts_at), now) : null) ?? fallbackEnd(act, now)
const tzFor = (d) => (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) ? 'UTC' : TZ
const fmt = (d) => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: tzFor(d) }) : '—'

let fails = 0
const check = (name, cond, got) => {
  if (cond) console.log(`  ok   ${name}`)
  else { console.log(`  FAIL ${name} → obteve: ${got}`); fails++ }
}

console.log('\n§14 Downgrade — cenário 1: Plus ativado 16/07, pede downgrade em 20/07')
{
  const now = new Date('2026-07-20T12:00:00Z')
  // current_period_end vencido no banco (webhook não sincronizou) — o bug original
  const sub = { current_period_end: '2026-07-14T00:00:00Z' }
  const eff = resolve(sub, '2026-07-16T00:00:00Z', now)
  check('não mostra a data vencida 14/07', fmt(eff) !== '14 de julho de 2026', fmt(eff))
  check('data resultante é futura', eff > now, fmt(eff))
  console.log(`       → ${fmt(eff)}`)
}

console.log('\n§14 Downgrade — cenário 2: Essencial ativado 01/08, downgrade p/ Gratuito em 10/08')
{
  const now = new Date('2026-08-10T12:00:00Z')
  const eff = resolve({ current_period_end: null }, '2026-08-01T00:00:00Z', now)
  check('agenda p/ fim do ciclo (31/08), não hoje', fmt(eff) === '31 de agosto de 2026', fmt(eff))
  check('mantém acesso até lá (data futura)', eff > now, fmt(eff))
  console.log(`       → ${fmt(eff)}`)
}

console.log('\n§14 Cancelamento no meio do ciclo — acesso até current_period_end')
{
  const now = new Date('2026-07-20T12:00:00Z')
  const eff = resolve({ current_period_end: '2026-08-15T00:00:00Z' }, '2026-07-16T00:00:00Z', now)
  check('usa current_period_end do Stripe', fmt(eff) === '15 de agosto de 2026', fmt(eff))
}

console.log('\n§14 Timezone — data de calendário não pode voltar um dia (o bug do "14 de julho")')
{
  const eff = new Date('2026-07-15T00:00:00Z')
  check('meia-noite UTC de 15/07 exibe "15 de julho"', fmt(eff) === '15 de julho de 2026', fmt(eff))
  // Prova do bug antigo: o mesmo valor lido em São Paulo cai para o dia anterior.
  const antigo = eff.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
  check('regressão: comportamento antigo produzia "14 de julho"', antigo === '14 de julho de 2026', antigo)
  // Instante real do Stripe (hora cheia) segue no fuso de São Paulo.
  const real = new Date('2026-08-15T14:23:11Z')
  check('instante real do Stripe usa fuso de São Paulo', fmt(real) === '15 de agosto de 2026', fmt(real))
}

console.log('\n§11 Prioridade das fontes')
{
  const now = new Date('2026-07-20T12:00:00Z')
  check('current_period_end tem prioridade sobre ativação',
    fmt(resolve({ current_period_end: '2026-09-01T00:00:00Z' }, '2026-01-01T00:00:00Z', now)) === '01 de setembro de 2026',
    fmt(resolve({ current_period_end: '2026-09-01T00:00:00Z' }, '2026-01-01T00:00:00Z', now)))
  check('sem nenhuma fonte → null (nunca inventa data)', resolve({}, null, now) === null, String(resolve({}, null, now)))
  check('nunca usa a data de hoje como vigência', fmt(resolve({}, '2026-07-16T00:00:00Z', now)) !== fmt(now),
    fmt(resolve({}, '2026-07-16T00:00:00Z', now)))
}

console.log(fails === 0 ? '\n✓ todos os cenários passaram\n' : `\n✗ ${fails} falha(s)\n`)
process.exit(fails === 0 ? 0 : 1)
