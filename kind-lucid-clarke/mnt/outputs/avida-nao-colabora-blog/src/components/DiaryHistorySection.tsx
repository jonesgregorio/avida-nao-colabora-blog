import { useMemo, type Ref } from 'react'
import { BookOpen, ChevronDown, ChevronUp, FileDown, RefreshCw, Sparkles } from 'lucide-react'
import type { DiaryEntry } from '../types'
import type { DiaryMirror } from '../lib/diaryCompanion'
import DiaryTagChip from './DiaryTagChip'

export type DiaryHistoryFilter = 'all' | 'checkin' | 'diary' | 'questionnaire'
export type DiaryHistoryPeriodFilter = 'all' | '7d' | '30d' | 'month'

type DiaryHistoryEntry = DiaryEntry & {
  ai_title?: string | null
  ai_reflection?: DiaryMirror | null
}

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
  getMoodMeta: (value: string | number | undefined) => { emoji: string; label: string }
  onExport: () => void
  onFilterChange: (filter: DiaryHistoryFilter) => void
  onPeriodFilterChange: (period: DiaryHistoryPeriodFilter) => void
  onExpandedChange: (id: string | null) => void
  onRefresh: () => void
  onLoadMore: () => void
}

function dayLabel(date: string) {
  const today = new Date()
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayYmd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  const parsed = new Date(`${date}T12:00:00`)
  const basic = parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
  if (date === todayYmd) return `Hoje · ${basic}`
  if (date === yesterdayYmd) return `Ontem · ${basic}`
  return parsed.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function effectiveMoodLabel(mood: string | number | undefined, otherLabel: string | null | undefined): string {
  const value = String(mood ?? '')
  return value.toLowerCase() === 'outro' && otherLabel?.trim() ? otherLabel.trim() : value
}

function deriveTitle(entry: DiaryHistoryEntry) {
  if (entry.ai_title) return entry.ai_title
  const mood = effectiveMoodLabel(entry.mood, entry.mood_other_label)
  if (entry.entry_type === 'checkin') return `Check-in · ${mood}`
  const clean = String(entry.text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return `Registro · ${mood}`
  const first = clean.split(/[.!?]/)[0] || clean
  return first.length > 68 ? `${first.slice(0, 68).trim()}…` : first
}

const FILTERS: DiaryHistoryFilter[] = ['all', 'diary', 'checkin', 'questionnaire']

function filterLabel(filter: DiaryHistoryFilter) {
  if (filter === 'all') return 'Tudo'
  if (filter === 'diary') return 'Diários'
  if (filter === 'checkin') return 'Check-ins'
  return 'Avaliações'
}

export default function DiaryHistorySection({
  sectionRef,
  entries,
  monthRows,
  today,
  exportPdfEnabled,
  exporting,
  filter,
  periodFilter,
  expandedId,
  loading,
  loadingMore,
  hasMore,
  getMoodMeta,
  onExport,
  onFilterChange,
  onPeriodFilterChange,
  onExpandedChange,
  onRefresh,
  onLoadMore,
}: Props) {
  const monthKey = today.slice(0, 7)
  const monthCheckins = monthRows.filter(entry => entry.entry_type === 'checkin').length
  const activeDays = new Set(monthRows.map(entry => String(entry.date || '').slice(0, 10)).filter(Boolean)).size
  const monthMoments = monthRows.length
  const daysInMonth = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate()
  const firstWeekday = new Date(`${monthKey}-01T12:00:00`).getDay()
  const monthTitle = new Date(`${monthKey}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const moodByDay = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of monthRows) map.set(String(row.date || '').slice(0, 10), getMoodMeta(row.mood).emoji)
    return map
  }, [monthRows, getMoodMeta])

  const groupedHistory = useMemo(() => {
    const map = new Map<string, DiaryHistoryEntry[]>()
    for (const entry of entries) {
      const date = String(entry.date || '').slice(0, 10)
      map.set(date, [...(map.get(date) || []), entry])
    }
    return [...map.entries()]
  }, [entries])

  return (
    <section ref={sectionRef}>
      <div className="rounded-[2rem] border border-line bg-paper-soft p-5 sm:p-7 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-forest-600 capitalize">{monthTitle}</p>
            <h2 className="font-serif text-2xl sm:text-3xl text-forest-900 mt-1">Sua história deste mês, até aqui</h2>
            <p className="text-sm text-ink-soft mt-2">{activeDays} dias de presença · {monthMoments} momentos registrados · {monthCheckins} check-ins. Sem pontuação, sem sequência para quebrar.</p>
          </div>
          {exportPdfEnabled && (
            <button onClick={onExport} disabled={exporting} className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-800 inline-flex items-center gap-2 disabled:opacity-60">
              <FileDown className="w-4 h-4" /> {exporting ? 'Gerando…' : 'Exportar PDF'}
            </button>
          )}
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1.5 max-w-md">
          {Array.from({ length: firstWeekday }).map((_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1
            const date = `${monthKey}-${String(day).padStart(2, '0')}`
            const emoji = moodByDay.get(date)
            const future = date > today
            return (
              <div key={date} title={date} className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-[11px] ${future ? 'opacity-25 border-line' : emoji ? 'bg-mint/60 border-forest-100 text-forest-900' : 'bg-white border-line text-ink-soft'}`}>
                <span>{day}</span>{emoji && <span className="text-sm leading-none mt-0.5">{emoji}</span>}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(item => (
            <button key={item} onClick={() => onFilterChange(item)} className={`rounded-full border px-3 py-1.5 text-xs ${filter === item ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft'}`}>
              {filterLabel(item)}
            </button>
          ))}
          <select value={periodFilter} onChange={event => onPeriodFilterChange(event.target.value as DiaryHistoryPeriodFilter)} aria-label="Filtrar período do histórico" className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-soft">
            <option value="all">Todos os períodos</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="month">Mês atual</option>
          </select>
        </div>
        <button onClick={onRefresh} className="p-2 text-ink-soft" title="Atualizar" aria-label="Atualizar histórico"><RefreshCw className="w-4 h-4" /></button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(index => <div key={index} className="h-24 rounded-3xl bg-mint/30 animate-pulse" />)}</div>
      ) : groupedHistory.length === 0 ? (
        <div className="rounded-3xl border border-line bg-white p-10 text-center"><BookOpen className="w-6 h-6 text-forest-500 mx-auto" /><p className="text-sm text-ink-soft mt-3">Ainda não há registros neste período.</p></div>
      ) : (
        <div className="space-y-3">
          {groupedHistory.map(([date, rows]) => (
            <div key={date} className="rounded-3xl border border-line bg-white overflow-hidden">
              <div className="px-5 pt-4 pb-2"><p className="text-xs text-forest-600 capitalize">{dayLabel(date)}</p></div>
              <div className="divide-y divide-line/70">
                {rows.map(entry => {
                  const open = expandedId === entry.id
                  const meta = getMoodMeta(entry.mood)
                  const tags = [...(entry.emotional_tags || []), ...(entry.context_tags || []), ...(entry.need_tags || [])]
                  return (
                    <div key={entry.id}>
                      <button onClick={() => onExpandedChange(open ? null : entry.id)} className="w-full text-left px-5 py-4 flex gap-3 items-start hover:bg-mint/20">
                        <span className="text-xl">{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-serif text-lg text-forest-900">{deriveTitle(entry)}</h3>
                            <span className="text-[10px] rounded-full bg-mint px-2 py-0.5 text-forest-700">{entry.entry_type === 'checkin' ? 'Check-in' : entry.entry_type === 'questionnaire' ? 'Avaliação' : 'Diário'}</span>
                          </div>
                          {entry.text && <p className="text-sm text-ink-soft mt-1 line-clamp-2">{entry.text}</p>}
                          {tags.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{tags.slice(0, 4).map((tag, index) => <DiaryTagChip key={`${tag}-${index}`} label={tag} size="sm" />)}{tags.length > 4 && <span className="text-[10px] text-ink-soft">+{tags.length - 4}</span>}</div>}
                        </div>
                        {open ? <ChevronUp className="w-4 h-4 text-ink-soft" /> : <ChevronDown className="w-4 h-4 text-ink-soft" />}
                      </button>
                      {open && (
                        <div className="px-5 pb-5 pl-14">
                          <p className="text-sm text-ink whitespace-pre-line leading-relaxed">{entry.text || 'Sem texto adicional.'}</p>
                          {entry.ai_reflection && (
                            <div className="mt-4 rounded-2xl bg-mint/35 border border-forest-100 p-4">
                              <p className="text-xs font-semibold text-forest-700 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Espelho do registro</p>
                              <p className="text-sm text-ink-soft mt-2">{entry.ai_reflection.observation}</p>
                              {entry.ai_reflection.question && <p className="text-sm text-forest-900 mt-2 font-medium">{entry.ai_reflection.question}</p>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && entries.length > 0 && (
        <div className="text-center mt-5">
          <button onClick={onLoadMore} disabled={loadingMore} className="rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 disabled:opacity-60">{loadingMore ? 'Carregando…' : 'Carregar mais'}</button>
        </div>
      )}
    </section>
  )
}
