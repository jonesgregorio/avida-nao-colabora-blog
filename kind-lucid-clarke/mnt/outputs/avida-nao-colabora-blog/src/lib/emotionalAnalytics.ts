// ─────────────────────────────────────────────────────────────────────────────
// Análise emocional — cálculos a partir dos registros do diário/check-in.
// Alimenta o Mapa Emocional (Essencial: gráficos e padrões) e o Relatório Mensal
// Aprofundado (Plus: leitura narrativa + plano de ação).
//
// Linguagem SEMPRE de autopercepção — nunca diagnóstica ("seus registros
// sugerem…", "parece haver…", "vale observar…").
// ─────────────────────────────────────────────────────────────────────────────

export interface DiaryRowLite {
  mood?: string | number | null
  mood_score?: number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  self_esteem?: number | null
  stress_level?: number | null
  emotional_tags?: string[] | string | null
  entry_type?: string | null
  created_at?: string | null
  date?: string | null
}

export const ENERGY_LABEL: Record<number, string> = { 1: 'muito baixa', 2: 'baixa', 3: 'média', 4: 'boa', 5: 'alta' }
export const ANXIETY_LABEL: Record<number, string> = { 1: 'muito baixa', 2: 'baixa', 3: 'média', 4: 'alta', 5: 'muito alta' }

const MOOD_SCORE: Record<string, number> = {
  'Bem-estar': 5, 'Tranquilidade': 5, 'Cansaço': 2, 'Sem energia': 2,
  'Ansiedade': 2, 'Sobrecarga': 1, 'Tristeza': 1, 'Irritação': 2,
  'Desânimo': 1, 'Confusão': 2, 'Outro': 3,
}
export const MOOD_EMOJI: Record<string, string> = {
  'Bem-estar': '😊', 'Tranquilidade': '😌', 'Cansaço': '😪', 'Sem energia': '🪫',
  'Ansiedade': '😰', 'Sobrecarga': '😩', 'Tristeza': '😔', 'Irritação': '😤',
  'Desânimo': '😞', 'Confusão': '😵‍💫', 'Outro': '😐',
}

const NEGATIVE_MOODS = new Set(['Ansiedade', 'Sobrecarga', 'Tristeza', 'Irritação', 'Desânimo', 'Cansaço', 'Sem energia'])
const POSITIVE_MOODS = new Set(['Bem-estar', 'Tranquilidade'])

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}
function round1(n: number): number { return Math.round(n * 10) / 10 }
function clamp5(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(5, Math.max(1, Math.round(n)))
}
function moodScoreOf(e: DiaryRowLite): number {
  const s = clamp5(e.mood_score)
  if (s > 0) return s
  return MOOD_SCORE[String(e.mood)] ?? 0
}
function dayOf(e: DiaryRowLite): number {
  const d = e.date ? new Date(e.date + 'T12:00:00') : (e.created_at ? new Date(e.created_at) : null)
  return d ? d.getDate() : 0
}
function hourOf(e: DiaryRowLite): number | null {
  if (!e.created_at) return null
  const d = new Date(e.created_at)
  return Number.isNaN(d.getTime()) ? null : d.getHours()
}
function tagsOf(e: DiaryRowLite): string[] {
  const t = e.emotional_tags
  if (Array.isArray(t)) return t
  if (typeof t === 'string' && t.trim()) { try { const p = JSON.parse(t); return Array.isArray(p) ? p : [t] } catch { return [t] } }
  return []
}

// Média das médias diárias — check-in ilimitado não distorce (1 valor por dia).
function avgByDay(rows: DiaryRowLite[], getVal: (e: DiaryRowLite) => number): number {
  const byDay = new Map<number, number[]>()
  for (const e of rows) {
    const v = getVal(e)
    if (!Number.isFinite(v) || v <= 0) continue
    const day = dayOf(e)
    const arr = byDay.get(day) ?? []; arr.push(v); byDay.set(day, arr)
  }
  return round1(avg([...byDay.values()].map(vs => avg(vs))))
}
function seriesByDay(rows: DiaryRowLite[], getVal: (e: DiaryRowLite) => number): { day: number; value: number }[] {
  const byDay = new Map<number, number[]>()
  for (const e of rows) {
    const v = getVal(e)
    if (!Number.isFinite(v) || v <= 0) continue
    const day = dayOf(e)
    const arr = byDay.get(day) ?? []; arr.push(v); byDay.set(day, arr)
  }
  return [...byDay.entries()].map(([day, vs]) => ({ day, value: round1(avg(vs)) })).sort((a, b) => a.day - b.day)
}

export interface PeriodStat { key: string; label: string; count: number; avgEnergy: number; avgAnxiety: number; dominant: string | null }
export interface EmotionalAnalysis {
  diaryCount: number
  checkinCount: number
  totalEntries: number
  activeDays: number
  avg: { mood: number; energy: number; anxiety: number; sleep: number; selfEsteem: number; stress: number }
  prev: { mood: number; energy: number; anxiety: number; diaryCount: number; checkinCount: number }
  moodByDay: { day: number; value: number }[]
  energyByDay: { day: number; value: number }[]
  anxietyByDay: { day: number; value: number }[]
  topEmotions: { label: string; count: number; emoji: string }[]
  triggers: { tag: string; count: number }[]
  periods: PeriodStat[]
  calendar: { day: number; label: string; avg: number; count: number }[]
  energyAnxiety: { hasData: boolean; text: string }
  weekly: { hasData: boolean; lines: string[] }
  weekdayInsight: string | null
}

const PERIODS: { key: string; label: string; test: (h: number) => boolean }[] = [
  { key: 'madrugada', label: 'Madrugada', test: h => h >= 0 && h < 6 },
  { key: 'manha', label: 'Manhã', test: h => h >= 6 && h < 12 },
  { key: 'tarde', label: 'Tarde', test: h => h >= 12 && h < 18 },
  { key: 'noite', label: 'Noite', test: h => h >= 18 && h < 24 },
]

function dominantMoodOf(rows: DiaryRowLite[]): string | null {
  const c: Record<string, number> = {}
  for (const e of rows) { const m = String(e.mood ?? ''); if (m && m !== 'null' && m !== 'undefined') c[m] = (c[m] ?? 0) + 1 }
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0]
  return top ? top[0] : null
}

export function computeEmotionalAnalysis(entries: DiaryRowLite[], prevEntries: DiaryRowLite[] = []): EmotionalAnalysis {
  const diary = entries.filter(e => !e.entry_type || e.entry_type === 'diary')
  const checkins = entries.filter(e => e.entry_type === 'checkin')
  const prevDiary = prevEntries.filter(e => !e.entry_type || e.entry_type === 'diary')
  const prevCheckins = prevEntries.filter(e => e.entry_type === 'checkin')

  const en = (e: DiaryRowLite) => Number(e.energy)
  const anx = (e: DiaryRowLite) => Number(e.anxiety_level)
  const sl = (e: DiaryRowLite) => Number(e.sleep_quality)
  const se = (e: DiaryRowLite) => Number(e.self_esteem)
  const st = (e: DiaryRowLite) => Number(e.stress_level)

  const activeDays = new Set(entries.map(dayOf).filter(d => d > 0)).size

  // Ranking de emoções (rótulo em `mood`).
  const emoCount: Record<string, number> = {}
  for (const e of entries) { const m = String(e.mood ?? ''); if (m && m !== 'null' && m !== 'undefined') emoCount[m] = (emoCount[m] ?? 0) + 1 }
  const topEmotions = Object.entries(emoCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([label, count]) => ({ label, count, emoji: MOOD_EMOJI[label] ?? '•' }))

  // Gatilhos (emotional_tags).
  const tagCount: Record<string, number> = {}
  for (const e of entries) for (const t of tagsOf(e)) { const k = t.trim(); if (k) tagCount[k] = (tagCount[k] ?? 0) + 1 }
  const triggers = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, count]) => ({ tag, count }))

  // Períodos do dia (usa created_at).
  const periods: PeriodStat[] = PERIODS.map(p => {
    const rows = entries.filter(e => { const h = hourOf(e); return h != null && p.test(h) })
    return {
      key: p.key, label: p.label, count: rows.length,
      avgEnergy: round1(avg(rows.map(en).filter(v => v > 0))),
      avgAnxiety: round1(avg(rows.map(anx).filter(v => v > 0))),
      dominant: dominantMoodOf(rows),
    }
  })

  // Calendário emocional (dia → média + dominante + contagem).
  const calMap = new Map<number, { scores: number[]; rows: DiaryRowLite[] }>()
  for (const e of entries) {
    const s = moodScoreOf(e); const day = dayOf(e); if (day <= 0) continue
    const cur = calMap.get(day) ?? { scores: [], rows: [] }
    if (s > 0) cur.scores.push(s)
    cur.rows.push(e); calMap.set(day, cur)
  }
  const calendar = [...calMap.entries()].map(([day, v]) => ({
    day, avg: round1(avg(v.scores)), count: v.rows.length, label: dominantMoodOf(v.rows) ?? '—',
  })).sort((a, b) => a.day - b.day)

  // Relação energia × ansiedade: nos dias de energia mais baixa, como fica a ansiedade?
  const energyByDayVal = new Map<number, number>()
  const anxByDayVal = new Map<number, number>()
  seriesByDay(entries, en).forEach(d => energyByDayVal.set(d.day, d.value))
  seriesByDay(entries, anx).forEach(d => anxByDayVal.set(d.day, d.value))
  const pairedDays = [...energyByDayVal.keys()].filter(d => anxByDayVal.has(d))
  let energyAnxiety: { hasData: boolean; text: string }
  if (pairedDays.length >= 4) {
    const lowEnergyDays = pairedDays.filter(d => (energyByDayVal.get(d) ?? 5) <= 2)
    const otherDays = pairedDays.filter(d => (energyByDayVal.get(d) ?? 0) > 2)
    const anxLow = avg(lowEnergyDays.map(d => anxByDayVal.get(d)!))
    const anxOther = avg(otherDays.map(d => anxByDayVal.get(d)!))
    if (lowEnergyDays.length >= 2 && anxLow > anxOther + 0.4) {
      energyAnxiety = { hasData: true, text: 'Nos dias em que a energia ficou mais baixa, a ansiedade percebida tendeu a aparecer com mais intensidade. Esse padrão pode indicar que seu estado emocional está sensível ao nível de descanso e recuperação.' }
    } else if (lowEnergyDays.length >= 2 && anxLow < anxOther - 0.4) {
      energyAnxiety = { hasData: true, text: 'Curiosamente, nos dias de energia mais baixa a ansiedade percebida apareceu mais suave — talvez esses tenham sido dias de mais pausa e menos exposição a cobranças.' }
    } else {
      energyAnxiety = { hasData: true, text: 'Energia e ansiedade percebida variaram sem uma relação muito marcada neste período. Continuar registrando ajuda a perceber conexões mais claras ao longo do tempo.' }
    }
  } else {
    energyAnxiety = { hasData: false, text: 'Continue registrando check-ins com energia e ansiedade para perceber relações entre eles.' }
  }

  // Comparativo semanal: duas semanas mais recentes com dados (por semana do mês).
  const weekBuckets: DiaryRowLite[][] = [[], [], [], [], []]
  for (const e of entries) { const day = dayOf(e); if (day > 0) weekBuckets[Math.min(4, Math.floor((day - 1) / 7))].push(e) }
  const nonEmpty = weekBuckets.map((rows, i) => ({ i, rows })).filter(w => w.rows.length > 0)
  const weeklyLines: string[] = []
  if (nonEmpty.length >= 2) {
    const cur = nonEmpty[nonEmpty.length - 1]
    const prev = nonEmpty[nonEmpty.length - 2]
    const anxCur = avg(cur.rows.map(anx).filter(v => v > 0))
    const anxPrev = avg(prev.rows.map(anx).filter(v => v > 0))
    const enCur = avg(cur.rows.map(en).filter(v => v > 0))
    const enPrev = avg(prev.rows.map(en).filter(v => v > 0))
    const overCur = cur.rows.filter(e => String(e.mood) === 'Sobrecarga').length
    const overPrev = prev.rows.filter(e => String(e.mood) === 'Sobrecarga').length
    if (anxPrev > 0 && anxCur > 0) {
      const pct = Math.round(((anxCur - anxPrev) / anxPrev) * 100)
      if (Math.abs(pct) >= 5) weeklyLines.push(`A ansiedade percebida ${pct > 0 ? 'apareceu mais forte' : 'ficou mais suave'} do que na semana anterior (${pct > 0 ? '+' : ''}${pct}%).`)
    }
    if (enPrev > 0 && enCur > 0) {
      const pct = Math.round(((enCur - enPrev) / enPrev) * 100)
      if (Math.abs(pct) >= 5) weeklyLines.push(`A energia ${pct > 0 ? 'subiu' : 'caiu'} em relação à semana anterior (${pct > 0 ? '+' : ''}${pct}%).`)
    }
    if (overCur !== overPrev) weeklyLines.push(`Registros de sobrecarga apareceram ${overCur > overPrev ? 'mais vezes' : 'menos vezes'} do que na semana anterior.`)
    if (cur.rows.length !== prev.rows.length) weeklyLines.push(`Você fez ${cur.rows.length > prev.rows.length ? 'mais' : 'menos'} registros nesta semana (${cur.rows.length}) do que na anterior (${prev.rows.length}).`)
  }

  // Dias úteis x fim de semana (ansiedade) — alimenta padrões/relações.
  const wdAnx: number[] = []; const weAnx: number[] = []
  for (const e of entries) {
    const v = anx(e); if (!(v > 0)) continue
    const d = e.created_at ? new Date(e.created_at) : (e.date ? new Date(e.date + 'T12:00:00') : null)
    if (!d || Number.isNaN(d.getTime())) continue
    const dow = d.getDay(); (dow === 0 || dow === 6 ? weAnx : wdAnx).push(v)
  }
  let weekdayInsight: string | null = null
  if (wdAnx.length >= 3 && weAnx.length >= 1) {
    const w = avg(wdAnx), we = avg(weAnx)
    if (w > we + 0.4) weekdayInsight = 'A ansiedade percebida apareceu mais em dias úteis do que nos fins de semana.'
    else if (we > w + 0.4) weekdayInsight = 'A ansiedade percebida apareceu mais nos fins de semana do que nos dias úteis.'
  }

  return {
    weekdayInsight,
    diaryCount: diary.length,
    checkinCount: checkins.length,
    totalEntries: entries.length,
    activeDays,
    avg: {
      mood: avgByDay(entries, moodScoreOf), energy: avgByDay(entries, en), anxiety: avgByDay(entries, anx),
      sleep: avgByDay(entries, sl), selfEsteem: avgByDay(entries, se), stress: avgByDay(entries, st),
    },
    prev: {
      mood: avgByDay(prevEntries, moodScoreOf), energy: avgByDay(prevEntries, en), anxiety: avgByDay(prevEntries, anx),
      diaryCount: prevDiary.length, checkinCount: prevCheckins.length,
    },
    moodByDay: seriesByDay(entries, moodScoreOf),
    energyByDay: seriesByDay(entries, en),
    anxietyByDay: seriesByDay(entries, anx),
    topEmotions, triggers, periods, calendar, energyAnxiety,
    weekly: { hasData: weeklyLines.length > 0, lines: weeklyLines },
  }
}

// ── Insights automáticos para o Essencial (§5.10) ─────────────────────────────
export function buildEssentialInsights(a: EmotionalAnalysis): string[] {
  const out: string[] = []
  // Emoção mais frequente
  if (a.topEmotions[0]) out.push(`A emoção mais registrada foi ${a.topEmotions[0].label.toLowerCase()} (${a.topEmotions[0].count}×).`)
  // Período do dia com mais registros negativos
  const worstPeriod = [...a.periods].filter(p => p.count > 0 && p.dominant && NEGATIVE_MOODS.has(p.dominant)).sort((x, y) => y.avgAnxiety - x.avgAnxiety)[0]
  if (worstPeriod) out.push(`À ${worstPeriod.label.toLowerCase()}, aparecem mais registros de ${worstPeriod.dominant!.toLowerCase()}.`)
  // Energia × ansiedade
  if (a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade')) out.push('Energia baixa apareceu junto de ansiedade mais alta em alguns dias.')
  // Comparativo semanal
  if (a.weekly.hasData) out.push(a.weekly.lines[0])
  // Gatilho recorrente
  if (a.triggers[0] && a.triggers[0].count >= 2) out.push(`O marcador mais recorrente foi "${a.triggers[0].tag}".`)
  return out.slice(0, 4)
}

// ── Relatório Mensal Aprofundado do Plus (§8) ─────────────────────────────────
export interface SelfCarePlan { priority: string; mainCare: string; practice: string; attention: string; commitment: string; checkin: string }
export interface DeepReport {
  hasEnoughData: boolean
  summary: string
  patterns: string[]
  predominantEmotions: string
  energyAnxietySleep: string
  triggersText: string
  attentionDays: { day: number; reason: string }[]
  improvementMoments: string
  monthlyComparison: string[]
  reflectionQuestions: string[]
  guidanceSynthesis: string
  selfCarePlan: SelfCarePlan
  recommendTags: string[]
}

function pct(cur: number, prev: number): number { return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : 0 }

export function buildDeepReport(a: EmotionalAnalysis, monthLabel: string): DeepReport {
  const hasEnoughData = a.totalEntries >= 5 && a.activeDays >= 3
  const top = a.topEmotions[0]?.label
  const negativeTop = a.topEmotions.find(e => NEGATIVE_MOODS.has(e.label))?.label

  // 8.1 Resumo geral
  const summary = hasEnoughData
    ? `Em ${monthLabel}, seus registros sugerem uma presença maior de ${(negativeTop ?? top ?? 'algumas emoções').toLowerCase()} em alguns períodos${a.triggers[0] ? `, muitas vezes ligada a "${a.triggers[0].tag}"` : ''}. Apesar disso, também aparecem sinais de recuperação em momentos com mais pausa e menos cobrança. Este é um retrato de autopercepção — não um diagnóstico.`
    : `Este mês ainda tem poucos registros para uma leitura aprofundada. Mesmo assim, alguns sinais iniciais já podem ser observados. Quanto mais check-ins, diários e questionários você registrar, mais clara fica a leitura do seu mês.`

  // 8.2 Padrões
  const patterns: string[] = []
  if (a.weekly.hasData) patterns.push(...a.weekly.lines.slice(0, 2))
  if (a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade')) patterns.push('Energia baixa esteve associada a ansiedade percebida mais alta em vários dias.')
  const nightNeg = a.periods.find(p => p.key === 'noite' && p.dominant && NEGATIVE_MOODS.has(p.dominant))
  if (nightNeg) patterns.push(`À noite apareceram mais registros de ${nightNeg.dominant!.toLowerCase()}.`)
  if (a.triggers[0]) patterns.push(`O marcador "${a.triggers[0].tag}" apareceu junto de registros de ${(negativeTop ?? 'tensão').toLowerCase()}.`)
  if (patterns.length === 0) patterns.push('Ainda não há registros suficientes para identificar padrões claros. Continue registrando para que eles apareçam.')

  // 8.3 Emoções predominantes (interpretação cuidadosa)
  const predominantEmotions = top
    ? `A emoção mais frequente foi ${top.toLowerCase()}${a.topEmotions[1] ? `, seguida de ${a.topEmotions[1].label.toLowerCase()}` : ''}. ${negativeTop ? `${negativeTop} apareceu com frequência nos seus registros — o que pode sugerir necessidade de pausas antes de chegar ao limite.` : 'Isso mostra momentos de mais leveza ao longo do mês.'}`
    : 'Ainda não há emoções registradas o suficiente para uma leitura predominante.'

  // 8.4 Energia, ansiedade e sono
  const parts: string[] = [a.energyAnxiety.text]
  if (a.avg.sleep > 0) parts.push(`A qualidade do sono ficou em torno de ${a.avg.sleep}/5 no período.`)
  const energyAnxietySleep = parts.join(' ')

  // 8.5 Gatilhos
  const triggersText = a.triggers.length > 0
    ? `Os marcadores mais citados foram ${a.triggers.slice(0, 3).map(t => t.tag).join(', ')}. Eles aparecem ligados a registros de ${(negativeTop ?? 'tensão emocional').toLowerCase()}.`
    : 'Ainda não há gatilhos registrados. Anotar o que aconteceu antes de um registro difícil ajuda a percebê-los.'

  // 8.6 Dias de atenção (pior humor / maior ansiedade)
  const anxByDay = new Map(a.anxietyByDay.map(d => [d.day, d.value]))
  const attentionDays = [...a.calendar]
    .map(c => ({ day: c.day, score: (5 - c.avg) + (anxByDay.get(c.day) ?? 0) / 2, avg: c.avg }))
    .filter(c => c.avg > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map(c => ({ day: c.day, reason: `humor mais baixo${anxByDay.has(c.day) ? ' e ansiedade mais alta' : ''}` }))

  // 8.7 Momentos de melhora
  const bestDay = [...a.calendar].filter(c => c.avg > 0).sort((x, y) => y.avg - x.avg)[0]
  const posCount = a.topEmotions.filter(e => POSITIVE_MOODS.has(e.label)).reduce((n, e) => n + e.count, 0)
  const improvementMoments = posCount > 0
    ? `Apesar dos momentos difíceis, também houve ${posCount} registro(s) de bem-estar ou tranquilidade${bestDay ? `, com destaque para o dia ${bestDay.day}` : ''}. Esses momentos mostram caminhos que podem ser fortalecidos.`
    : 'Neste mês apareceram poucos registros de bem-estar. Perceber pequenos momentos leves — e anotá-los — ajuda a fortalecê-los.'

  // 8.8 Comparação mensal
  const monthlyComparison: string[] = []
  if (a.prev.mood > 0 || a.prev.anxiety > 0 || a.prev.energy > 0) {
    if (a.prev.anxiety > 0 && a.avg.anxiety > 0) { const p = pct(a.avg.anxiety, a.prev.anxiety); monthlyComparison.push(`A ansiedade percebida ${p <= 0 ? 'ficou menor' : 'ficou maior'} do que no mês anterior${Math.abs(p) >= 5 ? ` (${p > 0 ? '+' : ''}${p}%)` : ''}.`) }
    if (a.prev.energy > 0 && a.avg.energy > 0) { const p = pct(a.avg.energy, a.prev.energy); monthlyComparison.push(`A energia média ${p >= 0 ? 'subiu' : 'caiu'} em relação ao mês anterior${Math.abs(p) >= 5 ? ` (${p > 0 ? '+' : ''}${p}%)` : ''}.`) }
    if (a.prev.diaryCount || a.prev.checkinCount) monthlyComparison.push(`Você fez ${a.checkinCount} check-ins e ${a.diaryCount} diários (mês anterior: ${a.prev.checkinCount} e ${a.prev.diaryCount}).`)
  } else {
    monthlyComparison.push('Este é o primeiro mês com dados suficientes. A partir dos próximos registros, será possível comparar sua evolução.')
  }

  // 8.11 Perguntas de reflexão
  const reflectionQuestions = [
    negativeTop ? `O que costuma acontecer antes dos dias de mais ${negativeTop.toLowerCase()}?` : 'O que costuma acontecer nos seus dias mais difíceis?',
    'Quais pausas realmente ajudaram neste mês?',
    a.triggers[0] ? `Como o marcador "${a.triggers[0].tag}" apareceu no seu dia a dia?` : 'Que tipo de cobrança apareceu com mais frequência?',
    'O que você gostaria de repetir no próximo mês?',
  ]

  // 8.10 Plano de autocuidado sugerido
  const selfCarePlan: SelfCarePlan = {
    priority: negativeTop === 'Sobrecarga' ? 'Reduzir a sobrecarga e criar pequenas pausas.' : negativeTop === 'Ansiedade' ? 'Criar momentos de regulação antes do acúmulo de ansiedade.' : 'Fortalecer os momentos de descanso e leveza.',
    mainCare: 'Inserir micro-pausas de 3 minutos nos dias de maior cobrança.',
    practice: 'Fazer um check-in no meio do dia para perceber energia e ansiedade antes do acúmulo.',
    attention: a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? 'Observar quando a ansiedade aparece junto de baixa energia.' : 'Observar os horários em que os registros ficam mais pesados.',
    commitment: 'Escolher um momento fixo da semana para revisar seus registros.',
    checkin: 'Registrar como você está antes e depois das pausas.',
  }

  // 8.12 Síntese para orientação
  const guidanceSynthesis = hasEnoughData
    ? `Neste mês, os registros indicam ${(negativeTop ?? top ?? 'oscilações emocionais').toLowerCase()} com frequência${a.triggers[0] ? `, principalmente associada a "${a.triggers[0].tag}"` : ''}${a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? ' e baixa energia' : ''}. Também aparecem sinais de melhora quando houve pausas e menor sobrecarga. O ponto principal para orientação parece ser como criar pequenas pausas antes do acúmulo emocional.`
    : `Ainda há poucos registros neste mês. Uma primeira leitura sugere começar observando ${(negativeTop ?? 'como você tem se sentido').toLowerCase()} e registrar com mais frequência para uma orientação mais precisa.`

  // Tags para recomendação de conteúdo (gatilhos + emoções negativas)
  const recommendTags = [...new Set([
    ...a.triggers.map(t => t.tag),
    ...a.topEmotions.filter(e => NEGATIVE_MOODS.has(e.label)).map(e => e.label),
  ])]

  return {
    hasEnoughData, summary, patterns, predominantEmotions, energyAnxietySleep, triggersText,
    attentionDays, improvementMoments, monthlyComparison, reflectionQuestions, guidanceSynthesis, selfCarePlan, recommendTags,
  }
}

// ── Análises reutilizáveis (semana e mês) ─────────────────────────────────────
function negTopOf(a: EmotionalAnalysis): string | null {
  return a.topEmotions.find(e => NEGATIVE_MOODS.has(e.label))?.label ?? null
}

/** Padrões detectados no período (3–5). Usado no semanal e como base do mensal. */
export function derivePatterns(a: EmotionalAnalysis): string[] {
  const out: string[] = []
  const neg = negTopOf(a)
  if (a.weekdayInsight) out.push(a.weekdayInsight)
  const night = a.periods.find(p => p.key === 'noite' && p.dominant && NEGATIVE_MOODS.has(p.dominant))
  if (night) out.push(`Registros à noite trouxeram mais ${night.dominant!.toLowerCase()}.`)
  if (a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade')) out.push('Energia baixa apareceu junto de ansiedade percebida mais alta em vários registros.')
  if (a.triggers[0]) out.push(`O marcador "${a.triggers[0].tag}" apareceu junto de registros de ${(neg ?? 'tensão').toLowerCase()}.`)
  const positive = a.topEmotions.filter(e => POSITIVE_MOODS.has(e.label)).reduce((n, e) => n + e.count, 0)
  if (positive > 0 && a.triggers.length <= 1) out.push('Momentos de tranquilidade apareceram mais em dias com menos gatilhos.')
  if (neg && out.length < 3) out.push(`${neg} apareceu com mais frequência nas suas anotações.`)
  return [...new Set(out)].slice(0, 5)
}

/** Pontos de atenção do período (2–4). */
export function deriveAttentionPoints(a: EmotionalAnalysis): string[] {
  const out: string[] = []
  const neg = negTopOf(a)
  if (a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade')) out.push('Observe os dias em que ansiedade e energia baixa aparecem juntas.')
  const sensitive = [...a.periods].filter(p => p.count > 0 && p.dominant && NEGATIVE_MOODS.has(p.dominant)).sort((x, y) => y.avgAnxiety - x.avgAnxiety)[0]
  if (sensitive) out.push(`Acompanhe se a ${sensitive.label.toLowerCase()} continua sendo o período mais sensível.`)
  if (neg === 'Sobrecarga') out.push('Tente registrar o gatilho quando perceber sobrecarga.')
  else if (a.triggers[0]) out.push(`Perceba se ${(neg ?? 'a tensão').toLowerCase()} aparece mais em dias ligados a "${a.triggers[0].tag}".`)
  if (out.length === 0) out.push('Continue registrando check-ins e diários para que os pontos de atenção fiquem mais claros.')
  return out.slice(0, 4)
}

/** Momentos positivos do período. */
export function deriveImprovement(a: EmotionalAnalysis): string {
  const positive = a.topEmotions.filter(e => POSITIVE_MOODS.has(e.label)).reduce((n, e) => n + e.count, 0)
  const best = [...a.calendar].filter(c => c.avg > 0).sort((x, y) => y.avg - x.avg)[0]
  if (positive > 0) return `Houve ${positive} registro(s) de tranquilidade ou bem-estar${best ? `, com destaque para o dia ${best.day}` : ''}. Esses momentos podem indicar caminhos que valem ser repetidos.`
  return 'Ainda há poucos registros positivos para identificar momentos de melhora, mas você pode começar a observar quando se sente um pouco melhor.'
}

/** Relações percebidas entre os dados (cruzamentos). §6.4 */
export function deriveRelations(a: EmotionalAnalysis): string[] {
  const out: string[] = []
  const neg = negTopOf(a)
  if (a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade')) out.push('Nos dias em que a energia apareceu mais baixa, a ansiedade percebida também tendeu a ser mais alta — seu estado emocional parece mais sensível quando há menos recuperação.')
  if (a.triggers[0]) out.push(`O gatilho "${a.triggers[0].tag}" apareceu ligado a registros de ${(neg ?? 'tensão').toLowerCase()}.`)
  const night = a.periods.find(p => p.key === 'noite')
  if (night && night.avgAnxiety >= 3.5) out.push('Check-ins à noite trouxeram, em média, ansiedade percebida mais alta.')
  if (a.weekdayInsight) out.push(a.weekdayInsight)
  if (a.avg.sleep > 0 && a.avg.energy > 0 && a.avg.sleep < 3 && a.avg.energy < 3) out.push('Sono e energia mais baixos apareceram no mesmo período — o descanso pode estar pesando na disposição.')
  if (out.length === 0) return ['Ainda não há dados suficientes para identificar relações claras entre energia, ansiedade e gatilhos.']
  return [...new Set(out)].slice(0, 4)
}

/** Linha narrativa do mês: início / meio / fim. §6.2 */
export function deriveNarrative(a: EmotionalAnalysis): { phase: string; text: string }[] {
  const days = a.calendar.filter(c => c.avg > 0)
  if (days.length < 4) return []
  const anxByDay = new Map(a.anxietyByDay.map(d => [d.day, d.value]))
  const thirds: { phase: string; days: typeof days }[] = [
    { phase: 'Início do mês', days: days.filter(c => c.day <= 10) },
    { phase: 'Meio do mês', days: days.filter(c => c.day >= 11 && c.day <= 20) },
    { phase: 'Fim do mês', days: days.filter(c => c.day >= 21) },
  ]
  const describe = (ds: typeof days): string => {
    if (ds.length === 0) return ''
    const mood = avg(ds.map(d => d.avg))
    const anx = avg(ds.map(d => anxByDay.get(d.day) ?? 0).filter(v => v > 0))
    const tone = mood >= 3.5 ? 'dias mais leves' : mood <= 2.2 ? 'dias mais difíceis' : 'oscilação emocional'
    const anxTxt = anx >= 3.5 ? ', com ansiedade percebida mais presente' : anx > 0 && anx <= 2 ? ', com ansiedade mais suave' : ''
    return `${ds.length} dia(s) com registro, ${tone}${anxTxt}.`
  }
  return thirds.filter(t => t.days.length > 0).map(t => ({ phase: t.phase, text: describe(t.days) }))
}
