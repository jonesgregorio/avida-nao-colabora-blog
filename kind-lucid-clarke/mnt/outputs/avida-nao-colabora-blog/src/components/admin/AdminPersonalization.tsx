import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Sparkles, Loader2, Search, X, Copy,
  Send, Save, Trash2, RefreshCw,
  User, AlertCircle, CheckCircle,
} from 'lucide-react'
import {
  TASK_DEFS, PersonalizationTask, TaskDef, TaskStatus,
  refreshTasksForAllUsers, loadAllOpenTasks, loadTasksForUser,
  formatDueLabel, dueBadgeColors, priorityBadgeColors,
  PRIORITY_LABELS, STATUS_LABELS, TARGET_AREA_LABELS, ACTION_VIEW_MAP,
  generateContentForTask, TaskSnapshot, getTaskDefsForPlan,
  monthKey,
} from '../../lib/personalizationTasks'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Terapêutico Plus',
}
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600',
  essential: 'bg-blue-100 text-blue-700',
  therapeutic: 'bg-purple-100 text-purple-700',
  'therapeutic-plus': 'bg-emerald-100 text-emerald-700',
}

const DISCLAIMER = 'Este conteúdo é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

type TopView = 'queue' | 'history'
type DetailTab = 'pendencias' | 'rascunhos' | 'historico' | 'gerar'

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

interface UserRow {
  user_id: string; full_name: string | null; email: string | null
  plan: string; created_at: string
}
interface Delivery {
  id: string; user_id: string; plan_key: string; content_type: string
  title: string; body: string; target_area: string | null
  ai_generated: boolean; status: string; sent_at: string | null; created_at: string
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

async function buildSnapshot(userId: string, plan: string, taskKey: string): Promise<TaskSnapshot> {
  const [
    { count: diaryCount },
    { data: diaryData },
    { count: qCount },
    { count: savedCount },
    { count: articlesRead },
  ] = await Promise.all([
    supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('diary_entries').select('mood, tags').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event_type', 'article_read'),
  ])
  const tagFreq: Record<string, number> = {}
  let moodSum = 0; let moodCount = 0
  for (const d of (diaryData ?? []) as any[]) {
    if (d.tags && Array.isArray(d.tags)) for (const t of d.tags) tagFreq[t] = (tagFreq[t] ?? 0) + 1
    if (d.mood) { moodSum += d.mood; moodCount++ }
  }
  const topMarkers = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)
  return {
    plan, task: taskKey, period: monthKey(),
    diaryCount: diaryCount ?? 0, topMarkers,
    avgMood: moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null,
    questionnaireCount: qCount ?? 0, articlesRead: articlesRead ?? 0, savedCount: savedCount ?? 0,
  }
}

// ── GenerateModal ─────────────────────────────────────────────────────────────

function GenerateModal({
  task, user, onClose, onSaved, showToast,
}: {
  task: PersonalizationTask & { user_name?: string | null; user_email?: string | null }
  user?: UserRow | null
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const def = TASK_DEFS.find(d => d.key === task.task_key)
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null)
  const [generating, setGenerating] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelNote, setCancelNote] = useState('')

  useEffect(() => {
    buildSnapshot(task.user_id, task.plan_key, task.task_key).then(setSnapshot)
  }, [task.user_id, task.plan_key, task.task_key])

  async function generate() {
    if (!snapshot) return
    setGenerating(true)
    const result = await generateContentForTask({ task_key: task.task_key, task_title: task.task_title, plan_key: task.plan_key }, snapshot)
    const lines = result.split('\n').filter(l => l.trim())
    setEditTitle(lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? task.task_title)
    setEditBody(result)
    await supabase.from('user_personalization_tasks').update({ status: 'generated', generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id)
    setGenerating(false)
    onSaved()
  }

  async function save(sendNow: boolean) {
    if (!editBody.trim() || !editTitle.trim()) { showToast('Preencha título e conteúdo.', true); return }
    sendNow ? setSending(true) : setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const { data: delivery, error: dErr } = await supabase.from('personalized_content_deliveries').insert({
      user_id: task.user_id, created_by: me.user?.id ?? null,
      plan_key: task.plan_key, content_type: task.content_type,
      title: editTitle, body: editBody,
      target_area: task.target_area ?? 'my_evolution', data_snapshot: snapshot ?? {},
      ai_generated: true, status: sendNow ? 'sent' : 'draft',
      sent_at: sendNow ? new Date().toISOString() : null,
    }).select('id').single()
    if (dErr) { showToast('Erro: ' + dErr.message, true); setSaving(false); setSending(false); return }

    await supabase.from('user_personalization_tasks').update({
      status: sendNow ? 'sent' : 'draft',
      delivery_id: delivery?.id ?? null,
      sent_at: sendNow ? new Date().toISOString() : null,
      completed_at: sendNow ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)

    if (sendNow && def) {
      await supabase.from('notifications').insert({
        user_id: task.user_id, title: def.notificationTitle, body: def.notificationBody,
        type: 'system', action_view: ACTION_VIEW_MAP[task.target_area ?? 'my_evolution'] ?? 'my-evolution',
        action_label: 'Ver conteúdo', is_read: false,
      })
      showToast('Enviado e usuário notificado!')
    } else {
      showToast('Rascunho salvo!')
    }
    setSaving(false); setSending(false)
    onSaved(); onClose()
  }

  async function cancelTask() {
    await supabase.from('user_personalization_tasks').update({
      status: 'cancelled', admin_notes: cancelNote || 'Cancelado pelo admin.', updated_at: new Date().toISOString(),
    }).eq('id', task.id)
    showToast('Pendência cancelada.')
    onSaved(); onClose()
  }

  const dueLabel = formatDueLabel(task.due_at)
  const dueCls = dueBadgeColors(task.status as TaskStatus, task.due_at)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-stone-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[task.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[task.plan_key] ?? task.plan_key}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dueCls}`}>{dueLabel}</span>
              {def && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${priorityBadgeColors(def.priority)}`}>{PRIORITY_LABELS[def.priority]}</span>}
            </div>
            <h2 className="font-bold text-stone-800 text-lg">{task.task_title}</h2>
            <p className="text-sm text-stone-500">{task.user_name ?? '(sem nome)'} · {task.user_email ?? '—'}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {def && (
            <div className="bg-stone-50 rounded-xl p-3 text-sm space-y-1">
              <p className="text-stone-600"><span className="font-medium">Motivo:</span> {def.description}</p>
              <p className="text-stone-600"><span className="font-medium">Destino:</span> {TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area ?? '—'}</p>
              {task.due_at && <p className="text-stone-600"><span className="font-medium">Prazo:</span> {new Date(task.due_at).toLocaleDateString('pt-BR')}</p>}
            </div>
          )}

          {!editBody && (
            <button onClick={generate} disabled={generating || !snapshot} className="flex items-center gap-2 w-full justify-center bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Gerando conteúdo com IA...' : 'Gerar conteúdo com IA'}
            </button>
          )}

          {editBody && (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-stone-500 block mb-1">Título</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">Conteúdo — revise antes de enviar</label>
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={10} className={inputCls + ' font-mono text-xs resize-y'} />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-700 italic">{DISCLAIMER}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={generate} disabled={generating} className="flex items-center gap-1.5 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50">
                  <RefreshCw className="w-3.5 h-3.5" /> Gerar novamente
                </button>
                <button onClick={() => navigator.clipboard.writeText(editBody).catch(() => {})} className="flex items-center gap-1.5 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50">
                  <Copy className="w-3.5 h-3.5" /> Copiar
                </button>
                <button onClick={() => save(false)} disabled={saving || sending} className="flex items-center gap-1.5 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Rascunho
                </button>
                <button onClick={() => save(true)} disabled={saving || sending} className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar
                </button>
                <button onClick={() => { setEditBody(''); setEditTitle('') }} className="flex items-center gap-1.5 text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" /> Descartar
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-stone-100 pt-3">
            {!showCancel ? (
              <button onClick={() => setShowCancel(true)} className="text-xs text-stone-400 hover:text-red-500">Cancelar esta pendência</button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-stone-500 font-medium">Motivo do cancelamento:</p>
                <input value={cancelNote} onChange={e => setCancelNote(e.target.value)} className={inputCls} placeholder="Opcional..." />
                <div className="flex gap-2">
                  <button onClick={cancelTask} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg">Confirmar</button>
                  <button onClick={() => setShowCancel(false)} className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg">Voltar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Cards de resumo ───────────────────────────────────────────────────────────

function SummaryCards({ tasks, deliveries }: { tasks: PersonalizationTask[]; deliveries: Delivery[] }) {
  const today = new Date().toDateString()
  const curMonth = monthKey()
  const open = tasks.filter(t => ['pending', 'overdue', 'generated', 'draft'].includes(t.status))
  const todayTasks = tasks.filter(t => t.due_at && new Date(t.due_at).toDateString() === today && t.status === 'pending')
  const overdue = tasks.filter(t => t.status === 'overdue')
  const drafts = tasks.filter(t => t.status === 'draft')
  const sentThisMonth = deliveries.filter(d => d.sent_at && d.sent_at.startsWith(curMonth))
  const usersWithPending = new Set(open.map(t => t.user_id)).size

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      {[
        { label: 'Pendências abertas', value: open.length, color: 'text-stone-700', bg: 'bg-stone-50' },
        { label: 'Vencem hoje', value: todayTasks.length, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Atrasadas', value: overdue.length, color: 'text-red-600', bg: 'bg-red-50' },
        { label: 'Em rascunho', value: drafts.length, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Enviadas este mês', value: sentThisMonth.length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Usuários com pendência', value: usersWithPending, color: 'text-purple-600', bg: 'bg-purple-50' },
      ].map(c => (
        <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center`}>
          <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-xs text-stone-500 mt-0.5 leading-tight">{c.label}</p>
        </div>
      ))}
    </div>
  )
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({ task, profileMap, onGenerate, onSelectUser }: {
  task: PersonalizationTask; profileMap: Record<string, UserRow>
  onGenerate: (t: PersonalizationTask & { user_name?: string | null; user_email?: string | null }) => void
  onSelectUser: (uid: string) => void
}) {
  const profile = profileMap[task.user_id]
  const def = TASK_DEFS.find(d => d.key === task.task_key)
  return (
    <tr className="border-b border-stone-100 hover:bg-stone-50/50">
      <td className="py-3 px-3">
        <button onClick={() => onSelectUser(task.user_id)} className="text-left group">
          <p className="text-sm font-medium text-stone-800 group-hover:text-emerald-700">{profile?.full_name ?? '(sem nome)'}</p>
          <p className="text-xs text-stone-400">{profile?.email ?? '—'}</p>
        </button>
      </td>
      <td className="py-3 px-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[task.plan_key] ?? 'bg-stone-100 text-stone-600'}`}>{PLAN_LABELS[task.plan_key] ?? task.plan_key}</span>
      </td>
      <td className="py-3 px-3">
        <p className="text-sm text-stone-700">{task.task_title}</p>
        <p className="text-xs text-stone-400">{TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area}</p>
      </td>
      <td className="py-3 px-3 text-xs text-stone-500 whitespace-nowrap">{task.due_at ? new Date(task.due_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td className="py-3 px-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${dueBadgeColors(task.status as TaskStatus, task.due_at)}`}>{formatDueLabel(task.due_at)}</span>
      </td>
      <td className="py-3 px-3">
        {def && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${priorityBadgeColors(def.priority)}`}>{PRIORITY_LABELS[def.priority]}</span>}
      </td>
      <td className="py-3 px-3 text-xs text-stone-500 whitespace-nowrap">{STATUS_LABELS[task.status] ?? task.status}</td>
      <td className="py-3 px-3">
        <button onClick={() => onGenerate({ ...task, user_name: profile?.full_name, user_email: profile?.email })} className="flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium whitespace-nowrap">
          <Sparkles className="w-3 h-3" /> Gerar com IA
        </button>
      </td>
    </tr>
  )
}

// ── Queue view ────────────────────────────────────────────────────────────────

function QueueView({ tasks, profileMap, onGenerate, onSelectUser, loading }: {
  tasks: PersonalizationTask[]; profileMap: Record<string, UserRow>
  onGenerate: (t: PersonalizationTask & { user_name?: string | null; user_email?: string | null }) => void
  onSelectUser: (uid: string) => void; loading: boolean
}) {
  const [statusFilter, setStatusFilter] = useState('open')
  const [planFilter, setPlanFilter] = useState('all')
  const [contentFilter, setContentFilter] = useState('all')
  const [search, setSearch] = useState('')

  const CONTENT_TYPES = [...new Set(TASK_DEFS.map(d => d.contentType))]

  const filtered = tasks.filter(t => {
    if (planFilter !== 'all' && t.plan_key !== planFilter) return false
    if (contentFilter !== 'all' && t.content_type !== contentFilter) return false
    if (statusFilter === 'open' && !['pending', 'overdue', 'generated', 'draft'].includes(t.status)) return false
    if (statusFilter === 'pending' && t.status !== 'pending') return false
    if (statusFilter === 'overdue' && t.status !== 'overdue') return false
    if (statusFilter === 'draft' && t.status !== 'draft') return false
    if (statusFilter === 'today') {
      if (!t.due_at || new Date(t.due_at).toDateString() !== new Date().toDateString()) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const p = profileMap[t.user_id]
      return t.task_title.toLowerCase().includes(q) ||
        (p?.full_name ?? '').toLowerCase().includes(q) ||
        (p?.email ?? '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-300" /></div>

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar usuário ou pendência..." className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-stone-400" /></button>}
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white focus:outline-none">
          <option value="open">Abertas</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Atrasadas</option>
          <option value="draft">Rascunhos</option>
          <option value="today">Vencem hoje</option>
          <option value="all">Todas</option>
        </select>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white focus:outline-none">
          <option value="all">Todos os planos</option>
          {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={contentFilter} onChange={e => setContentFilter(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white focus:outline-none">
          <option value="all">Todos os tipos</option>
          {CONTENT_TYPES.map(ct => (
            <option key={ct} value={ct}>{TASK_DEFS.find(d => d.contentType === ct)?.title ?? ct}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-emerald-200" />
          <p className="text-sm text-stone-400">Nenhuma pendência encontrada com esses filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  {['Usuário', 'Plano', 'Pendência', 'Data limite', 'Prazo', 'Prioridade', 'Status', 'Ação'].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <TaskRow key={t.id} task={t} profileMap={profileMap} onGenerate={onGenerate} onSelectUser={onSelectUser} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-stone-100 text-xs text-stone-400">
            {filtered.length} pendência{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

// ── History view ──────────────────────────────────────────────────────────────

function HistoryView({ profileMap }: { profileMap: Record<string, UserRow> }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState(monthKey())

  useEffect(() => {
    setLoading(true)
    supabase.from('personalized_content_deliveries').select('*').eq('status', 'sent')
      .gte('sent_at', `${monthFilter}-01`).lte('sent_at', `${monthFilter}-31`)
      .order('sent_at', { ascending: false }).limit(200)
      .then(({ data }) => { setDeliveries((data ?? []) as Delivery[]); setLoading(false) })
  }, [monthFilter])

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none" />
        <span className="text-sm text-stone-400">{deliveries.length} envio{deliveries.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-stone-300" /></div>
      ) : deliveries.length === 0 ? (
        <p className="text-center py-12 text-stone-400 text-sm">Nenhum envio neste mês.</p>
      ) : (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  {['Data', 'Usuário', 'Plano', 'Função enviada', 'Destino', ''].map(h => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deliveries.map(d => {
                  const profile = profileMap[d.user_id]
                  return (
                    <tr key={d.id} className="border-b border-stone-100 hover:bg-stone-50/50">
                      <td className="py-2.5 px-3 text-xs text-stone-500 whitespace-nowrap">{d.sent_at ? new Date(d.sent_at).toLocaleDateString('pt-BR') : '—'}</td>
                      <td className="py-2.5 px-3">
                        <p className="text-sm font-medium text-stone-700">{profile?.full_name ?? '(sem nome)'}</p>
                        <p className="text-xs text-stone-400">{profile?.email ?? '—'}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[d.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[d.plan_key] ?? d.plan_key}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="text-sm text-stone-700">{d.title}</p>
                        <p className="text-xs text-stone-400">{d.content_type}</p>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-stone-500">{TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area ?? '—'}</td>
                      <td className="py-2.5 px-3">
                        <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="text-xs text-emerald-600 hover:text-emerald-700">{expanded === d.id ? 'Fechar' : 'Ver'}</button>
                        {expanded === d.id && (
                          <div className="mt-2 bg-stone-50 rounded-lg p-2 max-w-xs">
                            <p className="text-xs text-stone-600 whitespace-pre-wrap line-clamp-6">{d.body}</p>
                            <button onClick={() => navigator.clipboard.writeText(d.body).catch(() => {})} className="text-xs text-stone-400 hover:text-stone-600 mt-1 flex items-center gap-1"><Copy className="w-2.5 h-2.5" /> Copiar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TabPendencias (no detalhe do usuário) ─────────────────────────────────────

function TabPendencias({ user, onGenerate, onRefresh }: {
  user: UserRow
  onGenerate: (t: PersonalizationTask & { user_name?: string | null; user_email?: string | null }) => void
  onRefresh: () => void
}) {
  const [tasks, setTasks] = useState<PersonalizationTask[]>([])
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<'open' | 'draft' | 'sent' | 'other'>('open')

  const load = useCallback(async () => {
    setLoading(true)
    setTasks(await loadTasksForUser(user.user_id))
    setLoading(false)
  }, [user.user_id])

  useEffect(() => { load() }, [load])

  const open = tasks.filter(t => ['pending', 'overdue', 'generated'].includes(t.status))
  const draft = tasks.filter(t => t.status === 'draft')
  const sent = tasks.filter(t => t.status === 'sent')
  const other = tasks.filter(t => ['expired', 'cancelled', 'not_applicable'].includes(t.status))
  const shown = { open, draft, sent, other }[sub]

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-stone-300" /></div>

  return (
    <div>
      <div className="flex gap-1 border-b border-stone-100 mb-4 overflow-x-auto">
        {[
          ['open', `Abertas (${open.length})`],
          ['draft', `Rascunhos (${draft.length})`],
          ['sent', `Enviadas (${sent.length})`],
          ['other', `Expiradas/Canceladas (${other.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setSub(id as typeof sub)} className={`text-xs px-3 py-2 whitespace-nowrap border-b-2 transition-colors ${sub === id ? 'border-emerald-600 text-emerald-700 font-medium' : 'border-transparent text-stone-500'}`}>{label}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">Nenhuma pendência nesta categoria.</p>
      ) : (
        <div className="space-y-2">
          {shown.map(t => {
            const def = TASK_DEFS.find(d => d.key === t.task_key)
            return (
              <div key={t.id} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {def && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${priorityBadgeColors(def.priority)}`}>{PRIORITY_LABELS[def.priority]}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${dueBadgeColors(t.status as TaskStatus, t.due_at)}`}>{formatDueLabel(t.due_at)}</span>
                      <span className="text-[10px] text-stone-400">{STATUS_LABELS[t.status]}</span>
                    </div>
                    <p className="text-sm font-medium text-stone-800">{t.task_title}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{def?.description}</p>
                    {t.due_at && <p className="text-xs text-stone-400">Prazo: {new Date(t.due_at).toLocaleDateString('pt-BR')}</p>}
                    <p className="text-xs text-stone-400">Destino: {TARGET_AREA_LABELS[t.target_area ?? ''] ?? t.target_area}</p>
                  </div>
                  {['pending', 'overdue', 'generated', 'draft'].includes(t.status) && (
                    <button onClick={() => onGenerate({ ...t, user_name: user.full_name, user_email: user.email })} className="flex-shrink-0 flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium">
                      <Sparkles className="w-3 h-3" /> {t.status === 'draft' ? 'Editar/Enviar' : 'Gerar com IA'}
                    </button>
                  )}
                </div>
                {t.admin_notes && <p className="text-xs text-stone-400 italic">Nota: {t.admin_notes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── DraftsList ────────────────────────────────────────────────────────────────

function DraftsList({ deliveries, user, showToast, onRefresh }: { deliveries: Delivery[]; user: UserRow; showToast: (m: string, e?: boolean) => void; onRefresh: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState(''); const [editBody, setEditBody] = useState(''); const [saving, setSaving] = useState(false)

  async function send(d: Delivery) {
    setSaving(true)
    await supabase.from('personalized_content_deliveries').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', d.id)
    await supabase.from('notifications').insert({
      user_id: user.user_id, title: 'Novo conteúdo personalizado disponível',
      body: d.title, type: 'system',
      action_view: ACTION_VIEW_MAP[d.target_area ?? ''] ?? 'my-evolution', action_label: 'Ver conteúdo', is_read: false,
    })
    showToast('Enviado!'); setSaving(false); onRefresh()
  }

  if (deliveries.length === 0) return <p className="text-sm text-stone-400 py-8 text-center">Nenhum rascunho.</p>
  return (
    <div className="space-y-3 max-w-2xl">
      {deliveries.map(d => (
        <div key={d.id} className="bg-white border border-stone-200 rounded-xl p-4 space-y-2">
          {editingId === d.id ? (
            <>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8} className={inputCls + ' text-xs font-mono resize-y'} />
              <div className="flex gap-2">
                <button onClick={async () => { setSaving(true); await supabase.from('personalized_content_deliveries').update({ title: editTitle, body: editBody, updated_at: new Date().toISOString() }).eq('id', d.id); setSaving(false); setEditingId(null); showToast('Atualizado.'); onRefresh() }} disabled={saving} className="text-xs bg-stone-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50">Salvar</button>
                <button onClick={() => setEditingId(null)} className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg">Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-stone-800 text-sm">{d.title}</p>
              <p className="text-xs text-stone-400">{d.content_type} · {TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area} · {new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
              <p className="text-xs text-stone-500 line-clamp-2">{d.body}</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => { setEditingId(d.id); setEditTitle(d.title); setEditBody(d.body) }} className="text-xs border border-stone-200 text-stone-600 px-2.5 py-1 rounded-lg hover:bg-stone-50">Editar</button>
                <button onClick={() => send(d)} disabled={saving} className="text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"><Send className="w-3 h-3" /> Enviar</button>
                <button onClick={async () => { await supabase.from('personalized_content_deliveries').update({ status: 'archived' }).eq('id', d.id); onRefresh() }} className="text-xs text-red-400 border border-red-100 px-2.5 py-1 rounded-lg hover:bg-red-50">Arquivar</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── HistoryList ────────────────────────────────────────────────────────────────

function HistoryList({ deliveries }: { deliveries: Delivery[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (deliveries.length === 0) return <p className="text-sm text-stone-400 py-8 text-center">Nenhum envio ainda.</p>
  return (
    <div className="space-y-2 max-w-2xl">
      {deliveries.map(d => (
        <div key={d.id} className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-stone-800">{d.title}</p>
              <p className="text-xs text-stone-400">{TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area} · Enviado em {d.sent_at ? new Date(d.sent_at).toLocaleDateString('pt-BR') : '—'}{d.ai_generated ? ' · ✦ IA' : ''}</p>
            </div>
            <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="text-xs text-emerald-600 hover:text-emerald-700 flex-shrink-0">{expanded === d.id ? 'Fechar' : 'Ver'}</button>
          </div>
          {expanded === d.id && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{d.body}</p>
              <button onClick={() => navigator.clipboard.writeText(d.body).catch(() => {})} className="mt-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"><Copy className="w-3 h-3" /> Copiar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── FreeGenerateTab ────────────────────────────────────────────────────────────

function FreeGenerateTab({ user, showToast, onSaved }: { user: UserRow; showToast: (m: string, e?: boolean) => void; onSaved: () => void }) {
  const defs = getTaskDefsForPlan(user.plan)
  const [taskKey, setTaskKey] = useState(defs[0]?.key ?? '')
  const [generating, setGenerating] = useState(false)
  const [editTitle, setEditTitle] = useState(''); const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false); const [sending, setSending] = useState(false)
  const def = defs.find(d => d.key === taskKey)

  async function generate() {
    if (!def) return
    setGenerating(true)
    const snap = await buildSnapshot(user.user_id, user.plan, taskKey)
    const result = await generateContentForTask({ task_key: taskKey, task_title: def.title, plan_key: user.plan }, snap)
    const lines = result.split('\n').filter(l => l.trim())
    setEditTitle(lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? def.title)
    setEditBody(result)
    setGenerating(false)
  }

  async function save(sendNow: boolean) {
    if (!editBody.trim() || !editTitle.trim() || !def) return
    sendNow ? setSending(true) : setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const snap = await buildSnapshot(user.user_id, user.plan, taskKey)
    const { error } = await supabase.from('personalized_content_deliveries').insert({
      user_id: user.user_id, created_by: me.user?.id ?? null,
      plan_key: user.plan, content_type: def.contentType,
      title: editTitle, body: editBody, target_area: def.targetArea,
      data_snapshot: snap, ai_generated: true,
      status: sendNow ? 'sent' : 'draft', sent_at: sendNow ? new Date().toISOString() : null,
    })
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); setSending(false); return }
    if (sendNow) {
      await supabase.from('notifications').insert({ user_id: user.user_id, title: def.notificationTitle, body: def.notificationBody, type: 'system', action_view: ACTION_VIEW_MAP[def.targetArea] ?? 'my-evolution', action_label: 'Ver conteúdo', is_read: false })
      showToast('Enviado!')
    } else { showToast('Rascunho salvo!') }
    setSaving(false); setSending(false); setEditBody(''); setEditTitle(''); onSaved()
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-700">Gere um conteúdo livre (fora das pendências automáticas) para este usuário.</div>
      <div>
        <label className="text-xs text-stone-500 block mb-1">Tipo de conteúdo</label>
        <select value={taskKey} onChange={e => setTaskKey(e.target.value)} className={inputCls}>
          {defs.map(d => <option key={d.key} value={d.key}>{d.title}</option>)}
        </select>
        {def && <p className="text-xs text-stone-400 mt-1">Destino: {TARGET_AREA_LABELS[def.targetArea] ?? def.targetArea}</p>}
      </div>
      <button onClick={generate} disabled={generating || !taskKey} className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {generating ? 'Gerando...' : 'Gerar com IA'}
      </button>
      {editBody && (
        <div className="space-y-3">
          <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
          <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={10} className={inputCls + ' text-xs font-mono resize-y'} />
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-700 italic">{DISCLAIMER}</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => save(false)} disabled={saving || sending} className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">{saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Rascunho</button>
            <button onClick={() => save(true)} disabled={saving || sending} className="text-xs bg-emerald-600 text-white px-4 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50">{sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar</button>
            <button onClick={() => { setEditBody(''); setEditTitle('') }} className="text-xs text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Descartar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── UserDetailPanel ────────────────────────────────────────────────────────────

function UserDetailPanel({ user, onBack, showToast, onRefresh }: { user: UserRow; onBack: () => void; showToast: (m: string, e?: boolean) => void; onRefresh: () => void }) {
  const [tab, setTab] = useState<DetailTab>('pendencias')
  const [generateTask, setGenerateTask] = useState<(PersonalizationTask & { user_name?: string | null; user_email?: string | null }) | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])

  const loadDeliveries = useCallback(() => {
    supabase.from('personalized_content_deliveries').select('*').eq('user_id', user.user_id)
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setDeliveries((data ?? []) as Delivery[]))
  }, [user.user_id])

  useEffect(() => { loadDeliveries() }, [loadDeliveries])

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'pendencias', label: 'Pendências' },
    { id: 'rascunhos', label: `Rascunhos (${deliveries.filter(d => d.status === 'draft').length})` },
    { id: 'historico', label: `Histórico (${deliveries.filter(d => d.status === 'sent').length})` },
    { id: 'gerar', label: '✦ Gerar livre' },
  ]

  return (
    <div>
      {generateTask && (
        <GenerateModal task={generateTask} user={user} onClose={() => setGenerateTask(null)} onSaved={() => { setGenerateTask(null); onRefresh(); loadDeliveries() }} showToast={showToast} />
      )}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700">← Voltar</button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center"><User className="w-4 h-4 text-stone-400" /></div>
          <div>
            <p className="font-semibold text-stone-800 text-sm">{user.full_name ?? '(sem nome)'}</p>
            <p className="text-xs text-stone-400">{user.email ?? '—'}</p>
          </div>
          <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[user.plan] ?? 'bg-stone-100'}`}>{PLAN_LABELS[user.plan] ?? user.plan}</span>
        </div>
      </div>
      <div className="flex gap-1 border-b border-stone-200 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap font-medium ${tab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'pendencias' && <TabPendencias user={user} onGenerate={setGenerateTask} onRefresh={() => { onRefresh(); loadDeliveries() }} />}
      {tab === 'rascunhos' && <DraftsList deliveries={deliveries.filter(d => d.status === 'draft')} user={user} showToast={showToast} onRefresh={loadDeliveries} />}
      {tab === 'historico' && <HistoryList deliveries={deliveries.filter(d => d.status === 'sent')} />}
      {tab === 'gerar' && <FreeGenerateTab user={user} showToast={showToast} onSaved={() => { onRefresh(); loadDeliveries() }} />}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminPersonalization() {
  const [topView, setTopView] = useState<TopView>('queue')
  const [tasks, setTasks] = useState<PersonalizationTask[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, UserRow>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [generateTask, setGenerateTask] = useState<(PersonalizationTask & { user_name?: string | null; user_email?: string | null }) | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    const [openTasks, { data: profiles }, { data: delivs }] = await Promise.all([
      loadAllOpenTasks(),
      supabase.from('profiles').select('user_id, full_name, email, plan, created_at').limit(500),
      supabase.from('personalized_content_deliveries').select('*').eq('status', 'sent').order('sent_at', { ascending: false }).limit(500),
    ])
    const map: Record<string, UserRow> = {}
    for (const p of (profiles ?? []) as UserRow[]) map[p.user_id] = p
    setTasks(openTasks)
    setProfileMap(map)
    setDeliveries((delivs ?? []) as Delivery[])
    setLoading(false)
  }, [])

  const refreshTasks = useCallback(async () => {
    setRefreshing(true)
    const result = await refreshTasksForAllUsers()
    if (result.errors.length > 0) showToast('Erros: ' + result.errors.slice(0, 2).join('; '), true)
    else showToast(`Atualizado: ${result.created} criadas, ${result.updated} atualizadas.`)
    await loadData()
    setRefreshing(false)
  }, [loadData])

  useEffect(() => {
    setLoading(true)
    loadData().then(() => refreshTasks())
  }, [])

  const selectedUser = selectedUserId ? profileMap[selectedUserId] : null

  const toastEl = toast && (
    <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>{toast.msg}</div>
  )

  if (selectedUser) {
    return (
      <div>
        {toastEl}
        <UserDetailPanel user={selectedUser} onBack={() => setSelectedUserId(null)} showToast={showToast} onRefresh={loadData} />
      </div>
    )
  }

  return (
    <div>
      {toastEl}
      {generateTask && (
        <GenerateModal task={generateTask} onClose={() => setGenerateTask(null)} onSaved={() => { setGenerateTask(null); loadData() }} showToast={showToast} />
      )}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" /> Personalização por Plano
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Fila inteligente de entregas personalizadas por plano</p>
        </div>
        <button onClick={refreshTasks} disabled={refreshing} className="flex items-center gap-2 text-sm border border-stone-200 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50">
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {refreshing ? 'Atualizando...' : 'Atualizar pendências'}
        </button>
      </div>
      <SummaryCards tasks={tasks} deliveries={deliveries} />
      <div className="flex gap-1 border-b border-stone-200 mb-5">
        {([['queue', 'Fila de Trabalho'], ['history', 'Histórico de Entregas']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTopView(id)} className={`text-sm px-4 py-2.5 border-b-2 transition-colors font-medium ${topView === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>{label}</button>
        ))}
      </div>
      {topView === 'queue' && <QueueView tasks={tasks} profileMap={profileMap} onGenerate={setGenerateTask} onSelectUser={setSelectedUserId} loading={loading} />}
      {topView === 'history' && <HistoryView profileMap={profileMap} />}
    </div>
  )
}
