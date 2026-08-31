import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Megaphone, Sparkles, CalendarDays, Grid3x3, Bookmark, Users2,
  BarChart3, ArrowRight, ArrowLeft, Save, Info, Loader2, Wand2, Download, Check, AlertTriangle,
  Copy, ExternalLink, PackageCheck, CalendarClock,
} from 'lucide-react'
import { LogoIcon } from '../Logo'
import type { EstudioBrief } from '../../lib/estudioPrompts'
import { generateCaptions, generateImagePrompt, generateWeekPlan, generatePerformanceReading, generateReelScript, estudioAiMessage, type CaptionResult } from '../../lib/estudioAi'
import { reelScriptToText, overlayTexts, type ReelScript } from '../../lib/estudioReel'
import OverlayTemplate from './estudio/OverlayTemplate'
import { fetchBlogContext, type BlogContext } from '../../lib/estudioBlogContext'
import { offsetToDate, type PlanItem } from '../../lib/estudioPlan'
import { toPerfRows, summarize, type PerfRow } from '../../lib/estudioPerformance'
import { FORMAT_SPECS, type FormatSpec } from '../../lib/estudioFormats'
import { snapshot, downloadAsset, releaseAssets, type RenderedAsset } from '../../lib/estudioRender'
import { buildZip, downloadBlob, slugForZip, type PackageDraft } from '../../lib/estudioPackage'
import type { Publicacao, PublicacaoInput } from '../../lib/estudioPublications'
import { createPublicacao, deletePublicacao, listPublicacoes, updatePublicacao, setPublicacaoStatus, savePublicacaoMetrics } from '../../lib/estudioPublicationsStore'
import FormatTemplate, { type TemplateContent } from './estudio/FormatTemplate'

const BUSINESS_SUITE_URL = 'https://business.facebook.com/latest/composer'

// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de Conteúdo — área de marketing do admin (mockup estudio-conteudo.html).
//
// FASE 1a (esta): registra a área, o shell de abas e o assistente "Nova
// publicação" com rascunho local. A geração de IA, o motor de render (template
// → PNG no formato exato) e o pacote de exportação chegam nas fases seguintes,
// sem tocar em Stripe, planos, entitlements, Diário, automações ou migrations.
//
// Sem API do Instagram: a publicação continua sendo manual (app ou Meta
// Business Suite). O texto livre aqui é do marketing — nunca vem do Diário.
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'novo' | 'calendario' | 'grade' | 'destaques' | 'inspiracao' | 'comunidade' | 'desempenho'

const TABS: { id: TabId; label: string; icon: typeof Megaphone }[] = [
  { id: 'novo', label: 'Nova publicação', icon: Sparkles },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'grade', label: 'Grade', icon: Grid3x3 },
  { id: 'destaques', label: 'Destaques', icon: Bookmark },
  { id: 'inspiracao', label: 'Inspiração', icon: Users2 },
  { id: 'comunidade', label: 'Comunidade', icon: Users2 },
  { id: 'desempenho', label: 'Desempenho', icon: BarChart3 },
]

const TAB_KEY = 'admin-estudio-tab'
const DRAFT_KEY = 'admin-estudio-rascunho'

const GOALS = [
  { id: 'salvar', label: '💾 Fazer salvar' },
  { id: 'compartilhar', label: '📩 Fazer compartilhar' },
  { id: 'comentar', label: '💬 Gerar comentário' },
  { id: 'blog', label: '🔗 Levar ao blog' },
  { id: 'alcance', label: '👋 Alcançar gente nova' },
] as const

const FORMATS = [
  { id: 'feed-45', label: 'Feed · retrato', spec: '1080 × 1350 · 4:5' },
  { id: 'feed-11', label: 'Feed · quadrado', spec: '1080 × 1080 · 1:1' },
  { id: 'carrossel', label: 'Carrossel', spec: '1080 × 1350 · até 20 slides' },
  { id: 'story', label: 'Story', spec: '1080 × 1920 · 9:16' },
  { id: 'reel-capa', label: 'Reel · capa + roteiro', spec: '1080 × 1920 · 9:16' },
  { id: 'quiz', label: 'Quiz "mito ou verdade"', spec: 'carrossel · 2 slides' },
] as const

interface Draft {
  ideia: string
  objetivos: string[]
  estilo: 'template' | 'ia' | 'hibrido'
  prompt: string
  titulo: string
  formatos: string[]
  legenda: string
  hashtags: string
  primeiroComentario: string
  publishMode: 'manual' | 'agendar'
  scheduledFor: string
  status: 'rascunho' | 'pronto'
  postUrl: string
}

const EMPTY_DRAFT: Draft = {
  ideia: '',
  objetivos: [],
  estilo: 'template',
  prompt: '',
  titulo: '',
  formatos: ['feed-45', 'carrossel', 'story', 'reel-capa'],
  legenda: '',
  hashtags: '',
  primeiroComentario: '',
  publishMode: 'agendar',
  scheduledFor: '',
  status: 'rascunho',
  postUrl: '',
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) }
  } catch { /* noop */ }
  return EMPTY_DRAFT
}

const STEPS = ['Ideia', 'Visual', 'Formatos', 'Textos', 'Pacote'] as const

function toBrief(d: Draft): EstudioBrief {
  return { ideia: d.ideia.trim(), objetivos: d.objetivos, estilo: d.estilo }
}

function draftToInput(d: Draft): PublicacaoInput {
  return {
    status: d.status === 'pronto' ? 'pronto' : 'rascunho',
    titulo: d.titulo,
    ideia: d.ideia,
    objetivos: d.objetivos,
    estilo: d.estilo,
    promptImagem: d.prompt,
    legenda: d.legenda,
    hashtags: d.hashtags,
    primeiroComentario: d.primeiroComentario,
    formatos: d.formatos,
    publishMode: d.publishMode,
    scheduledFor: d.scheduledFor || null,
    postUrl: d.postUrl || null,
  }
}

// ─── shell ───────────────────────────────────────────────────────────────────

export default function AdminEstudio() {
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      if (saved && TABS.some(t => t.id === saved)) return saved as TabId
    } catch { /* noop */ }
    return 'novo'
  })

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab) } catch { /* noop */ }
  }, [tab])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-forest-600" /> Estúdio de Conteúdo
          </h1>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">
            A IA ajuda a criar posts, carrosséis, stories, reels e destaques para o Instagram, cada formato no tamanho
            exato. A publicação é sua — manual pelo app ou agendada no Meta Business Suite.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line mb-6">
        {TABS.map(t => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                on ? 'border-forest-600 text-forest-900' : 'border-transparent text-ink-soft hover:text-forest-800'
              }`}
              aria-current={on ? 'page' : undefined}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'novo' ? <NovaPublicacao />
        : tab === 'calendario' ? <Calendario />
        : tab === 'grade' ? <Grade />
        : tab === 'desempenho' ? <Desempenho />
        : <EmBreve tab={tab} />}
    </div>
  )
}

// ─── aba: Grade (Fase 2c — mosaico 3 colunas das próximas publicações) ───────

function Grade() {
  const [rows, setRows] = useState<Publicacao[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    listPublicacoes()
      .then(setRows)
      .catch(e => { setErr(e instanceof Error ? e.message : 'Falha ao carregar.'); setRows([]) })
  }, [])

  if (rows === null) return <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-forest-500" /></div>

  const proximas = [...rows]
    .filter(p => p.status !== 'publicado')
    .sort((a, b) => (a.scheduledFor ?? '9999').localeCompare(b.scheduledFor ?? '9999'))
    .slice(0, 9)

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-soft">Como as próximas 9 publicações ficam juntas no feed. Só prévia — a ordem real vem do calendário e do que você agenda.</p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {proximas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center text-sm text-ink-soft">
          Nenhuma publicação pendente. Crie ou planeje uma na aba anterior.
        </div>
      ) : (
        <div className="grid max-w-sm grid-cols-3 gap-1 overflow-hidden rounded-xl border border-line">
          {proximas.map((p, i) => (
            <div
              key={p.id}
              className="flex aspect-square flex-col justify-between p-2"
              style={{ background: i % 3 === 2 ? 'linear-gradient(150deg,#F7D8CE,#E9E1F3)' : 'linear-gradient(150deg,#E8F0EB,#E4EEF7)' }}
              title={p.titulo || p.ideia || ''}
            >
              <span className="text-[8px] font-mono uppercase text-forest-700">{FORMAT_SPECS[p.formatos[0] ?? '']?.label ?? p.formatos[0] ?? '—'}</span>
              <span className="line-clamp-3 font-serif text-[10px] leading-tight text-forest-900">{p.titulo || p.ideia || 'post'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── aba: Desempenho (Fase 2d — métricas manuais + leitura da IA) ────────────

const FMT_METRICAS: { key: keyof PerfRow; label: string }[] = [
  { key: 'alcance', label: 'Alcance' },
  { key: 'salvos', label: 'Salvos' },
  { key: 'compartilhamentos', label: 'Compart.' },
  { key: 'cliquesBlog', label: 'Cliques blog' },
  { key: 'cadastros', label: 'Cadastros' },
]

function Desempenho() {
  const [pubs, setPubs] = useState<Publicacao[] | null>(null)
  const [rows, setRows] = useState<Record<string, Partial<Record<keyof PerfRow, string>>>>({})
  const [err, setErr] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reading, setReading] = useState('')
  const [busyRead, setBusyRead] = useState(false)

  const load = useCallback(async () => {
    try {
      setPubs(await listPublicacoes())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar.')
      setPubs([])
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (pubs === null) return <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-forest-500" /></div>

  const perfRows = toPerfRows(pubs)
  const summary = summarize(perfRows)

  function edit(id: string, key: keyof PerfRow, value: string) {
    setRows(r => ({ ...r, [id]: { ...r[id], [key]: value } }))
  }

  async function salvar(row: PerfRow) {
    setSavingId(row.id); setErr('')
    const draft = rows[row.id] ?? {}
    const num = (k: keyof PerfRow, cur: number | null) => {
      const raw = draft[k]
      if (raw === undefined) return cur
      const n = parseInt(raw, 10)
      return Number.isFinite(n) && n >= 0 ? n : cur
    }
    try {
      await savePublicacaoMetrics(row.id, {
        alcance: num('alcance', row.alcance),
        salvos: num('salvos', row.salvos),
        compartilhamentos: num('compartilhamentos', row.compartilhamentos),
        cliquesBlog: num('cliquesBlog', row.cliquesBlog),
        cadastros: num('cadastros', row.cadastros),
      })
      setRows(r => { const c = { ...r }; delete c[row.id]; return c })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao salvar métricas.')
    } finally {
      setSavingId(null)
    }
  }

  async function analisar() {
    setBusyRead(true); setErr('')
    try {
      setReading(await generatePerformanceReading(perfRows))
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusyRead(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">Sem API do Instagram, os números são digitados à mão — poucos campos, 2 minutos por semana. É o suficiente para a IA entender o que converte.</p>
      {err && <p className="text-xs text-red-600">{err}</p>}

      {perfRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center text-sm text-ink-soft">
          Nenhuma publicação pronta ou publicada ainda.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Posts medidos" value={String(summary.medidos)} />
            <Kpi label="Alcance total" value={summary.totalAlcance.toLocaleString('pt-BR')} />
            <Kpi label="Taxa de salvamento" value={summary.taxaSalvamento == null ? '—' : `${(summary.taxaSalvamento * 100).toFixed(1)}%`} />
            <Kpi label="Cadastros" value={String(summary.totalCadastros)} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full text-xs">
              <thead className="border-b border-line bg-stone-50 text-[10px] uppercase text-ink-soft">
                <tr>
                  <th className="px-3 py-2 text-left">Post</th>
                  {FMT_METRICAS.map(m => <th key={m.key} className="px-2 py-2 text-left">{m.label}</th>)}
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {perfRows.map(row => (
                  <tr key={row.id}>
                    <td className="max-w-[200px] px-3 py-2">
                      <p className="truncate font-medium text-forest-900">{row.titulo}</p>
                      <p className="font-mono text-[10px] text-stone-400">{FORMAT_SPECS[row.formatoPrincipal]?.label ?? row.formatoPrincipal}</p>
                    </td>
                    {FMT_METRICAS.map(m => (
                      <td key={m.key} className="px-2 py-2">
                        <input
                          type="number" min={0}
                          value={rows[row.id]?.[m.key] ?? (row[m.key] ?? '')}
                          onChange={e => edit(row.id, m.key, e.target.value)}
                          className="w-16 rounded border border-line bg-paper px-1.5 py-1 text-xs"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <button
                        onClick={() => salvar(row)}
                        disabled={savingId === row.id || !rows[row.id]}
                        className="rounded-lg border border-line bg-white px-2 py-1 font-medium text-forest-800 hover:border-forest-300 disabled:opacity-40"
                      >
                        {savingId === row.id ? '…' : 'salvar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border-l-2 border-forest-400 bg-stone-50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base text-forest-900">Leitura da IA</h3>
              <button onClick={analisar} disabled={busyRead || summary.medidos === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40">
                {busyRead ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Analisar
              </button>
            </div>
            {reading && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink">{reading}</p>}
            {!reading && <p className="mt-2 text-xs text-ink-soft">Preencha alguns posts e clique em Analisar.</p>}
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 font-serif text-xl text-forest-900">{value}</p>
    </div>
  )
}

// ─── aba: Calendário (Fase 2b — lista + grade mensal + plano da semana) ──────

const STATUS_PILL: Record<Publicacao['status'], string> = {
  publicado: 'bg-mint text-forest-800',
  pronto: 'bg-forest-100 text-forest-800',
  rascunho: 'bg-amber-100 text-amber-700',
}
const DOW = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

function Calendario() {
  const [rows, setRows] = useState<Publicacao[] | null>(null)
  const [err, setErr] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [view, setView] = useState<'lista' | 'mes'>('lista')
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })

  const load = useCallback(async () => {
    setErr('')
    try {
      setRows(await listPublicacoes())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar as publicações.')
      setRows([])
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function remover(id: string) {
    setBusyId(id)
    try {
      await deletePublicacao(id)
      setRows(r => (r ?? []).filter(p => p.id !== id))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao excluir.')
    } finally {
      setBusyId(null)
    }
  }

  async function mudarStatus(id: string, status: Publicacao['status']) {
    setBusyId(id)
    try {
      await setPublicacaoStatus(id, status)
      setRows(r => (r ?? []).map(p => (p.id === id ? { ...p, status } : p)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao mudar o status.')
    } finally {
      setBusyId(null)
    }
  }

  if (rows === null) {
    return <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-forest-500" /></div>
  }

  return (
    <div className="space-y-5">
      <WeekPlanner onAdded={() => void load()} />

      <div className="flex items-center justify-between">
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {(['lista', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`px-3 py-1.5 font-medium ${view === v ? 'bg-forest-900 text-white' : 'bg-white text-ink-soft hover:text-forest-800'}`}>
              {v === 'lista' ? 'Lista' : 'Mês'}
            </button>
          ))}
        </div>
        <button onClick={() => void load()} className="text-xs text-forest-700 underline">Atualizar</button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center text-sm text-ink-soft">
          Nenhuma publicação salva ainda. Crie uma em <b>Nova publicação</b>, ou peça um plano à IA acima.
        </div>
      )}

      {rows.length > 0 && view === 'lista' && (
        <ul className="divide-y divide-stone-100 rounded-2xl border border-line bg-white">
          {rows.map(p => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <select
                value={p.status}
                onChange={e => void mudarStatus(p.id, e.target.value as Publicacao['status'])}
                disabled={busyId === p.id}
                className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-medium ${STATUS_PILL[p.status]}`}
                aria-label="Status da publicação"
              >
                <option value="rascunho">Rascunho</option>
                <option value="pronto">Pronto</option>
                <option value="publicado">Publicado</option>
              </select>
              <span className="min-w-0 flex-1 truncate text-forest-900">{p.titulo || p.ideia || 'Sem título'}</span>
              {p.temaCategoria && <span className="rounded bg-mint/60 px-1.5 py-0.5 text-[10px] text-forest-700">{p.temaCategoria}</span>}
              {p.scheduledFor && (
                <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {new Date(p.scheduledFor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <span className="text-xs text-stone-400">{p.formatos.length} formato{p.formatos.length === 1 ? '' : 's'}</span>
              {p.postUrl && <a href={p.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-forest-700 underline">post</a>}
              <button onClick={() => remover(p.id)} disabled={busyId === p.id} className="text-xs text-ink-soft hover:text-red-600 disabled:opacity-40">excluir</button>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && view === 'mes' && (
        <MonthGrid rows={rows} cursor={monthCursor} onMove={delta => setMonthCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + delta); return d })} />
      )}
    </div>
  )
}

function MonthGrid({ rows, cursor, onMove }: { rows: Publicacao[]; cursor: Date; onMove: (d: number) => void }) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startDow = (first.getDay() + 6) % 7 // segunda = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const byDay = new Map<number, Publicacao[]>()
  for (const p of rows) {
    if (!p.scheduledFor) continue
    const d = new Date(p.scheduledFor)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const arr = byDay.get(d.getDate()) ?? []
      arr.push(p); byDay.set(d.getDate(), arr)
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const semData = rows.filter(p => !p.scheduledFor).length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button onClick={() => onMove(-1)} className="rounded-lg border border-line px-2 py-1 text-xs hover:border-forest-300">←</button>
        <span className="font-serif text-sm text-forest-900">{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => onMove(1)} className="rounded-lg border border-line px-2 py-1 text-xs hover:border-forest-300">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DOW.map(d => <div key={d} className="pb-1 text-center text-[10px] uppercase tracking-wide text-ink-soft">{d}</div>)}
        {cells.map((day, i) => (
          <div key={i} className={`min-h-[64px] rounded-lg border p-1 text-[10px] ${day ? 'border-line bg-white' : 'border-transparent'}`}>
            {day && <span className="text-ink-soft">{day}</span>}
            <div className="mt-0.5 space-y-0.5">
              {(byDay.get(day ?? -1) ?? []).map(p => (
                <div key={p.id} className={`truncate rounded px-1 py-0.5 ${STATUS_PILL[p.status]}`} title={p.titulo || p.ideia || ''}>
                  {p.titulo || p.ideia || 'post'}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {semData > 0 && <p className="text-[11px] text-stone-400">{semData} publicação(ões) sem data agendada não aparecem na grade.</p>}
    </div>
  )
}

function WeekPlanner({ onAdded }: { onAdded: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [plan, setPlan] = useState<PlanItem[] | null>(null)
  const [ctx, setCtx] = useState<BlogContext | null>(null)
  const [addedIdx, setAddedIdx] = useState<Set<number>>(new Set())

  async function planejar() {
    setBusy(true); setErr(''); setPlan(null); setAddedIdx(new Set())
    try {
      const context = await fetchBlogContext()
      setCtx(context)
      setPlan(await generateWeekPlan(context))
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function adicionar(item: PlanItem, idx: number) {
    try {
      await createPublicacao({
        status: 'rascunho',
        titulo: '',
        ideia: item.ideia,
        objetivos: [item.objetivo].filter(Boolean),
        estilo: 'template',
        promptImagem: '',
        legenda: '',
        hashtags: '',
        primeiroComentario: '',
        formatos: [item.formato],
        temaCategoria: item.temaCategoria || null,
        publishMode: 'agendar',
        scheduledFor: offsetToDate(item.diaOffset),
      })
      setAddedIdx(s => new Set(s).add(idx))
      onAdded()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao adicionar ao calendário.')
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-base text-forest-900">Plano da semana</h3>
          <p className="text-xs text-ink-soft">A IA lê a cobertura de temas do blog e propõe 4–5 posts.</p>
        </div>
        <button onClick={planejar} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Planejar semana
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {ctx && plan && (
        <div className="mt-3 space-y-2">
          {ctx.cobertura.filter(c => c.diasSemPost === null || c.diasSemPost >= 30).length > 0 && (
            <p className="rounded-lg bg-mint/40 px-3 py-2 text-[11px] text-ink">
              Temas há 30+ dias sem post: {ctx.cobertura.filter(c => c.diasSemPost === null || c.diasSemPost >= 30).map(c => c.categoria).join(', ') || '—'}
            </p>
          )}
          <ul className="space-y-1.5">
            {plan.map((item, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs">
                <span className="rounded bg-forest-100 px-1.5 py-0.5 font-medium text-forest-800">dia +{item.diaOffset}</span>
                <span className="rounded bg-lilac/70 px-1.5 py-0.5 text-ink">{FORMAT_SPECS[item.formato]?.label ?? item.formato}</span>
                {item.temaCategoria && <span className="rounded bg-mint/60 px-1.5 py-0.5 text-forest-700">{item.temaCategoria}</span>}
                <span className="min-w-0 flex-1 text-ink">{item.ideia}</span>
                <button
                  onClick={() => adicionar(item, idx)}
                  disabled={addedIdx.has(idx)}
                  className="rounded-lg border border-line bg-white px-2 py-1 font-medium text-forest-800 hover:border-forest-300 disabled:opacity-40"
                >
                  {addedIdx.has(idx) ? 'adicionado' : 'adicionar'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── aba: Nova publicação (assistente de 5 passos) ───────────────────────────

function NovaPublicacao() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Artes renderizadas (blobs) — vivem só na sessão; não serializam no rascunho.
  const [assets, setAssets] = useState<RenderedAsset[]>([])
  useEffect(() => () => releaseAssets(assets), [assets])
  const [reelRoteiro, setReelRoteiro] = useState('')

  // Persistência no banco (Fase 2a). O localStorage segue como retomada rápida;
  // a linha em estudio_publicacoes é a fonte de verdade do histórico.
  const [pubId, setPubId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  const patch = useCallback((p: Partial<Draft>) => setDraft(d => ({ ...d, ...p })), [])

  const save = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* noop */ }
  }, [draft])

  const persist = useCallback(async () => {
    setSaving(true); setSaveErr('')
    try {
      const input = draftToInput(draft)
      const row = pubId ? await updatePublicacao(pubId, input) : await createPublicacao(input)
      setPubId(row.id)
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Falha ao salvar a publicação.')
    } finally {
      setSaving(false)
    }
  }, [draft, pubId])

  function novaPublicacao() {
    releaseAssets(assets)
    setAssets([])
    setReelRoteiro('')
    setDraft(EMPTY_DRAFT)
    setPubId(null)
    setStep(0)
    try { localStorage.removeItem(DRAFT_KEY) } catch { /* noop */ }
  }

  // Autosave leve — o rascunho não se perde ao trocar de aba ou recarregar.
  useEffect(() => {
    const id = setTimeout(save, 600)
    return () => clearTimeout(id)
  }, [draft, save])

  const toggle = (key: 'objetivos' | 'formatos', value: string) =>
    patch({ [key]: draft[key].includes(value) ? draft[key].filter(v => v !== value) : [...draft[key], value] } as Partial<Draft>)

  const canAdvance = useMemo(() => {
    if (step === 0) return draft.ideia.trim().length >= 8 && draft.objetivos.length > 0
    if (step === 2) return draft.formatos.length > 0
    return true
  }, [step, draft])

  return (
    <div className="space-y-5">
      {/* stepper */}
      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'on' : 'todo'
          return (
            <li key={label}>
              <button
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  state === 'on' ? 'border-forest-400 text-forest-900 bg-mint/40'
                  : state === 'done' ? 'border-line text-forest-700 hover:border-forest-300'
                  : 'border-line text-stone-400'
                }`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                  state === 'todo' ? 'bg-stone-100 text-stone-400' : 'bg-forest-700 text-white'
                }`}>{state === 'done' ? '✓' : i + 1}</span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="rounded-2xl border border-line bg-white p-5">
        {step === 0 && <StepIdeia draft={draft} patch={patch} toggle={toggle} />}
        {step === 1 && <StepVisual draft={draft} patch={patch} />}
        {step === 2 && <StepFormatos draft={draft} toggle={toggle} assets={assets} setAssets={setAssets} setReelRoteiro={setReelRoteiro} />}
        {step === 3 && <StepTextos draft={draft} patch={patch} />}
        {step === 4 && <StepPacote draft={draft} assets={assets} patch={patch} reelRoteiro={reelRoteiro} />}
      </div>

      {/* navegação */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 hover:border-forest-300 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => canAdvance && setStep(s => s + 1)}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => { save(); void persist() }}
          disabled={saving || draft.ideia.trim().length < 8}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 hover:border-forest-300 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {pubId ? 'Salvar alterações' : 'Salvar publicação'}
        </button>
        <button
          onClick={novaPublicacao}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-soft hover:border-forest-300"
        >
          Nova
        </button>
        {saveErr && <span className="text-xs text-red-600">{saveErr}</span>}
        {!saveErr && savedAt && <span className="text-xs text-stone-400">salvo às {savedAt}</span>}
      </div>
    </div>
  )
}

// ─── passos ─────────────────────────────────────────────────────────────────

function Field({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{children}</span>
}

function StepIdeia({
  draft, patch, toggle,
}: {
  draft: Draft
  patch: (p: Partial<Draft>) => void
  toggle: (k: 'objetivos' | 'formatos', v: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <Field>Sua ideia</Field>
        <textarea
          value={draft.ideia}
          onChange={e => patch({ ideia: e.target.value })}
          rows={4}
          placeholder="Ex.: post sobre não precisar dar conta de tudo ao mesmo tempo, tom acolhedor, ligado ao artigo “Quando descansar vira culpa”."
          className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
        />
        <Field>Objetivo principal</Field>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map(g => {
            const on = draft.objetivos.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggle('objetivos', g.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="rounded-xl bg-mint/50 p-4">
        <h3 className="font-serif text-base text-forest-900">Por que pedir o objetivo</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          O algoritmo hoje premia <b>salvamentos e envios em DM</b>, não curtidas. O objetivo muda o formato que a IA
          recomenda, a estrutura da legenda e o CTA.
        </p>
      </div>
    </div>
  )
}

function StepVisual({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const opts: { id: Draft['estilo']; label: string; hint: string }[] = [
    { id: 'template', label: 'Template da marca', hint: 'Playfair + paleta do blog. Previsível e barato — recomendado.' },
    { id: 'ia', label: 'IA generativa de imagem', hint: 'Flexível, custa por imagem, às vezes com “cara de IA”.' },
    { id: 'hibrido', label: 'Híbrido', hint: 'Fundo gerado por IA + tipografia da marca por cima.' },
  ]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [racional, setRacional] = useState('')
  const podeGerar = draft.ideia.trim().length >= 8

  async function sugerir() {
    setBusy(true); setErr(''); setRacional('')
    try {
      const r = await generateImagePrompt(toBrief(draft))
      patch({ prompt: r.prompt, ...(r.tituloSugerido && !draft.titulo ? { titulo: r.tituloSugerido } : {}) })
      setRacional([r.racional, r.tituloSugerido && `Título sugerido: “${r.tituloSugerido}”`].filter(Boolean).join(' · '))
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Field>Estilo visual</Field>
        <div className="grid gap-2 sm:grid-cols-3">
          {opts.map(o => {
            const on = draft.estilo === o.id
            return (
              <button
                key={o.id}
                onClick={() => patch({ estilo: o.id })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  on ? 'border-forest-600 ring-1 ring-forest-200' : 'border-line hover:border-forest-300'
                }`}
              >
                <span className="block text-sm font-medium text-forest-900">{o.label}</span>
                <span className="mt-1 block text-xs text-ink-soft">{o.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Field>Prompt de imagem (editável)</Field>
          <button
            onClick={sugerir}
            disabled={busy || !podeGerar}
            title={podeGerar ? undefined : 'Descreva a ideia no passo anterior'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {draft.prompt ? 'Refazer com a IA' : 'Sugerir com a IA'}
          </button>
        </div>
        <textarea
          value={draft.prompt}
          onChange={e => patch({ prompt: e.target.value })}
          rows={3}
          placeholder="Descreva a imagem, ou peça uma sugestão à IA a partir da sua ideia."
          className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
        />
        {racional && <p className="mt-1.5 text-xs text-ink-soft">{racional}</p>}
        {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      </div>
      <NextPhaseNote>
        A geração da <b>prévia da imagem</b> (motor de template → PNG no formato exato) entra na <b>Fase 1d</b>. Aqui a IA
        já ajuda a escrever e ajustar o prompt.
      </NextPhaseNote>
    </div>
  )
}

const FMT_KICKER: Record<string, string> = {
  'feed-45': 'A vida não colabora', 'feed-11': 'A vida não colabora',
  carrossel: 'Carrossel', story: 'No story de hoje', 'reel-capa': 'Novo reel', quiz: 'Mito ou verdade',
}

// Divide a legenda em frases utilizáveis como slides.
function legendaEmFrases(legenda: string): string[] {
  return legenda
    .split(/\n+|(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 12)
}

// Conteúdo de cada arte de um formato. Formatos simples = 1; carrossel/quiz = vários.
function slidesFor(id: string, spec: FormatSpec, draft: Draft): TemplateContent[] {
  const titulo = draft.titulo || draft.ideia.slice(0, 60)
  const frases = legendaEmFrases(draft.legenda)

  if (id === 'quiz') {
    return [
      { titulo: 'Mito ou verdade?', kicker: 'Quiz', corpo: titulo },
      { titulo: 'A resposta', kicker: 'Quiz', corpo: frases[0] || draft.legenda.slice(0, 160) },
    ]
  }

  if (spec.slides && spec.slides > 1) {
    const total = spec.slides
    const capa: TemplateContent = { titulo, kicker: FMT_KICKER[id] }
    const meio = frases.slice(0, total - 2).map((f, i) => ({
      titulo: f, kicker: `${i + 2}/${total}`,
    }))
    const cta: TemplateContent = {
      titulo: 'Continue no blog',
      kicker: `${total}/${total}`,
      corpo: draft.primeiroComentario || 'Link do artigo na bio.',
    }
    return [capa, ...meio, cta].slice(0, total)
  }

  return [{
    titulo,
    kicker: FMT_KICKER[id],
    corpo: id.startsWith('feed') ? undefined : frases[0] || undefined,
  }]
}

function StepFormatos({
  draft, toggle, assets, setAssets, setReelRoteiro,
}: {
  draft: Draft
  toggle: (k: 'objetivos' | 'formatos', v: string) => void
  assets: RenderedAsset[]
  setAssets: (a: RenderedAsset[]) => void
  setReelRoteiro: (s: string) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const overlayStageRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const selected = draft.formatos.filter(id => FORMAT_SPECS[id])
  const temReel = selected.includes('reel-capa')

  const [reelScript, setReelScript] = useState<ReelScript | null>(null)
  const [reelBusy, setReelBusy] = useState(false)
  const [reelErr, setReelErr] = useState('')
  const overlays = temReel && reelScript ? overlayTexts(reelScript) : []

  async function gerarRoteiro() {
    setReelBusy(true); setReelErr('')
    try {
      const s = await generateReelScript(toBrief(draft))
      setReelScript(s)
      setReelRoteiro(reelScriptToText(s))
    } catch (e) {
      setReelErr(estudioAiMessage(e))
    } finally {
      setReelBusy(false)
    }
  }

  async function gerarOverlays() {
    if (!overlayStageRef.current) return
    setReelBusy(true); setReelErr('')
    const spec = FORMAT_SPECS['reel-capa']
    const semOverlay = assets.filter(a => !a.filename.startsWith('overlay-'))
    const novos: RenderedAsset[] = []
    try {
      for (let i = 0; i < overlays.length; i++) {
        const node = overlayStageRef.current.querySelector<HTMLElement>(`[data-ov="${i}"]`)
        if (!node) continue
        novos.push(await snapshot(node, spec, `overlay-${String(i + 1).padStart(2, '0')}-${spec.width}x${spec.height}.png`, { transparent: true }))
      }
      setAssets([...semOverlay, ...novos])
    } catch (e) {
      setReelErr(e instanceof Error ? e.message : 'Falha ao gerar os overlays.')
    } finally {
      setReelBusy(false)
    }
  }

  const plan = useMemo(
    () => selected.map(id => ({ id, spec: FORMAT_SPECS[id], slides: slidesFor(id, FORMAT_SPECS[id], draft) })),
    [selected, draft],
  )
  const totalArtes = plan.reduce((n, p) => n + p.slides.length, 0)

  async function gerar() {
    if (!stageRef.current) return
    setBusy(true); setErr('')
    releaseAssets(assets)
    const out: RenderedAsset[] = []
    try {
      for (const p of plan) {
        for (let i = 0; i < p.slides.length; i++) {
          const node = stageRef.current.querySelector<HTMLElement>(`[data-fmt="${p.id}"][data-slide="${i}"]`)
          if (!node) continue
          const suffix = p.slides.length > 1 ? `-${String(i + 1).padStart(2, '0')}` : ''
          out.push(await snapshot(node, p.spec, `${p.id}${suffix}-${p.spec.width}x${p.spec.height}.png`))
        }
      }
      setAssets(out)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar as artes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field>O que gerar desta ideia</Field>
      <div className="grid gap-2 sm:grid-cols-3">
        {FORMATS.map(f => {
          const on = draft.formatos.includes(f.id)
          return (
            <button
              key={f.id}
              onClick={() => toggle('formatos', f.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                on ? 'border-forest-600 ring-1 ring-forest-200' : 'border-line hover:border-forest-300'
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium text-forest-900">
                {f.label}
                <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${on ? 'border-forest-600 bg-forest-600 text-white' : 'border-line text-transparent'}`}>✓</span>
              </span>
              <span className="mt-1 block font-mono text-[10px] text-ink-soft">{f.spec}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={gerar}
          disabled={busy || selected.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Gerar {totalArtes} {totalArtes === 1 ? 'arte' : 'artes'}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>

      {assets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {assets.map(a => (
            <figure key={a.filename} className="overflow-hidden rounded-xl border border-line bg-white">
              <img src={a.url} alt={a.filename} className="w-full" style={{ aspectRatio: `${a.width}/${a.height}` }} />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="font-mono text-ink-soft">{a.width}×{a.height}</span>
                {a.check.ok ? (
                  <span className="inline-flex items-center gap-1 text-forest-700"><Check className="h-3.5 w-3.5" /> formato ok</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600" title={a.check.problems.join('; ')}><AlertTriangle className="h-3.5 w-3.5" /> revisar</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {temReel && (
        <div className="space-y-3 rounded-xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-serif text-sm text-forest-900">Roteiro do reel</h4>
              <p className="text-xs text-ink-soft">O Estúdio não grava vídeo — entrega o roteiro e os textos de tela como PNG transparente para o CapCut.</p>
            </div>
            <button onClick={gerarRoteiro} disabled={reelBusy || draft.ideia.trim().length < 8} className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40">
              {reelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {reelScript ? 'Refazer' : 'Gerar roteiro'}
            </button>
          </div>
          {reelErr && <p className="text-xs text-red-600">{reelErr}</p>}
          {reelScript && (
            <>
              <div className="rounded-lg bg-stone-50 p-3 text-xs">
                <p className="font-medium text-forest-900">Gancho: <span className="font-normal text-ink">{reelScript.gancho}</span></p>
                <ol className="mt-2 space-y-1">
                  {reelScript.blocos.map((b, i) => (
                    <li key={i} className="text-ink-soft"><b className="text-forest-700">{b.tempo || `bloco ${i + 1}`}</b> — {b.fala}{b.textoNaTela && <span className="text-ink"> · tela: “{b.textoNaTela}”</span>}</li>
                  ))}
                </ol>
                <p className="mt-2 text-ink-soft">Áudio: {reelScript.audioSugestao} · CTA: {reelScript.cta}</p>
              </div>
              <button onClick={gerarOverlays} disabled={reelBusy || overlays.length === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-forest-800 hover:border-forest-300 disabled:opacity-40">
                {reelBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Gerar {overlays.length} overlay{overlays.length === 1 ? '' : 's'} (PNG transparente)
              </button>
              {assets.some(a => a.filename.startsWith('overlay-')) && (
                <p className="text-[11px] text-forest-700">Overlays adicionados às artes — vão no pacote junto com o roteiro.</p>
              )}
            </>
          )}
        </div>
      )}

      <NextPhaseNote>
        Estilo <b>template da marca</b> — carrossel e quiz saem com todos os slides. O reel entrega <b>roteiro + textos de
        tela</b>; a montagem em vídeo (slideshow MP4) e a IA generativa de imagem ficam para depois.
      </NextPhaseNote>

      {/* palco de render fora da tela — dimensão real, capturado pelo html2canvas */}
      <div ref={stageRef} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }}>
        {plan.map(p => p.slides.map((content, i) => (
          <div key={`${p.id}-${i}`} data-fmt={p.id} data-slide={i}>
            <FormatTemplate spec={p.spec} content={content} />
          </div>
        )))}
      </div>
      <div ref={overlayStageRef} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }}>
        {overlays.map((texto, i) => (
          <div key={i} data-ov={i}>
            <OverlayTemplate spec={FORMAT_SPECS['reel-capa']} texto={texto} />
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTextos({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<CaptionResult | null>(null)
  const [pick, setPick] = useState(0)
  const podeGerar = draft.ideia.trim().length >= 8

  async function gerar() {
    setBusy(true); setErr('')
    try {
      const r = await generateCaptions(toBrief(draft))
      setRes(r); setPick(0)
      patch({ legenda: r.legendas[0].texto, hashtags: r.hashtags, primeiroComentario: r.primeiroComentario })
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function usar(i: number) {
    if (!res) return
    setPick(i)
    patch({ legenda: res.legendas[i].texto })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <button
          onClick={gerar}
          disabled={busy || !podeGerar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {res ? 'Gerar de novo' : 'Gerar 3 legendas + hashtags'}
        </button>
        {err && <p className="text-xs text-red-600">{err}</p>}

        {res && res.legendas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {res.legendas.map((l, i) => (
              <button
                key={i}
                onClick={() => usar(i)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  pick === i ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
                }`}
              >
                {l.rotulo || `Variação ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div>
          <Field>Legenda</Field>
          <textarea
            value={draft.legenda}
            onChange={e => patch({ legenda: e.target.value })}
            rows={6}
            placeholder="Escreva a legenda, ou gere 3 variações com a IA e escolha uma."
            className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
          <span className="text-xs text-stone-400">{draft.legenda.length} / 2.200 caracteres</span>
        </div>
        <div>
          <Field>Primeiro comentário — hashtags</Field>
          <textarea
            value={draft.hashtags}
            onChange={e => patch({ hashtags: e.target.value })}
            rows={2}
            placeholder="#saudeemocional #autocuidado …  (a IA sugere ~10 de nicho médio)"
            className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
        </div>
        {draft.primeiroComentario && (
          <div>
            <Field>Comentário com o CTA para o blog</Field>
            <textarea
              value={draft.primeiroComentario}
              onChange={e => patch({ primeiroComentario: e.target.value })}
              rows={2}
              className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
          </div>
        )}
      </div>
      <div className="rounded-xl bg-mint/50 p-4">
        <h3 className="font-serif text-base text-forest-900">Regra fixa</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          O texto do post é do marketing. <b>Nada aqui vem do Diário dos usuários</b> — a IA usa só a sua ideia, artigos
          publicados e temas das categorias. A geração roda server-side (chaves só no Supabase).
        </p>
      </div>
    </div>
  )
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
      setTimeout(() => setDone(false), 1500)
    } catch { /* clipboard indisponível */ }
  }
  return (
    <button
      onClick={copy}
      disabled={!text}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-medium text-forest-800 hover:border-forest-300 disabled:opacity-40"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? 'Copiado' : label}
    </button>
  )
}

function StepPacote({
  draft, assets, patch, reelRoteiro,
}: {
  draft: Draft
  assets: RenderedAsset[]
  patch: (p: Partial<Draft>) => void
  reelRoteiro: string
}) {
  const fmtLabels = FORMATS.filter(f => draft.formatos.includes(f.id)).map(f => f.label)
  const [zipping, setZipping] = useState(false)
  const [zipErr, setZipErr] = useState('')
  const allOk = assets.length > 0 && assets.every(a => a.check.ok)
  const podePublicar = allOk && draft.legenda.trim().length > 0

  const pkgDraft: PackageDraft = {
    ideia: draft.ideia, legenda: draft.legenda, hashtags: draft.hashtags,
    primeiroComentario: draft.primeiroComentario, formatos: draft.formatos,
    publishMode: draft.publishMode, scheduledFor: draft.scheduledFor || undefined,
    reelRoteiro: reelRoteiro || undefined,
  }

  async function baixarZip() {
    setZipping(true); setZipErr('')
    try {
      downloadBlob(await buildZip(assets, pkgDraft), slugForZip(draft.ideia))
    } catch (e) {
      setZipErr(e instanceof Error ? e.message : 'Falha ao montar o .zip.')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="block h-5 w-5 text-forest-700"><LogoIcon className="h-full w-full" /></span>
        <h3 className="font-serif text-lg text-forest-900">Pacote da publicação</h3>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${
          draft.status === 'pronto' ? 'bg-forest-100 text-forest-800' : 'bg-amber-100 text-amber-700'
        }`}>{draft.status === 'pronto' ? 'Pronto para publicar' : 'Rascunho'}</span>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Ideia</dt><dd className="mt-0.5 text-ink">{draft.ideia || '—'}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Formatos</dt><dd className="mt-0.5 text-ink">{fmtLabels.length ? fmtLabels.join(', ') : '—'}</dd></div>
      </dl>

      {/* textos com copiar */}
      <div className="space-y-2 rounded-xl border border-line bg-white p-3">
        <div className="flex items-center justify-between"><span className="text-xs font-medium text-forest-900">Legenda</span><CopyBtn text={draft.legenda} label="Copiar legenda" /></div>
        <div className="flex items-center justify-between"><span className="text-xs font-medium text-forest-900">Hashtags (1º comentário)</span><CopyBtn text={draft.hashtags} label="Copiar hashtags" /></div>
        {draft.primeiroComentario && (
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-forest-900">Comentário com CTA</span><CopyBtn text={draft.primeiroComentario} label="Copiar comentário" /></div>
        )}
        {reelRoteiro && (
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-forest-900">Roteiro do reel</span><CopyBtn text={reelRoteiro} label="Copiar roteiro" /></div>
        )}
      </div>

      {/* artes + zip */}
      <div>
        <Field>Artes geradas</Field>
        {assets.length === 0 ? (
          <p className="text-xs text-ink-soft">Nenhuma arte gerada ainda — volte ao passo <b>Formatos</b> e clique em “Gerar artes”.</p>
        ) : (
          <>
            <ul className="divide-y divide-stone-100 rounded-xl border border-line">
              {assets.map(a => (
                <li key={a.filename} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.check.ok ? 'bg-forest-500' : 'bg-amber-400'}`} />
                  <span className="flex-1 truncate font-mono text-ink-soft">{a.filename}</span>
                  <span className="text-stone-400">{(a.bytes / 1024).toFixed(0)} KB</span>
                  <button onClick={() => downloadAsset(a)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 font-medium text-forest-800 hover:border-forest-300">
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button onClick={baixarZip} disabled={zipping} className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40">
                {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Baixar pacote (.zip)
              </button>
              {zipErr && <span className="text-xs text-red-600">{zipErr}</span>}
            </div>
          </>
        )}
      </div>

      {/* publicação */}
      <div className="space-y-3 rounded-xl border border-line bg-white p-4">
        <Field>Como vai publicar</Field>
        <div className="flex flex-wrap gap-2">
          {(['agendar', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => patch({ publishMode: m })}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                draft.publishMode === m ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
              }`}
            >
              {m === 'agendar' ? 'Agendar no Business Suite' : 'Postar manual pelo app'}
            </button>
          ))}
        </div>
        {draft.publishMode === 'agendar' && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-ink-soft">
              <CalendarClock className="h-4 w-4" />
              <input
                type="datetime-local"
                value={draft.scheduledFor}
                onChange={e => patch({ scheduledFor: e.target.value })}
                className="rounded-lg border border-line bg-paper px-2 py-1 text-xs text-ink"
              />
            </label>
            <a href={BUSINESS_SUITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-forest-800 hover:border-forest-300">
              <ExternalLink className="h-3.5 w-3.5" /> Abrir Meta Business Suite
            </a>
          </div>
        )}
      </div>

      {/* aprovação humana */}
      <div className="space-y-3 rounded-xl border-l-2 border-forest-400 bg-stone-50 p-4">
        {draft.status === 'rascunho' ? (
          <>
            <p className="text-xs text-ink-soft">
              Revise as artes e os textos. Nada sai do Estúdio sozinho — publicar é sempre manual.
            </p>
            <button
              onClick={() => patch({ status: 'pronto' })}
              disabled={!podePublicar}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40"
              title={podePublicar ? undefined : 'Gere as artes (todas no formato ok) e escreva a legenda'}
            >
              <PackageCheck className="h-4 w-4" /> Marcar como pronto para publicar
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-forest-800">
              <Check className="h-4 w-4" /> Aprovado — pode publicar
              <button onClick={() => patch({ status: 'rascunho' })} className="ml-2 text-xs text-ink-soft underline">voltar a rascunho</button>
            </div>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Depois de publicar — link do post</span>
              <input
                type="url"
                value={draft.postUrl}
                onChange={e => patch({ postUrl: e.target.value })}
                placeholder="https://www.instagram.com/p/…"
                className="w-full rounded-lg border border-line bg-paper px-2.5 py-1.5 text-xs text-ink"
              />
            </label>
          </>
        )}
      </div>

      <NextPhaseNote>
        Persistir a publicação num histórico (tabela) e puxar métricas ficam para a <b>Fase 2</b>. Publicar via API do
        Instagram e automatizar interação continuam fora de escopo.
      </NextPhaseNote>
    </div>
  )
}

// ─── auxiliares ─────────────────────────────────────────────────────────────

function NextPhaseNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border-l-2 border-forest-400 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-soft">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-500" />
      <span>{children}</span>
    </p>
  )
}

function EmBreve({ tab }: { tab: TabId }) {
  const meta: Record<Exclude<TabId, 'novo'>, { fase: string; desc: string }> = {
    calendario: { fase: 'Fase 2', desc: 'Calendário editorial ligado às categorias e ao analytics por slug do blog. A IA propõe o plano da semana; você aceita, troca ou remove.' },
    grade: { fase: 'Fase 2', desc: 'Prévia em mosaico 3×3 das próximas publicações, para o feed manter coesão visual antes de postar.' },
    destaques: { fase: 'Fase 4', desc: 'Jogo de capas de destaque on-brand (uma por categoria) e organização de quais frames de story entram em cada destaque.' },
    inspiracao: { fase: 'Fase 4', desc: 'Cadastro de perfis de referência. Você cola algumas legendas recentes deles 1×/mês e a IA extrai o padrão — sem raspar dados.' },
    comunidade: { fase: 'Fase 4', desc: 'Rotina diária de 15 minutos: a IA sugere onde e o que comentar, você faz na mão. A ferramenta nunca curte ou comenta por você.' },
    desempenho: { fase: 'Fase 2', desc: 'Registro manual leve de métricas (alcance, salvos, compartilhamentos, cliques, cadastros) com leitura da IA sobre o que converte.' },
  }
  const m = meta[tab as Exclude<TabId, 'novo'>]
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <LogoIcon className="mx-auto h-8 w-8 text-forest-300" />
      <p className="mt-3 text-sm font-medium text-forest-900">{m.fase} — em construção</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-soft">{m.desc}</p>
    </div>
  )
}
