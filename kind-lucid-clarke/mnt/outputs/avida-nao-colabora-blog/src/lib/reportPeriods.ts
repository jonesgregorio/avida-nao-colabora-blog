// ─────────────────────────────────────────────────────────────────────────────
// Ciclos de relatório (§21).
//   Semanal: domingo → sábado; disponível no domingo seguinte.
//   Mensal:  dia 1 → último dia; disponível no dia 1 do mês seguinte.
//   1ª assinatura no meio do ciclo: o 1º relatório começa na data de ativação.
//
// Datas tratadas como CALENDÁRIO (YYYY-MM-DD), no fuso do usuário (America/
// São_Paulo para o público-alvo). Sem horário — evita erros de timezone.
// ─────────────────────────────────────────────────────────────────────────────

export type ReportType = 'weekly' | 'monthly'

export interface Period {
  start: string       // YYYY-MM-DD (inclusive)
  end: string         // YYYY-MM-DD (inclusive)
  availableAt: string // YYYY-MM-DD — a partir de quando o relatório fica disponível
  clampedToActivation: boolean // true se o início foi cortado pela data de ativação
}

/**
 * Define o corte do primeiro ciclo sem depender da renovação atual.
 * `current_period_start` muda a cada cobrança e não é ativação original.
 */
export function resolveReportActivation({
  planActivatedAt,
  subscriptionCreatedAt,
  profileCreatedAt,
}: {
  planActivatedAt?: string | null
  subscriptionCreatedAt?: string | null
  profileCreatedAt?: string | null
}): string | null {
  return planActivatedAt ?? subscriptionCreatedAt ?? profileCreatedAt ?? null
}

// ── Helpers de calendário — sempre America/Sao_Paulo ─────────────────────────
export const REPORT_TIME_ZONE = 'America/Sao_Paulo'
function atNoon(y: number, m: number, d: number): Date { return new Date(Date.UTC(y, m, d, 12, 0, 0, 0)) }
function saoPauloParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value || 0)
  return { year: get('year'), month: get('month'), day: get('day') }
}
export function ymd(date: Date): string {
  const { year, month, day } = saoPauloParts(date)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return atNoon(y, m - 1, d)
}
function addDays(s: string, n: number): string {
  const d = parseYmd(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d)
}
function cmp(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0 }

// ── Períodos "cheios" (sem ativação) ──────────────────────────────────────────
// Semana que contém `date` (domingo → sábado).
function weekBounds(date: Date): { start: string; end: string } {
  const calendarDate = parseYmd(ymd(date))
  const dow = calendarDate.getUTCDay() // 0=domingo
  const sunday = atNoon(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth(), calendarDate.getUTCDate() - dow)
  const saturday = atNoon(sunday.getUTCFullYear(), sunday.getUTCMonth(), sunday.getUTCDate() + 6)
  return { start: ymd(sunday), end: ymd(saturday) }
}
// Mês que contém `date`.
function monthBounds(date: Date): { start: string; end: string } {
  const calendarDate = parseYmd(ymd(date))
  const start = atNoon(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth(), 1)
  const end = atNoon(calendarDate.getUTCFullYear(), calendarDate.getUTCMonth() + 1, 0) // dia 0 do mês seguinte = último dia
  return { start: ymd(start), end: ymd(end) }
}
function boundsFor(type: ReportType, date: Date) {
  return type === 'weekly' ? weekBounds(date) : monthBounds(date)
}

/** Data em que o relatório de um período fica disponível: sempre fim + 1 dia. */
export function getReportAvailabilityDate(periodEnd: string): string {
  return addDays(periodEnd, 1)
}

/** true se, em `now`, o relatório do período que termina em `periodEnd` já pode existir. */
export function shouldGenerateReport(periodEnd: string, now = new Date()): boolean {
  return cmp(ymd(now), getReportAvailabilityDate(periodEnd)) >= 0
}

// Normaliza a data de ativação para YYYY-MM-DD (aceita ISO/date/undefined).
export function activationYmd(activation: string | null | undefined): string | null {
  if (!activation) return null
  const d = new Date(activation)
  return Number.isNaN(d.getTime()) ? null : ymd(d)
}

// ── Período ATUAL (em construção) ─────────────────────────────────────────────
export function getCurrentPeriod(type: ReportType, activation: string | null, now = new Date()): Period {
  const b = boundsFor(type, now)
  const act = activationYmd(activation)
  const clamped = !!act && cmp(act, b.start) > 0 && cmp(act, b.end) <= 0
  return {
    start: clamped ? act! : b.start,
    end: b.end,
    availableAt: getReportAvailabilityDate(b.end),
    clampedToActivation: clamped,
  }
}
export const getCurrentWeeklyPeriod = (act: string | null, now = new Date()) => getCurrentPeriod('weekly', act, now)
export const getCurrentMonthlyPeriod = (act: string | null, now = new Date()) => getCurrentPeriod('monthly', act, now)

// ── Último período FECHADO e disponível ───────────────────────────────────────
// Retorna null se o usuário ainda não tem nenhum período fechado (ativou agora).
export function getLastClosedPeriod(type: ReportType, activation: string | null, now = new Date()): Period | null {
  const cur = boundsFor(type, now)
  // referência 1 dia antes do início do período atual → cai no período anterior
  const prevRef = parseYmd(addDays(cur.start, -1))
  const b = boundsFor(type, prevRef)
  const availableAt = getReportAvailabilityDate(b.end)
  if (cmp(ymd(now), availableAt) < 0) return null // ainda não disponível
  const act = activationYmd(activation)
  if (act && cmp(act, b.end) > 0) return null // ativou depois deste período → sem relatório fechado ainda
  const clamped = !!act && cmp(act, b.start) > 0
  return {
    start: clamped ? act! : b.start,
    end: b.end,
    availableAt,
    clampedToActivation: clamped,
  }
}
export const getPreviousWeeklyPeriod = (act: string | null, now = new Date()) => getLastClosedPeriod('weekly', act, now)
export const getPreviousMonthlyPeriod = (act: string | null, now = new Date()) => getLastClosedPeriod('monthly', act, now)

// ── Rótulos para a interface ──────────────────────────────────────────────────
export function formatPeriodShort(p: { start: string; end: string }): string {
  const s = parseYmd(p.start), e = parseYmd(p.end)
  const f = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  return `${f(s)} a ${f(e)}`
}
export function formatDateBR(s: string): string {
  const d = parseYmd(s)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}
export function monthTitle(s: string): string {
  return parseYmd(s).toLocaleString('pt-BR', { timeZone: REPORT_TIME_ZONE, month: 'long', year: 'numeric' })
}
export function periodKey(type: ReportType, p: { start: string; end: string }): string {
  return `${type}:${p.start}:${p.end}`
}
