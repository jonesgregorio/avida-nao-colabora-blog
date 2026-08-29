// ─────────────────────────────────────────────────────────────────────────────
// Geração e persistência de relatórios FECHADOS (§8, §13, §14).
// - Relatório em construção = calculado ao vivo (não salvo).
// - Relatório fechado = gerado no 1º acesso após available_at e salvo em `reports`
//   (dedupe por unique(user_id, report_type, period_start, period_end)).
// Linguagem de autopercepção — nunca diagnóstica.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import {
  computeEmotionalAnalysis, buildDeepReport,
  derivePatterns, deriveAttentionPoints, deriveImprovement, deriveRelations, deriveNarrative,
  type DiaryRowLite, type EmotionalAnalysis, type DeepReport,
} from './emotionalAnalytics'
import {
  deriveWeeklyInterpretationFallback,
  deriveWeeklyPatternsFallback,
  normalizeWeeklyNarrative,
} from './weeklyReportNarrative'
import { formatPeriodShort, monthTitle, type ReportType, type Period } from './reportPeriods'

const NEGATIVE = new Set(['Ansiedade', 'Sobrecarga', 'Tristeza', 'Irritação', 'Desânimo', 'Cansaço', 'Sem energia'])

// Versão do formato do conteúdo. Ela serve para consumidores e futuras
// regenerações administrativas. Um relatório pronto é um registro histórico e
// jamais é sobrescrito automaticamente ao abrir a página.
const CONTENT_VERSION = 7

export interface DayPoint { day: number; value: number }

export interface WeeklyContent {
  kind: 'weekly'
  v?: number
  hasEnoughData: boolean
  summary: string
  interpretation: string
  patterns: string[]
  attentionPoints: string[]
  improvementMoments: string
  topEmotions: { label: string; count: number; emoji: string }[]
  avgEnergy: number
  avgAnxiety: number
  avgMood: number
  emotionalMarkers: { tag: string; count: number }[]
  /** Compatibilidade com relatórios fechados antes da versão 7. */
  triggers?: { tag: string; count: number }[]
  // §14.1: contextos que mais apareceram na semana.
  topContexts: { tag: string; count: number }[]
  comparison: string[]
  nextSteps: string[]
  recommendTags: string[]
  // Gráficos de síntese + dados principais (§6.3/§6.4)
  energyByDay: DayPoint[]
  anxietyByDay: DayPoint[]
  checkinCount: number
  diaryCount: number
  dominantEmotion: string | null
  topEmotionalMarker: string | null
  /** Compatibilidade com relatórios fechados antes da versão 7. */
  topTrigger?: string | null
  /** Metadado existente nos relatórios v10 gerados pela automação. */
  data_quality?: {
    has_enough_data?: boolean
    total_entries?: number
    active_days?: number
    message?: string
  }
  /** Somente apresentação: anexado ao carregar o relatório; nunca é persistido. */
  __view_period?: { start: string; end: string }
}

export interface MonthlyContent extends Omit<DeepReport, 'bridgeToSelfCarePlan' | 'bridgeToProfessionalGuidance'> {
  kind: 'monthly'
  v?: number
  narrative: { phase: string; text: string }[]
  relations: string[]
  avgEnergy: number
  avgAnxiety: number
  avgSleep: number
  topEmotions: { label: string; count: number; emoji: string }[]
  topEmotionalMarkers: { tag: string; count: number }[]
  /** Compatibilidade com relatórios fechados antes da versão 7. */
  topTriggers?: { tag: string; count: number }[]
  /** Compatibilidade com relatórios fechados antes do rótulo de marcadores. */
  triggersText?: string
  // §14.2: contextos e necessidades mais recorrentes do mês.
  topContexts: { tag: string; count: number }[]
  topNeeds: { tag: string; count: number }[]
  /** Gatilhos reais vêm somente de `trigger_tags` e existem apenas no Plus. */
  realTriggers: { tag: string; count: number }[]
  // Gráficos de síntese (§7.10)
  energyByDay: DayPoint[]
  anxietyByDay: DayPoint[]
  checkinCount: number
  diaryCount: number
  /** Pontes curtas; o plano e a orientação permanecem em suas próprias áreas. */
  bridgeToSelfCarePlan?: string
  bridgeToProfessionalGuidance?: string
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

function normalizeStoredReport(report: StoredReport): StoredReport {
  if (report.content?.kind !== 'weekly') return report
  const normalized = normalizeWeeklyNarrative(report.content as WeeklyContent)
  return {
    ...report,
    content: {
      ...normalized,
      // Metadado efêmero usado pela retrospectiva para ligar o foco à semana
      // correta. Não há UPDATE/INSERT aqui e o histórico salvo permanece intacto.
      __view_period: { start: report.period_start, end: report.period_end },
    },
  }
}

// ── Builders de conteúdo ──────────────────────────────────────────────────────
export function buildWeeklyContent(analysis: EmotionalAnalysis): WeeklyContent {
  const a = analysis
  const hasEnoughData = a.totalEntries >= 3
  const hasInterpretationData = a.totalEntries >= 3 && a.activeDays >= 2
  const hasPatternData = a.totalEntries >= 4 && a.activeDays >= 2
  const negativeTop = a.topEmotions.find(e => NEGATIVE.has(e.label))?.label
  const top = a.topEmotions[0]?.label
  const summary = hasEnoughData
    ? `Nesta semana, seus registros indicam maior presença de ${(negativeTop ?? top ?? 'algumas emoções').toLowerCase()}${a.emotionalMarkers[0] ? `, muitas vezes ligada a "${a.emotionalMarkers[0].tag}"` : ''}. ${a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? 'A energia média ficou mais baixa nos dias com mais registros de tensão.' : 'Também apareceram momentos de mais leveza ao longo dos dias.'}`
    : (a.totalEntries === 0
      ? 'Não encontramos registros suficientes nesta semana. Continue usando check-ins e diário para que o próximo relatório tenha mais informações.'
      : 'Ainda há poucos registros nesta semana para uma leitura mais precisa. Mesmo assim, alguns sinais iniciais aparecem nos seus check-ins.')

  const narrativeBase = {
    topEmotions: a.topEmotions.slice(0, 5),
    emotionalMarkers: a.emotionalMarkers.slice(0, 5),
    topContexts: a.contexts.slice(0, 5),
    avgEnergy: a.avg.energy,
    avgAnxiety: a.avg.anxiety,
    energyByDay: a.energyByDay,
    anxietyByDay: a.anxietyByDay,
    checkinCount: a.checkinCount,
    diaryCount: a.diaryCount,
    data_quality: { total_entries: a.totalEntries, active_days: a.activeDays },
  }

  // Cada bloco tem critério próprio. Ter dados suficientes para um resumo não
  // significa automaticamente ter recorrência suficiente para chamar algo de padrão.
  const interpretation = hasInterpretationData
    ? `Seus registros sugerem que os momentos de maior ${(negativeTop ?? 'tensão').toLowerCase()} apareceram ${a.energyAnxiety.hasData && a.energyAnxiety.text.includes('mais intensidade') ? 'junto de baixa energia e sensação de sobrecarga' : 'em alguns momentos da semana'}${a.emotionalMarkers[0] ? `, muitas vezes ligados a "${a.emotionalMarkers[0].tag}"` : ''}. Pode ser útil perceber esses sinais antes do acúmulo — pequenas pausas ao longo do dia ajudam.`
    : deriveWeeklyInterpretationFallback(narrativeBase)
  const patterns = hasPatternData
    ? derivePatterns(a)
    : deriveWeeklyPatternsFallback(narrativeBase)

  return normalizeWeeklyNarrative({
    kind: 'weekly', v: CONTENT_VERSION, hasEnoughData, summary, interpretation,
    patterns,
    attentionPoints: deriveAttentionPoints(a),
    improvementMoments: deriveImprovement(a),
    topEmotions: a.topEmotions.slice(0, 5),
    avgEnergy: a.avg.energy, avgAnxiety: a.avg.anxiety, avgMood: a.avg.mood,
    emotionalMarkers: a.emotionalMarkers.slice(0, 5), topContexts: a.contexts.slice(0, 5), comparison: a.weekly.lines,
    nextSteps: ['Fazer um check-in no meio do dia', 'Registrar diário em dias de maior sobrecarga', 'Ler um conteúdo guiado recomendado', 'Acompanhar o padrão no Mapa Emocional'],
    recommendTags: [...new Set([...a.emotionalMarkers.map(t => t.tag), ...a.topEmotions.filter(e => NEGATIVE.has(e.label)).map(e => e.label)])],
    energyByDay: a.energyByDay, anxietyByDay: a.anxietyByDay,
    checkinCount: a.checkinCount, diaryCount: a.diaryCount,
    dominantEmotion: a.topEmotions[0]?.label ?? null, topEmotionalMarker: a.emotionalMarkers[0]?.tag ?? null,
    data_quality: { total_entries: a.totalEntries, active_days: a.activeDays, has_enough_data: hasEnoughData },
  })
}

export function buildMonthlyContent(analysis: EmotionalAnalysis, periodLabel: string): MonthlyContent {
  const deep = buildDeepReport(analysis, periodLabel)
  const retrospective = { ...deep }
  return {
    ...retrospective, kind: 'monthly', v: CONTENT_VERSION,
    narrative: deriveNarrative(analysis),
    relations: deriveRelations(analysis),
    avgEnergy: analysis.avg.energy, avgAnxiety: analysis.avg.anxiety, avgSleep: analysis.avg.sleep,
    topEmotions: analysis.topEmotions.slice(0, 6), topEmotionalMarkers: analysis.emotionalMarkers.slice(0, 6),
    topContexts: analysis.contexts.slice(0, 6), topNeeds: analysis.needs.slice(0, 6),
    realTriggers: analysis.realTriggers.slice(0, 6),
    energyByDay: analysis.energyByDay, anxietyByDay: analysis.anxietyByDay,
    checkinCount: analysis.checkinCount, diaryCount: analysis.diaryCount,
    bridgeToSelfCarePlan: 'Com base nesta leitura, seu plano de autocuidado pode transformar um ponto de atenção em uma ação leve para o próximo ciclo.',
    bridgeToProfessionalGuidance: 'Se fizer sentido, leve um ponto deste mês para sua orientação mensal.',
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
    // O histórico permanece imutável no banco. A normalização abaixo é apenas
    // de apresentação e corrige fallbacks genéricos de relatórios v10 antigos.
    return normalizeStoredReport(stored)
  }

  // A geração foi movida para run-emotional-automations. Mantemos esta função
  // como compatibilidade de leitura para chamadas antigas, mas ela não deve
  // persistir nada no navegador nem fabricar um segundo conteúdo para o mesmo
  // período. A fonte de verdade é sempre a linha já salva no banco.
  void plan; void entries; void prevEntries; void period
  return null
}

export async function loadReportHistory(userId: string, type?: ReportType): Promise<StoredReport[]> {
  let q = supabase.from('reports').select('*').eq('user_id', userId).order('period_end', { ascending: false }).limit(60)
  if (type) q = q.eq('report_type', type)
  const { data } = await q
  return ((data as unknown as StoredReport[]) ?? []).map(normalizeStoredReport)
}
