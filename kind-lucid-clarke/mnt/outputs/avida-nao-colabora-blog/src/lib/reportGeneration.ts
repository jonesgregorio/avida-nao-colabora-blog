// ─────────────────────────────────────────────────────────────────────────────
// Geração e persistência de relatórios FECHADOS (§8, §13, §14).
// - Relatório em construção = calculado ao vivo (não salvo).
// - Relatório fechado = gerado no 1º acesso após available_at e salvo em `reports`
//   (dedupe por unique(user_id, report_type, period_start, period_end)).
// Linguagem de autopercepção — nunca diagnóstica.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { computeEmotionalAnalysis, buildDeepReport, type DiaryRowLite, type EmotionalAnalysis, type DeepReport } from './emotionalAnalytics'
import { formatPeriodShort, monthTitle, type ReportType, type Period } from './reportPeriods'

const NEGATIVE = new Set(['Ansiedade', 'Sobrecarga', 'Tristeza', 'Irritação', 'Desânimo', 'Cansaço', 'Sem energia'])

// Versão do formato do conteúdo. Ao subir (novos blocos/gráficos), relatórios
// fechados antigos são REGERADOS no próximo acesso para refletir a melhoria.
const CONTENT_VERSION = 2

export interface DayPoint { day: number; value: number }

export interface WeeklyContent {
  kind: 'weekly'
  v?: number
  hasEnoughData: boolean
  summary: string
  interpretation: string
  topEmotions: { label: string; count: number; emoji: string }[]
  avgEnergy: number
  avgAnxiety: number
  avgMood: number
  triggers: { tag: string; count: number }[]
  comparison: string[]
  nextSteps: string[]
  recommendTags: string[]
  // Gráficos de síntese + dados principais (§6.3/§6.4)
  energyByDay: DayPoint[]
  anxietyByDay: DayPoint[]
  checkinCount: number
  diaryCount: number
  dominantEmotion: string | null
  topTrigger: string | null
}

export interface MonthlyContent extends DeepReport {
  kind: 'monthly'
  v?: number
  avgEnergy: number
  avgAnxiety: number
  avgSleep: number
  topEmotions: { label: string; count: number; emoji: string }[]
  topTriggers: { tag: string; count: number }[]
  // Gráficos de síntese (§7.10)
  energyByDay: DayPoint[]
  anxietyByDay: DayPoint[]
  checkinCount: number
  diaryCount: number
}

export type ReportContent = WeeklyContent | MonthlyContent

export interface StoredReport {
  id?: string
  report_type: ReportType
  plan_required: string
  period_start: string
  period_end: string
  available_at: string
  generated_at?: string
  status: string
  title: string
  summary: string
  content: ReportContent
}

// ── Builders de conteúdo ──────────────────────────────────────────────────────
export function buildWeeklyContent(analysis: EmotionalAnalysis): WeeklyContent {
  const a = analysis
  const hasEnoughData = a.totalEntries >= 3
  const negativeTop = a.topEmotions.find(e => NEGATIVE.has(e.label))?.label
  const top = a.topEmotions[0]?.label
  const summary = hasEnoughData
    ? `Nesta semana, seus registros indicam maior presença de ${(negativeTop ?? top ?? 'algumas emoções').toLowerCase()}${a.triggers[0] ? `, muitas vezes ligada a "${a.triggers[0].tag}"` : ''}. ${a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? 'A energia média ficou mais baixa nos dias com mais registros de tensão.' : 'Também apareceram momentos de mais leveza ao longo dos dias.'}`
    : (a.totalEntries === 0
      ? 'Não encontramos registros suficientes nesta semana. Continue usando check-ins e diário para que o próximo relatório tenha mais informações.'
      : 'Ainda há poucos registros nesta semana para uma leitura mais precisa. Mesmo assim, alguns sinais iniciais aparecem nos seus check-ins.')
  // Interpretação da semana (§6.5) — autopercepção, sem diagnóstico.
  const interpretation = hasEnoughData
    ? `Seus registros sugerem que os momentos de maior ${(negativeTop ?? 'tensão').toLowerCase()} apareceram ${a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? 'junto de baixa energia e sensação de sobrecarga' : 'em alguns momentos da semana'}${a.triggers[0] ? `, muitas vezes ligados a "${a.triggers[0].tag}"` : ''}. Pode ser útil perceber esses sinais antes do acúmulo — pequenas pausas ao longo do dia ajudam.`
    : 'Ainda há poucos registros para uma leitura mais precisa desta semana. Cada check-in ajuda a revelar seus padrões com mais clareza.'
  return {
    kind: 'weekly', v: CONTENT_VERSION, hasEnoughData, summary, interpretation,
    topEmotions: a.topEmotions.slice(0, 5),
    avgEnergy: a.avg.energy, avgAnxiety: a.avg.anxiety, avgMood: a.avg.mood,
    triggers: a.triggers.slice(0, 5), comparison: a.weekly.lines,
    nextSteps: ['Fazer um check-in no meio do dia', 'Registrar diário em dias de maior sobrecarga', 'Ler um conteúdo guiado recomendado', 'Acompanhar o padrão no Mapa Emocional'],
    recommendTags: [...new Set([...a.triggers.map(t => t.tag), ...a.topEmotions.filter(e => NEGATIVE.has(e.label)).map(e => e.label)])],
    energyByDay: a.energyByDay, anxietyByDay: a.anxietyByDay,
    checkinCount: a.checkinCount, diaryCount: a.diaryCount,
    dominantEmotion: a.topEmotions[0]?.label ?? null, topTrigger: a.triggers[0]?.tag ?? null,
  }
}

export function buildMonthlyContent(analysis: EmotionalAnalysis, periodLabel: string): MonthlyContent {
  const deep = buildDeepReport(analysis, periodLabel)
  return {
    ...deep, kind: 'monthly', v: CONTENT_VERSION,
    avgEnergy: analysis.avg.energy, avgAnxiety: analysis.avg.anxiety, avgSleep: analysis.avg.sleep,
    topEmotions: analysis.topEmotions.slice(0, 6), topTriggers: analysis.triggers.slice(0, 6),
    energyByDay: analysis.energyByDay, anxietyByDay: analysis.anxietyByDay,
    checkinCount: analysis.checkinCount, diaryCount: analysis.diaryCount,
  }
}

// Constrói o relatório (não salva) a partir dos registros do período.
export function buildReport(
  type: ReportType, plan: string, period: Period,
  entries: DiaryRowLite[], prevEntries: DiaryRowLite[],
): StoredReport {
  const analysis = computeEmotionalAnalysis(entries, prevEntries)
  if (type === 'weekly') {
    const content = buildWeeklyContent(analysis)
    return {
      report_type: 'weekly', plan_required: 'essential',
      period_start: period.start, period_end: period.end, available_at: period.availableAt,
      status: 'generated', title: `Relatório semanal — ${formatPeriodShort(period)}`,
      summary: content.summary, content,
    }
  }
  const label = monthTitle(period.start)
  const content = buildMonthlyContent(analysis, label)
  return {
    report_type: 'monthly', plan_required: 'plus',
    period_start: period.start, period_end: period.end, available_at: period.availableAt,
    status: 'generated', title: `Relatório mensal aprofundado de ${label}`,
    summary: content.summary, content,
  }
}

// ── Persistência com dedupe (§13/§14) ─────────────────────────────────────────
export async function ensureClosedReport(
  userId: string, type: ReportType, plan: string, period: Period,
  entries: DiaryRowLite[], prevEntries: DiaryRowLite[],
): Promise<StoredReport | null> {
  // 1) Já existe para este período? (unique impede duplicados)
  const { data: existing } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', userId)
    .eq('report_type', type)
    .eq('period_start', period.start)
    .eq('period_end', period.end)
    .maybeSingle()

  if (existing) {
    const stored = existing as unknown as StoredReport
    const storedV = (stored.content as { v?: number })?.v ?? 1
    // Conteúdo atualizado → devolve como está.
    if (storedV >= CONTENT_VERSION) return stored
    // Conteúdo antigo (sem gráficos/interpretação) → REGERA e atualiza a linha,
    // mantendo a data de geração original.
    const fresh = buildReport(type, plan, period, entries, prevEntries)
    const { data: upd } = await supabase.from('reports')
      .update({ title: fresh.title, summary: fresh.summary, content: fresh.content, updated_at: new Date().toISOString() })
      .eq('id', stored.id!)
      .select('*')
      .maybeSingle()
    return (upd as unknown as StoredReport) ?? { ...stored, title: fresh.title, summary: fresh.summary, content: fresh.content }
  }

  // 2) Gera e salva. onConflict ignora corrida (dois acessos simultâneos).
  const report = buildReport(type, plan, period, entries, prevEntries)
  const { data, error } = await supabase
    .from('reports')
    .upsert({
      user_id: userId,
      report_type: report.report_type,
      plan_required: report.plan_required,
      period_start: report.period_start,
      period_end: report.period_end,
      available_at: report.available_at,
      status: 'generated',
      title: report.title,
      summary: report.summary,
      content: report.content,
      generated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,report_type,period_start,period_end', ignoreDuplicates: false })
    .select('*')
    .maybeSingle()
  if (error) {
    // Se falhar por corrida, tenta reler.
    const { data: again } = await supabase.from('reports').select('*')
      .eq('user_id', userId).eq('report_type', type)
      .eq('period_start', period.start).eq('period_end', period.end).maybeSingle()
    return (again as unknown as StoredReport) ?? report
  }
  return (data as unknown as StoredReport) ?? report
}

export async function loadReportHistory(userId: string, type?: ReportType): Promise<StoredReport[]> {
  let q = supabase.from('reports').select('*').eq('user_id', userId).order('period_end', { ascending: false }).limit(60)
  if (type) q = q.eq('report_type', type)
  const { data } = await q
  return (data as unknown as StoredReport[]) ?? []
}
