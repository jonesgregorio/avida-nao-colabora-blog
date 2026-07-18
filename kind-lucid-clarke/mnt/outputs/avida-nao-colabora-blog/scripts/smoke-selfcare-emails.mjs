// Smoke dos lembretes de autocuidado (§20). node scripts/smoke-selfcare-emails.mjs
// Replica a resolução de gatilho + limites do run-lifecycle-emails e trava as
// regras que NÃO podem quebrar: gating de plano, prioridade, anti-spam.
const DAY = 86400000
const RANK = { free: 0, essential: 1, plus: 2 }
const tierOf = p => (RANK[p] ?? 0) >= 2 ? 'plus' : (RANK[p] ?? 0) === 1 ? 'essential' : 'free'
const prefOn = v => v !== false

const CORPO_INAT = {
  free: 'Um check-in rápido pode ser um bom começo para entender como você está hoje. Mesmo com poucos minutos, você registra seu momento e acompanha seus últimos registros.',
  essential: 'Seus registros ajudam a formar uma visão mais clara da sua semana no Mapa Emocional e no relatório semanal. Um check-in rápido já pode ajudar você a perceber padrões com mais facilidade.',
  plus: 'Seus registros ajudam a deixar seu relatório mensal, plano de autocuidado e orientação mais conectados ao que você viveu de verdade. Um pequeno check-in já pode tornar a leitura do mês mais precisa.',
}
const CTA = {
  free: { label: 'Fazer check-in rápido', path: '/diario?modo=checkin' },
  essential: { label: 'Registrar como estou hoje', path: '/diario' },
  plus: { label: 'Registrar meu momento', path: '/diario?modo=checkin' },
}
const CTA_CHECKIN = { label: 'Fazer check-in rápido', path: '/diario?modo=checkin' }

// Espelho de resolverGatilho(). `ctx`: { fimDoMes }.
function resolver(u, ctx) {
  const tier = tierOf(u.plan)
  const p = u.prefs ?? {}
  if (p.email_enabled === false) return null
  const gap = u.gap
  const wkN = u.weekCount ?? 0
  const moN = u.monthCount ?? 0
  const ativoHoje = gap < 1
  const assinaturaOk = !u.subscription_status || ['active', 'trialing'].includes(u.subscription_status)

  if (tier === 'plus' && assinaturaOk && ctx.fimDoMes && moN < 4 && !ativoHoje) {
    if (prefOn(p.receive_report_reminders) || prefOn(p.receive_care_plan_reminders))
      return { template: 'selfcare_monthly_low_data', cta: CTA_CHECKIN, corpo: 'mês' }
  }
  if (tier !== 'free' && assinaturaOk && wkN < 2 && !ativoHoje && gap < 7 && prefOn(p.receive_report_reminders))
    return { template: 'selfcare_weekly_low_data', cta: CTA_CHECKIN, corpo: 'semana' }
  if (!prefOn(p.receive_selfcare_reminders)) return null
  const base = { corpo: CORPO_INAT[tier], cta: CTA[tier] }
  if (gap >= 30) return { template: 'selfcare_inactive_30d', ...base }
  if (gap >= 14) return { template: 'selfcare_inactive_14d', ...base }
  if (gap >= 7) return { template: 'selfcare_inactive_7d', ...base }
  if (gap >= 3) return { template: 'selfcare_inactive_3d', ...base }
  return null
}

// Limites (§5): usa histórico local para decidir se PODE enviar.
function podeEnviar(hist) {
  if (hist.sentToday) return false
  if ((hist.monthCount ?? 0) >= 4) return false
  if (hist.lastAgoDays != null && hist.lastAgoDays < 5) return false
  return true
}

let fails = 0
const ok = (n, c, got) => { if (c) console.log(`  ok   ${n}`); else { console.log(`  FAIL ${n} → ${got}`); fails++ } }
const meio = { fimDoMes: false }
const fim = { fimDoMes: true }

console.log('\n§4 Gating de plano — Gratuito NUNCA vê recurso pago')
{
  const g = resolver({ plan: 'free', gap: 5 }, meio)
  ok('free 5 dias → inactive_3d', g?.template === 'selfcare_inactive_3d', g?.template)
  ok('copy do free não cita relatório/plano/orientação',
    !/relatório|plano de autocuidado|orientação|Mapa Emocional/i.test(g.corpo), g.corpo.slice(0, 40))
  ok('CTA do free vai para check-in rápido', g.cta.path === '/diario?modo=checkin', g.cta.path)
  ok('free NUNCA recebe low-data semanal', resolver({ plan: 'free', gap: 2, weekCount: 0 }, meio) === null,
    JSON.stringify(resolver({ plan: 'free', gap: 2, weekCount: 0 }, meio)))
}

console.log('\n§4 Essencial e Plus mencionam seus recursos')
{
  const e = resolver({ plan: 'essential', gap: 8 }, meio)
  ok('essential 8 dias → inactive_7d', e?.template === 'selfcare_inactive_7d', e?.template)
  ok('copy essential cita Mapa/relatório semanal', /Mapa Emocional|relatório semanal/.test(e.corpo), 'ok')
  const p = resolver({ plan: 'plus', gap: 20 }, meio)
  ok('plus 20 dias → inactive_14d', p?.template === 'selfcare_inactive_14d', p?.template)
  ok('copy plus cita relatório mensal/plano', /relatório mensal|plano de autocuidado/.test(p.corpo), 'ok')
}

console.log('\n§5 Prioridade — só o gatilho mais relevante')
{
  // Plus, fim do mês, poucos dados no mês E inativo há 10 dias → mensal vence.
  const g = resolver({ plan: 'plus', gap: 10, monthCount: 1 }, fim)
  ok('plus fim de mês low-data vence inatividade', g?.template === 'selfcare_monthly_low_data', g?.template)
  // Mesma pessoa NO MEIO do mês → cai para inatividade (gap 10 = faixa 7d).
  const g2 = resolver({ plan: 'plus', gap: 10, monthCount: 1 }, meio)
  ok('meio do mês → volta para inatividade (7d)', g2?.template === 'selfcare_inactive_7d', g2?.template)
}

console.log('\n§5 Escalonamento por gap')
{
  ok('gap 2 → nada', resolver({ plan: 'free', gap: 2 }, meio) === null, 'ok')
  ok('gap 3 → 3d', resolver({ plan: 'free', gap: 3 }, meio)?.template === 'selfcare_inactive_3d', 'ok')
  ok('gap 7 → 7d', resolver({ plan: 'free', gap: 7 }, meio)?.template === 'selfcare_inactive_7d', 'ok')
  ok('gap 14 → 14d', resolver({ plan: 'free', gap: 14 }, meio)?.template === 'selfcare_inactive_14d', 'ok')
  ok('gap 30 → 30d', resolver({ plan: 'free', gap: 40 }, meio)?.template === 'selfcare_inactive_30d', 'ok')
}

console.log('\n§6 Preferências desligam os e-mails certos')
{
  ok('selfcare desligado → sem inatividade',
    resolver({ plan: 'free', gap: 10, prefs: { receive_selfcare_reminders: false } }, meio) === null, 'ok')
  ok('report desligado → sem low-data semanal',
    resolver({ plan: 'essential', gap: 2, weekCount: 0, prefs: { receive_report_reminders: false } }, meio) === null, 'ok')
  ok('email_enabled=false → nada',
    resolver({ plan: 'plus', gap: 40, prefs: { email_enabled: false } }, fim) === null, 'ok')
  ok('desligar report NÃO afeta lembrete de inatividade',
    resolver({ plan: 'plus', gap: 15, prefs: { receive_report_reminders: false } }, meio)?.template === 'selfcare_inactive_14d', 'ok')
}

console.log('\n§5 Anti-spam')
{
  ok('já enviou hoje → não envia', !podeEnviar({ sentToday: true }), 'ok')
  ok('4 no mês → não envia', !podeEnviar({ monthCount: 4 }), 'ok')
  ok('último há 3 dias → não envia (mín. 5)', !podeEnviar({ lastAgoDays: 3 }), 'ok')
  ok('último há 6 dias, 2 no mês → envia', podeEnviar({ lastAgoDays: 6, monthCount: 2 }), 'ok')
}

console.log('\n§19 Segurança — assunto neutro, sem dado emocional')
{
  const assuntos = ['Como você está hoje?', 'Uma pausa também faz parte', 'Seu espaço continua te esperando', 'Quer retomar do seu jeito?']
  const proibido = /triste|ansios|deprim|humor|sentindo mal|diagnóst|piorando/i
  ok('nenhum assunto expõe estado emocional', !assuntos.some(a => proibido.test(a)), 'ok')
}

console.log('\n§8 Sem linguagem de cobrança/culpa nas copies')
{
  const copies = [...Object.values(CORPO_INAT)]
  const proibido = /você falhou|abandonou|precisa voltar|sentimos sua falta|perdendo|não abandone|progresso está parado/i
  ok('nenhuma copy usa frase proibida', !copies.some(c => proibido.test(c)), 'ok')
}

console.log('\n§24h — quem registrou hoje não recebe low-data')
{
  ok('ativo hoje (gap<1) bloqueia low-data semanal',
    resolver({ plan: 'essential', gap: 0.5, weekCount: 0 }, meio) === null, 'ok')
}

console.log(fails === 0 ? '\n✓ todos os cenários passaram\n' : `\n✗ ${fails} falha(s)\n`)
process.exit(fails === 0 ? 0 : 1)
