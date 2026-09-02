import { useCallback, useEffect, useMemo, useState, type Ref } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, FileDown, RefreshCw, Sparkles } from 'lucide-react'
import type { DiaryEntry } from '../types'
import type { DiaryMirror } from '../lib/diaryCompanion'
import { loadDiaryMonth } from '../lib/diaryHistoryData'
import DiaryTagChip from './DiaryTagChip'

export type DiaryHistoryFilter = 'all' | 'checkin' | 'diary' | 'questionnaire'
export type DiaryHistoryPeriodFilter = 'all' | '7d' | '30d' | 'month'
type DiaryHistoryEntry = DiaryEntry & { ai_title?: string | null; ai_reflection?: DiaryMirror | null }

interface Props {
  sectionRef: Ref<HTMLElement>
  entries: DiaryHistoryEntry[]
  monthRows: DiaryHistoryEntry[]
  today: string
  exportPdfEnabled: boolean
  exporting: boolean
  filter: DiaryHistoryFilter
  periodFilter: DiaryHistoryPeriodFilter
  expandedId: string | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  getMoodMeta: (value: string | number | null | undefined) => { emoji: string; label: string }
  onExport: () => void
  onFilterChange: (filter: DiaryHistoryFilter) => void
  onPeriodFilterChange: (period: DiaryHistoryPeriodFilter) => void
  onExpandedChange: (id: string | null) => void
  onRefresh: () => void
  onLoadMore: () => void
}

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function hasMoodValue(mood: unknown) {
  const value = String(mood ?? '').trim().toLowerCase()
  return Boolean(value && value !== 'null' && value !== 'undefined')
}

function effectiveMoodLabel(mood: string | number | null | undefined, otherLabel: string | null | undefined) {
  const value = String(mood ?? '').trim()
  return value.toLowerCase() === 'outro' && otherLabel?.trim() ? otherLabel.trim() : value
}

function deriveTitle(entry: DiaryHistoryEntry) {
  if (entry.ai_title) return entry.ai_title
  const mood = effectiveMoodLabel(entry.mood, entry.mood_other_label)
  if (entry.entry_type === 'checkin') return mood ? `Check-in · ${mood}` : 'Check-in'
  const clean = String(entry.text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return mood ? `Registro · ${mood}` : 'Registro'
  const first = clean.split(/[.!?]/)[0] || clean
  return first.length > 68 ? `${first.slice(0, 68).trim()}…` : first
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split('-').map(Number)
  const next = new Date(year, month - 1 + amount, 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

function monthTitle(monthKey: string) {
  return new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function DiaryHistorySection(p: Props) {
  const { sectionRef, entries, monthRows, today, exportPdfEnabled, exporting, expandedId, getMoodMeta, onExport, onExpandedChange } = p
  const currentMonth = today.slice(0, 7)
  const userId = String(monthRows[0]?.user_id || entries[0]?.user_id || '')
  const [viewMonth, setViewMonth] = useState(currentMonth)
  const [visibleRows, setVisibleRows] = useState<DiaryHistoryEntry[]>(monthRows)
  const [selectedDate, setSelectedDate] = useState(today)
  const [monthLoading, setMonthLoading] = useState(false)

  // O calendário agora é o filtro de período do histórico. Os estados antigos
  // continuam no orquestrador por compatibilidade, mas não criam uma lista paralela.
  void p.filter
  void p.periodFilter
  void p.loading
  void p.loadingMore
  void p.hasMore
  void p.onFilterChange
  void p.onPeriodFilterChange
  void p.onLoadMore

  useEffect(() => {
    if (viewMonth !== currentMonth) return
    setVisibleRows(monthRows)
  }, [currentMonth, monthRows, viewMonth])

  const fetchViewedMonth = useCallback(async (monthKey: string) => {
    if (monthKey === currentMonth) {
      p.onRefresh()
      setVisibleRows(monthRows)
      return
    }
    if (!userId) {
      setVisibleRows([])
      return
    }
    setMonthLoading(true)
    try {
      setVisibleRows(await loadDiaryMonth(userId, monthKey) as DiaryHistoryEntry[])
    } finally {
      setMonthLoading(false)
    }
  }, [currentMonth, monthRows, p, userId])

  useEffect(() => {
    if (viewMonth === currentMonth) return
    if (!userId) { setVisibleRows([]); return }
    let cancelled = false
    setMonthLoading(true)
    void loadDiaryMonth(userId, viewMonth).then(rows => {
      if (!cancelled) setVisibleRows(rows as DiaryHistoryEntry[])
    }).finally(() => {
      if (!cancelled) setMonthLoading(false)
    })
    return () => { cancelled = true }
  }, [currentMonth, userId, viewMonth])

  const groupedHistory = useMemo(() => {
    const map = new Map<string, DiaryHistoryEntry[]>()
    for (const entry of visibleRows) {
      const date = String(entry.date || '').slice(0, 10)
      map.set(date, [...(map.get(date) || []), entry])
    }
    return map
  }, [visibleRows])

  useEffect(() => {
    const dates = [...groupedHistory.keys()].sort()
    if (viewMonth === currentMonth) {
      setSelectedDate(today)
      return
    }
    setSelectedDate(dates[dates.length - 1] || `${viewMonth}-01`)
  }, [currentMonth, groupedHistory, today, viewMonth])

  const moodByDay = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of visibleRows) {
      if (!hasMoodValue(row.mood)) continue
      map.set(String(row.date || '').slice(0, 10), getMoodMeta(row.mood).emoji)
    }
    return map
  }, [getMoodMeta, visibleRows])

  const selectedRows = groupedHistory.get(selectedDate) || []
  const activeDays = groupedHistory.size
  const daysInMonth = new Date(Number(viewMonth.slice(0, 4)), Number(viewMonth.slice(5, 7)), 0).getDate()
  const firstWeekday = new Date(`${viewMonth}-01T12:00:00`).getDay()
  const canGoNext = viewMonth < currentMonth

  return (
    <section ref={sectionRef}>
      <div className="relative mb-5 rounded-[2rem] border border-[#cfc2a8] bg-[#dfd3bc] p-2.5 sm:p-4 shadow-[0_24px_60px_rgba(53,69,54,0.14)]">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-[#ded3bf] bg-[#fffdf8]">
          <div aria-hidden className="pointer-events-none absolute inset-y-4 left-1/2 z-20 hidden w-7 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,rgba(101,81,54,0.13),rgba(255,255,255,0.72)_42%,rgba(255,255,255,0.88)_50%,rgba(101,81,54,0.16)_58%,rgba(101,81,54,0.05))] shadow-[0_0_18px_rgba(84,68,45,0.18)] lg:block" />
          <div className="grid lg:grid-cols-2">
            <div className="relative min-h-[540px] border-b border-[#e1d7c5] p-5 sm:p-7 lg:border-b-0 lg:border-r lg:border-[#d8cbb5] lg:pr-10">
              <div className="flex items-center justify-between gap-3" aria-label="Filtrar período do histórico">
                <button type="button" onClick={() => setViewMonth(value => shiftMonth(value, -1))} aria-label="Mês anterior" className="rounded-full border border-[#d9cebb] bg-white p-2 text-forest-800 hover:bg-[#f5efe3]"><ChevronLeft className="h-4 w-4" /></button>
                <div className="text-center"><p className="text-[10px] uppercase tracking-[0.16em] text-forest-600">Agenda do diário</p><h2 className="mt-1 font-serif text-2xl capitalize text-forest-900">{monthTitle(viewMonth)}</h2></div>
                <button type="button" disabled={!canGoNext} onClick={() => setViewMonth(value => shiftMonth(value, 1))} aria-label="Próximo mês" className="rounded-full border border-[#d9cebb] bg-white p-2 text-forest-800 hover:bg-[#f5efe3] disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>

              <h3 className="mt-5 font-serif text-2xl text-forest-900">Sua história deste mês, até aqui</h3>
              <p className="mt-2 text-sm text-ink-soft">{activeDays} {activeDays === 1 ? 'dia com registro' : 'dias com registros'}. Clique em uma data para abrir apenas aquela página.</p>
              <p className="mt-1 text-xs text-ink-soft">Sem pontuação, sem sequência para quebrar.</p>

              <div className="mt-6 grid grid-cols-7 gap-1.5">{['D','S','T','Q','Q','S','S'].map((day, index) => <span key={`${day}-${index}`} className="pb-1 text-center text-[9px] font-medium text-ink-soft">{day}</span>)}{Array.from({ length: firstWeekday }).map((_, index) => <span key={`blank-${index}`} />)}{Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const date = `${viewMonth}-${String(day).padStart(2, '0')}`
                const emoji = moodByDay.get(date)
                const hasEntries = groupedHistory.has(date)
                const selected = selectedDate === date
                const future = date > today
                return <button key={date} type="button" onClick={() => setSelectedDate(date)} aria-label={`${dayLabel(date)}${hasEntries ? ', com registro' : ', sem registro'}`} className={`relative aspect-square rounded-full border text-[11px] transition ${selected ? 'border-forest-900 bg-forest-900 text-white shadow-sm' : future ? 'border-transparent text-ink-soft/35' : hasEntries ? 'border-[#d9cebb] bg-[#f5efe3] text-forest-900 hover:border-forest-400' : 'border-transparent text-ink-soft hover:bg-[#f7f2e8]'}`}><span>{day}</span>{emoji && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none">{emoji}</span>}{hasEntries && !emoji && <span aria-hidden className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected ? 'bg-white' : 'bg-forest-600'}`} />}</button>
              })}</div>

              <div className="mt-6 rounded-2xl border border-[#e8dfcf] bg-[#faf6ec] p-4"><p className="font-serif text-lg text-forest-900">“Não é sobre preencher todos os dias.”</p><p className="mt-1 text-sm text-ink-soft">O calendário existe para reencontrar o que você viveu, não para cobrar presença.</p></div>
            </div>

            <div className="relative min-h-[540px] p-5 sm:p-7 lg:pl-10">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-[0.16em] text-forest-600 capitalize">{dayLabel(selectedDate)}</p><h3 className="mt-1 font-serif text-2xl text-forest-900">{selectedRows.length ? 'Página deste dia' : 'Uma página em branco'}</h3></div>
                <div className="flex items-center gap-1">{exportPdfEnabled && <button onClick={onExport} disabled={exporting} className="rounded-xl border border-line bg-white p-2 text-forest-800" aria-label="Exportar PDF"><FileDown className="h-4 w-4" /></button>}<button onClick={() => void fetchViewedMonth(viewMonth)} disabled={monthLoading} className="rounded-xl border border-line bg-white p-2 text-forest-800" aria-label="Atualizar mês"><RefreshCw className={`h-4 w-4 ${monthLoading ? 'animate-spin' : ''}`} /></button></div>
              </div>

              {monthLoading ? <div className="mt-8 space-y-3">{[1,2].map(item => <div key={item} className="h-24 animate-pulse rounded-2xl bg-mint/25" />)}</div> : selectedRows.length === 0 ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><BookOpen className="h-7 w-7 text-forest-500" /><p className="mt-4 font-serif text-xl text-forest-900">Nenhum registro neste dia.</p><p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">Escolha outra data marcada no calendário. Os dias sem registro continuam sendo apenas dias.</p></div> : <div className="mt-5 space-y-3">{selectedRows.map(entry => {
                const open = expandedId === entry.id
                const hasMood = hasMoodValue(entry.mood)
                const meta = hasMood ? getMoodMeta(entry.mood) : null
                const tags = [...(entry.emotional_tags || []), ...(entry.context_tags || []), ...(entry.need_tags || [])]
                return <article key={entry.id} className="rounded-2xl border border-[#e7ddcc] bg-white/70 p-4"><button type="button" onClick={() => onExpandedChange(open ? null : entry.id)} className="w-full text-left"><div className="flex items-start gap-3"><span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-mint/60 text-lg">{meta?.emoji || '✎'}</span><div className="min-w-0 flex-1"><h4 className="font-serif text-lg text-forest-900">{deriveTitle(entry)}</h4>{!hasMood && <p className="mt-0.5 text-[11px] text-ink-soft">Registro sem humor marcado</p>}{entry.text && !open && <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-soft">{entry.text}</p>}</div></div></button>{open && <div className="mt-4 border-t border-[#eee6d8] pt-4"><p className="whitespace-pre-line text-sm leading-relaxed text-ink">{entry.text || 'Sem texto adicional.'}</p>{tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{tags.slice(0, 6).map((tag, index) => <DiaryTagChip key={`${tag}-${index}`} label={tag} size="sm" />)}</div>}{entry.ai_reflection && <div className="mt-4 rounded-2xl border border-[#ddd1ea] bg-[#f2ecf9] p-4"><p className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700"><Sparkles className="h-3.5 w-3.5" /> Espelho desta página</p><p className="mt-2 text-sm text-ink-soft">{entry.ai_reflection.observation}</p>{entry.ai_reflection.question && <p className="mt-2 text-sm font-medium text-forest-900">{entry.ai_reflection.question}</p>}</div>}</div>}</article>
              })}</div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
