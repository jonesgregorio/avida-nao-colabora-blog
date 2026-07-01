import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Sparkles, Loader2, Search, X, Copy, Send, Save, Trash2, RefreshCw,
  User, CheckCircle, Square, CheckSquare, AlertTriangle, Clock,
  ChevronDown, ChevronUp, Ban, Check,
} from 'lucide-react'
import {
  TASK_DEFS, PersonalizationTask, TaskStatus,
  loadAllTasksForAdmin, loadTasksForUser,
  formatDueLabel, dueBadgeColors, priorityBadgeColors,
  PRIORITY_LABELS, STATUS_LABELS, TARGET_AREA_LABELS, ACTION_VIEW_MAP,
  generateContentForTask, TaskSnapshot, getTaskDefsForPlan, monthKey,
  refreshTasksForAllUsers,
} from '../../lib/personalizationTasks'

// ── Constants ─────────────────────────────────────────────────────────────────

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
const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminTab = 'queue' | 'drafts' | 'resolved' | 'overdue' | 'cancelled' | 'history'

interface Filters {
  search: string; plan: string; taskKey: string; priority: string; deadline: string
}

interface BulkProgress {
  total: number; done: number; active: boolean; complete: boolean
  failed: Array<{ id: string; title: string; error: string }>
  skipped: Array<{ id: string; title: string }>
}

interface UserRow {
  user_id: string; full_name: string | null; email: string | null; plan: string; created_at: string
}

interface Delivery {
  id: string; user_id: string; plan_key: string; content_type: string
  title: string; body: string; target_area: string | null
  ai_generated: boolean; status: string; sent_at: string | null
  created_at: string; task_id?: string | null; read_at?: string | null
}

const TAB_CONFIG: { id: AdminTab; label: string; statuses: string[] }[] = [
  { id: 'queue', label: 'Fila de trabalho', statuses: ['pending', 'overdue'] },
  { id: 'drafts', label: 'Rascunhos', statuses: ['draft', 'generated'] },
  { id: 'resolved', label: 'Resolvidas', statuses: ['sent', 'resolved', 'completed'] },
  { id: 'overdue', label: 'Atrasadas', statuses: ['overdue'] },
  { id: 'cancelled', label: 'Canceladas', statuses: ['cancelled'] },
  { id: 'history', label: 'Histórico de envios', statuses: [] },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildSnapshot(userId: string, plan: string, taskKey: string): Promise<TaskSnapshot> {
  const [
    { count: diaryCount }, { data: diaryData },
    { count: qCount }, { count: savedCount }, { count: articlesRead },
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

function applyFilters(task: PersonalizationTask, filters: Filters, profileMap: Record<string, UserRow>): boolean {
  const profile = profileMap[task.user_id]
  if (filters.plan !== 'all' && task.plan_key !== filters.plan) return false
  if (filters.taskKey !== 'all' && task.task_key !== filters.taskKey) return false
  if (filters.priority !== 'all') {
    const def = TASK_DEFS.find(d => d.key === task.task_key)
    if (def?.priority !== filters.priority) return false
  }
  if (filters.deadline !== 'all' && task.due_at) {
    const diff = Math.round((new Date(task.due_at).getTime() - Date.now()) / 86400000)
    if (filters.deadline === 'today' && diff !== 0) return false
    if (filters.deadline === 'tomorrow' && diff !== 1) return false
    if (filters.deadline === 'week' && (diff < 0 || diff > 7)) return false
    if (filters.deadline === 'overdue' && diff >= 0) return false
    if (filters.deadline === 'overdue7' && diff >= -7) return false
  }
  if (filters.search) {
    const q = filters.search.toLowerCase()
    return task.task_title.toLowerCase().includes(q) ||
      (profile?.full_name ?? '').toLowerCase().includes(q) ||
      (profile?.email ?? '').toLowerCase().includes(q) ||
      (PLAN_LABELS[task.plan_key] ?? '').toLowerCase().includes(q)
  }
  return true
}

async function sendTaskContent(task: PersonalizationTask, delivery: Delivery, def: typeof TASK_DEFS[0] | undefined, adminId: string | null) {
  await supabase.from('personalized_content_deliveries').update({
    status: 'sent', sent_at: new Date().toISOString(),
  }).eq('id', delivery.id)

  await supabase.from('user_personalization_tasks').update({
    status: 'sent', sent_at: new Date().toISOString(),
    completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', task.id)

  if (def) {
    await supabase.from('notifications').insert({
      user_id: task.user_id, title: def.notificationTitle, body: def.notificationBody,
      type: 'system', action_view: ACTION_VIEW_MAP[task.target_area ?? 'my_evolution'] ?? 'my-evolution',
      action_label: 'Ver conteúdo', is_read: false,
    })
  }
}

// ── GenerateModal ─────────────────────────────────────────────────────────────

function GenerateModal({ task, profileMap, onClose, onSaved, showToast }: {
  task: PersonalizationTask
  profileMap: Record<string, UserRow>
  onClose: () => void
  onSaved: () => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const def = TASK_DEFS.find(d => d.key === task.task_key)
  const profile = profileMap[task.user_id]
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(null)
  const [existingDelivery, setExistingDelivery] = useState<Delivery | null>(null)
  const [askExisting, setAskExisting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelNote, setCancelNote] = useState('')

  useEffect(() => {
    if (task.delivery_id) {
      supabase.from('personalized_content_deliveries').select('*').eq('id', task.delivery_id).single()
        .then(({ data }) => {
          if (data) {
            setExistingDelivery(data as Delivery)
            setEditTitle(data.title)
            setEditBody(data.body)
            if (task.status === 'draft') setAskExisting(true)
          } else {
            buildSnapshot(task.user_id, task.plan_key, task.task_key).then(setSnapshot)
          }
        })
    } else {
      buildSnapshot(task.user_id, task.plan_key, task.task_key).then(setSnapshot)
    }
  }, [task.id])

  async function generate() {
    const snap = snapshot ?? (await buildSnapshot(task.user_id, task.plan_key, task.task_key))
    setSnapshot(snap)
    setGenerating(true)
    setAskExisting(false)
    try {
      const result = await generateContentForTask({ task_key: task.task_key, task_title: task.task_title, plan_key: task.plan_key }, snap)
      const lines = result.split('\n').filter(l => l.trim())
      setEditTitle(lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? task.task_title)
      setEditBody(result)
      await supabase.from('user_personalization_tasks').update({ status: 'generated', generated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', task.id)
      onSaved()
    } catch (e) {
      showToast('Erro ao gerar: ' + String(e), true)
    }
    setGenerating(false)
  }

  async function save(sendNow: boolean) {
    if (!editBody.trim() || !editTitle.trim()) { showToast('Preencha título e conteúdo.', true); return }
    sendNow ? setSending(true) : setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const snap = snapshot ?? await buildSnapshot(task.user_id, task.plan_key, task.task_key)

    let deliveryId = existingDelivery?.id ?? null

    if (deliveryId) {
      await supabase.from('personalized_content_deliveries').update({ title: editTitle, body: editBody, status: sendNow ? 'sent' : 'draft', sent_at: sendNow ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', deliveryId)
    } else {
      const { data: d } = await supabase.from('personalized_content_deliveries').insert({
        user_id: task.user_id, created_by: me.user?.id ?? null, plan_key: task.plan_key,
        content_type: task.content_type, title: editTitle, body: editBody,
        target_area: task.target_area ?? 'my_evolution', data_snapshot: snap,
        ai_generated: true, status: sendNow ? 'sent' : 'draft',
        sent_at: sendNow ? new Date().toISOString() : null, task_id: task.id,
      }).select('id').single()
      deliveryId = d?.id ?? null
    }

    await supabase.from('user_personalization_tasks').update({
      status: sendNow ? 'sent' : 'draft', delivery_id: deliveryId,
      sent_at: sendNow ? new Date().toISOString() : null,
      completed_at: sendNow ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', task.id)

    if (sendNow && def && deliveryId) {
      await supabase.from('notifications').insert({
        user_id: task.user_id, title: def.notificationTitle, body: def.notificationBody,
        type: 'system', action_view: ACTION_VIEW_MAP[task.target_area ?? 'my_evolution'] ?? 'my-evolution',
        action_label: 'Ver conteúdo', is_read: false,
      })
      showToast('Conteúdo enviado e usuário notificado!')
    } else {
      showToast('Rascunho salvo!')
    }
    setSaving(false); setSending(false)
    onSaved(); onClose()
  }

  async function cancelTask() {
    await supabase.from('user_personalization_tasks').update({ status: 'cancelled', admin_notes: cancelNote || 'Cancelado pelo admin.', updated_at: new Date().toISOString() }).eq('id', task.id)
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
            <p className="text-sm text-stone-500">{profile?.full_name ?? '(sem nome)'} · {profile?.email ?? '—'}</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {def && (
            <div className="bg-stone-50 rounded-xl p-3 text-sm space-y-1">
              <p><span className="font-medium text-stone-700">Motivo:</span> <span className="text-stone-600">{def.description}</span></p>
              <p><span className="font-medium text-stone-700">Destino:</span> <span className="text-stone-600">{TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area ?? '—'}</span></p>
              {task.due_at && <p><span className="font-medium text-stone-700">Prazo:</span> <span className="text-stone-600">{new Date(task.due_at).toLocaleDateString('pt-BR')}</span></p>}
            </div>
          )}

          {/* Rascunho existente */}
          {askExisting && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-blue-800">Já existe um rascunho salvo para esta pendência.</p>
              <p className="text-sm text-blue-700">Deseja editar o rascunho existente ou gerar um novo conteúdo?</p>
              <div className="flex gap-2">
                <button onClick={() => setAskExisting(false)} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">Editar rascunho existente</button>
                <button onClick={generate} className="text-sm border border-blue-300 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100">Gerar novamente com IA</button>
              </div>
            </div>
          )}

          {/* Botão gerar */}
          {!editBody && !askExisting && (
            <button onClick={generate} disabled={generating || !snapshot} className="flex items-center gap-2 w-full justify-center bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 disabled:opacity-50 font-medium">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Gerando conteúdo exato com IA...' : 'Gerar conteúdo com IA'}
            </button>
          )}

          {/* Editor */}
          {editBody && !askExisting && (
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
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar rascunho
                </button>
                <button onClick={() => save(true)} disabled={saving || sending} className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar ao usuário
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

// ── BulkGenerateModal ─────────────────────────────────────────────────────────

function BulkGenerateModal({ tasks, profileMap, onClose, onDone, showToast }: {
  tasks: PersonalizationTask[]
  profileMap: Record<string, UserRow>
  onClose: () => void
  onDone: () => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const [progress, setProgress] = useState<BulkProgress | null>(null)

  async function run() {
    const { data: me } = await supabase.auth.getUser()
    const prog: BulkProgress = { total: tasks.length, done: 0, active: true, complete: false, failed: [], skipped: [] }
    setProgress({ ...prog })

    for (const task of tasks) {
      // Se já tem rascunho, skip
      if (task.delivery_id && task.status === 'draft') {
        prog.skipped.push({ id: task.id, title: task.task_title })
        prog.done++
        setProgress({ ...prog })
        continue
      }

      try {
        const snap = await buildSnapshot(task.user_id, task.plan_key, task.task_key)
        const result = await generateContentForTask({ task_key: task.task_key, task_title: task.task_title, plan_key: task.plan_key }, snap)
        const lines = result.split('\n').filter(l => l.trim())
        const title = lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? task.task_title

        const { data: delivery } = await supabase.from('personalized_content_deliveries').insert({
          user_id: task.user_id, created_by: me.user?.id ?? null,
          plan_key: task.plan_key, content_type: task.content_type,
          title, body: result, target_area: task.target_area ?? 'my_evolution',
          data_snapshot: snap, ai_generated: true, status: 'draft', task_id: task.id,
        }).select('id').single()

        await supabase.from('user_personalization_tasks').update({
          status: 'draft', delivery_id: delivery?.id ?? null,
          generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', task.id)

        prog.done++
        setProgress({ ...prog })
      } catch (e) {
        prog.failed.push({ id: task.id, title: task.task_title, error: String(e) })
        prog.done++
        setProgress({ ...prog })
      }
    }

    prog.active = false
    prog.complete = true
    setProgress({ ...prog })
    onDone()
  }

  const generated = progress ? progress.done - progress.failed.length - progress.skipped.length : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-stone-100 flex items-start justify-between">
          <h2 className="font-bold text-stone-800">Gerar conteúdos com IA</h2>
          {!progress?.active && <button onClick={onClose}><X className="w-5 h-5 text-stone-400" /></button>}
        </div>

        <div className="p-5 space-y-4">
          {!progress && (
            <>
              <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-stone-700">Você está prestes a gerar conteúdos para <span className="text-emerald-700">{tasks.length} pendências</span>.</p>
                <p className="text-sm text-stone-500">Cada conteúdo será criado individualmente de acordo com o plano, perfil do usuário e tipo da pendência.</p>
                <p className="text-sm text-stone-500 font-medium">Os conteúdos serão salvos como <span className="text-blue-600">rascunho</span> e NÃO serão enviados automaticamente.</p>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {tasks.map(t => {
                  const p = profileMap[t.user_id]
                  return (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 rounded-lg px-2 py-1.5">
                      <span className="truncate font-medium">{p?.full_name ?? '(sem nome)'}</span>
                      <span className="text-stone-400">·</span>
                      <span className="truncate text-stone-500">{t.task_title}</span>
                      <span className={`ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PLAN_COLORS[t.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[t.plan_key] ?? t.plan_key}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={run} className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700">
                  <Sparkles className="w-4 h-4" /> Confirmar geração
                </button>
                <button onClick={onClose} className="text-sm border border-stone-200 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
              </div>
            </>
          )}

          {progress && (
            <div className="space-y-4">
              {/* Barra de progresso */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-600">{progress.active ? 'Gerando...' : 'Concluído'}</span>
                  <span className="text-stone-500">{progress.done} / {progress.total}</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              </div>

              {progress.active && (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando pendências individualmente...
                </div>
              )}

              {progress.complete && (
                <div className="space-y-2">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-sm font-semibold text-emerald-700">{generated} rascunho{generated !== 1 ? 's' : ''} gerado{generated !== 1 ? 's' : ''} com sucesso</p>
                    {progress.skipped.length > 0 && <p className="text-xs text-stone-500">{progress.skipped.length} ignorado{progress.skipped.length !== 1 ? 's' : ''} (já tinham rascunho)</p>}
                    {progress.failed.length > 0 && <p className="text-xs text-red-600">{progress.failed.length} falhou{progress.failed.length !== 1 ? 'ram' : ''}</p>}
                  </div>
                  {progress.failed.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1">
                      <p className="text-xs font-medium text-red-700">Falhas:</p>
                      {progress.failed.map(f => (
                        <p key={f.id} className="text-xs text-red-600">• {f.title}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={onClose} className="w-full text-sm bg-stone-700 text-white py-2 rounded-lg hover:bg-stone-800">Fechar e ir para Rascunhos</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CancelModal ───────────────────────────────────────────────────────────────

function CancelModal({ count, onConfirm, onClose }: { count: number; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <h2 className="font-bold text-stone-800">Cancelar {count} pendência{count !== 1 ? 's' : ''}</h2>
        <p className="text-sm text-stone-500">Informe o motivo do cancelamento (opcional):</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Ex: usuário mudou de plano, não aplicável este mês..." />
        <div className="flex gap-2">
          <button onClick={() => onConfirm(note)} className="flex items-center gap-2 bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600"><Ban className="w-4 h-4" /> Confirmar cancelamento</button>
          <button onClick={onClose} className="text-sm border border-stone-200 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Voltar</button>
        </div>
      </div>
    </div>
  )
}

// ── ResolveModal ──────────────────────────────────────────────────────────────

function ResolveModal({ count, onConfirm, onClose }: { count: number; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
        <h2 className="font-bold text-stone-800">Marcar {count} pendência{count !== 1 ? 's' : ''} como resolvida{count !== 1 ? 's' : ''}</h2>
        <p className="text-sm text-stone-500">Como essa{count !== 1 ? 's pendências foram resolvidas' : ' pendência foi resolvida'}?</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Ex: respondido por e-mail, resolvido fora do sistema..." />
        <div className="flex gap-2">
          <button onClick={() => onConfirm(note)} className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700"><Check className="w-4 h-4" /> Confirmar</button>
          <button onClick={onClose} className="text-sm border border-stone-200 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Voltar</button>
        </div>
      </div>
    </div>
  )
}

// ── SummaryCards ──────────────────────────────────────────────────────────────

function SummaryCards({ allTasks, deliveries, onFilter }: {
  allTasks: PersonalizationTask[]
  deliveries: Delivery[]
  onFilter: (tab: AdminTab) => void
}) {
  const cur = monthKey()
  const today = new Date().toDateString()
  const cards = [
    { label: 'Pendências abertas', value: allTasks.filter(t => ['pending'].includes(t.status)).length, color: 'text-stone-700', bg: 'bg-stone-50 hover:bg-stone-100', tab: 'queue' as AdminTab },
    { label: 'Atrasadas', value: allTasks.filter(t => t.status === 'overdue').length, color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100', tab: 'overdue' as AdminTab },
    { label: 'Vencem hoje', value: allTasks.filter(t => t.due_at && new Date(t.due_at).toDateString() === today && ['pending', 'overdue'].includes(t.status)).length, color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100', tab: 'queue' as AdminTab },
    { label: 'Rascunhos', value: allTasks.filter(t => ['draft', 'generated'].includes(t.status)).length, color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', tab: 'drafts' as AdminTab },
    { label: 'Resolvidas este mês', value: allTasks.filter(t => ['sent', 'resolved'].includes(t.status) && (t.sent_at?.startsWith(cur) || t.completed_at?.startsWith(cur))).length, color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', tab: 'resolved' as AdminTab },
    { label: 'Canceladas', value: allTasks.filter(t => t.status === 'cancelled').length, color: 'text-stone-400', bg: 'bg-stone-50 hover:bg-stone-100', tab: 'cancelled' as AdminTab },
    { label: 'Usuários com pendência', value: new Set(allTasks.filter(t => ['pending', 'overdue'].includes(t.status)).map(t => t.user_id)).size, color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100', tab: 'queue' as AdminTab },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
      {cards.map(c => (
        <button key={c.label} onClick={() => onFilter(c.tab)} className={`${c.bg} rounded-xl p-3 text-center transition-colors cursor-pointer`}>
          <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
          <p className="text-[10px] text-stone-500 mt-0.5 leading-tight">{c.label}</p>
        </button>
      ))}
    </div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Partial<Filters>) => void }) {
  const taskTypes = [...new Map(TASK_DEFS.map(d => [d.key, d])).values()]
  return (
    <div className="flex flex-wrap gap-2 mb-3">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
        <input value={filters.search} onChange={e => onChange({ search: e.target.value })} placeholder="Buscar usuário, e-mail ou tipo..." className="w-full pl-9 pr-8 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300" />
        {filters.search && <button onClick={() => onChange({ search: '' })} className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-stone-400" /></button>}
      </div>
      <select value={filters.plan} onChange={e => onChange({ plan: e.target.value })} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white">
        <option value="all">Todos os planos</option>
        {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select value={filters.taskKey} onChange={e => onChange({ taskKey: e.target.value })} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white">
        <option value="all">Todos os tipos</option>
        {taskTypes.map(d => <option key={d.key} value={d.key}>{d.title}</option>)}
      </select>
      <select value={filters.priority} onChange={e => onChange({ priority: e.target.value })} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white">
        <option value="all">Todas as prioridades</option>
        <option value="high">Alta</option>
        <option value="medium">Média</option>
        <option value="low">Baixa</option>
      </select>
      <select value={filters.deadline} onChange={e => onChange({ deadline: e.target.value })} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white">
        <option value="all">Qualquer prazo</option>
        <option value="today">Vence hoje</option>
        <option value="tomorrow">Vence amanhã</option>
        <option value="week">Vence em até 7 dias</option>
        <option value="overdue">Atrasado</option>
        <option value="overdue7">Atrasado há mais de 7 dias</option>
      </select>
      {(filters.search || filters.plan !== 'all' || filters.taskKey !== 'all' || filters.priority !== 'all' || filters.deadline !== 'all') && (
        <button onClick={() => onChange({ search: '', plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all' })} className="text-xs text-stone-500 hover:text-stone-700 px-2 py-1 border border-stone-200 rounded-lg">Limpar filtros</button>
      )}
    </div>
  )
}

// ── BulkActionBar ─────────────────────────────────────────────────────────────

function BulkActionBar({ count, onGenerate, onCancel, onResolve, onClear }: {
  count: number; onGenerate: () => void; onCancel: () => void; onResolve: () => void; onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 bg-stone-800 text-white rounded-xl px-4 py-2.5 mb-3 flex-wrap">
      <span className="text-sm font-medium">{count} pendência{count !== 1 ? 's' : ''} selecionada{count !== 1 ? 's' : ''}</span>
      <div className="flex gap-1.5 ml-auto flex-wrap">
        <button onClick={onGenerate} className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3 h-3" /> Gerar com IA
        </button>
        <button onClick={onResolve} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg">
          <Check className="w-3 h-3" /> Marcar resolvidas
        </button>
        <button onClick={onCancel} className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg">
          <Ban className="w-3 h-3" /> Cancelar
        </button>
        <button onClick={onClear} className="flex items-center gap-1 text-xs border border-stone-500 hover:border-stone-300 px-3 py-1.5 rounded-lg">
          <X className="w-3 h-3" /> Limpar seleção
        </button>
      </div>
    </div>
  )
}

// ── TaskTable ─────────────────────────────────────────────────────────────────

function TaskTable({ tasks, profileMap, selectedIds, onSelectChange, onGenerate, showResolved = false }: {
  tasks: PersonalizationTask[]
  profileMap: Record<string, UserRow>
  selectedIds: Set<string>
  onSelectChange: (ids: Set<string>) => void
  onGenerate: (task: PersonalizationTask) => void
  showResolved?: boolean
}) {
  const allSelected = tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))
  const someSelected = tasks.some(t => selectedIds.has(t.id))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selectedIds)
      tasks.forEach(t => next.delete(t.id))
      onSelectChange(next)
    } else {
      const next = new Set(selectedIds)
      tasks.forEach(t => next.add(t.id))
      onSelectChange(next)
    }
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectChange(next)
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-14">
        <CheckCircle className="w-10 h-10 mx-auto mb-3 text-stone-200" />
        <p className="text-sm text-stone-400">Nenhuma pendência nesta categoria com os filtros aplicados.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              <th className="py-2.5 px-3 w-8">
                <button onClick={toggleAll} className="text-stone-400 hover:text-stone-600">
                  {allSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : someSelected ? <CheckSquare className="w-4 h-4 text-stone-400" /> : <Square className="w-4 h-4" />}
                </button>
              </th>
              {['Usuário', 'Plano', 'Pendência', 'Prazo', 'Prioridade', 'Status', 'Ação'].map(h => (
                <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => {
              const profile = profileMap[task.user_id]
              const def = TASK_DEFS.find(d => d.key === task.task_key)
              const isSelected = selectedIds.has(task.id)
              const dueLabel = formatDueLabel(task.due_at)
              const dueCls = dueBadgeColors(task.status as TaskStatus, task.due_at)
              return (
                <tr key={task.id} className={`border-b border-stone-100 transition-colors ${isSelected ? 'bg-emerald-50/40' : 'hover:bg-stone-50/40'}`}>
                  <td className="py-3 px-3">
                    <button onClick={() => toggle(task.id)}>
                      {isSelected ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-stone-300" />}
                    </button>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-sm font-medium text-stone-800">{profile?.full_name ?? '(sem nome)'}</p>
                    <p className="text-xs text-stone-400">{profile?.email ?? '—'}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[task.plan_key] ?? 'bg-stone-100 text-stone-600'}`}>{PLAN_LABELS[task.plan_key] ?? task.plan_key}</span>
                  </td>
                  <td className="py-3 px-3">
                    <p className="text-sm text-stone-700 max-w-xs">{task.task_title}</p>
                    <p className="text-xs text-stone-400">{TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area}</p>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${dueCls}`}>{dueLabel}</span>
                    {task.due_at && <p className="text-[10px] text-stone-400 mt-0.5">{new Date(task.due_at).toLocaleDateString('pt-BR')}</p>}
                  </td>
                  <td className="py-3 px-3">
                    {def && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${priorityBadgeColors(def.priority)}`}>{PRIORITY_LABELS[def.priority]}</span>}
                  </td>
                  <td className="py-3 px-3 text-xs text-stone-500 whitespace-nowrap">{STATUS_LABELS[task.status] ?? task.status}</td>
                  <td className="py-3 px-3">
                    {!showResolved && (
                      <button onClick={() => onGenerate(task)} className="flex items-center gap-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium whitespace-nowrap">
                        <Sparkles className="w-3 h-3" /> {task.status === 'draft' ? 'Revisar' : 'Gerar com IA'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400">
        <span>{tasks.length} item{tasks.length !== 1 ? 's' : ''}</span>
        {someSelected && <span className="text-emerald-600 font-medium">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>}
      </div>
    </div>
  )
}

// ── HistoryTable ──────────────────────────────────────────────────────────────

function HistoryTable({ profileMap }: { profileMap: Record<string, UserRow> }) {
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
        <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-3 py-2" />
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
                  {['Data', 'Usuário', 'Plano', 'Título enviado', 'Destino', 'Lido', ''].map(h => (
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
                      <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[d.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[d.plan_key] ?? d.plan_key}</span></td>
                      <td className="py-2.5 px-3 text-sm text-stone-700 max-w-xs truncate">{d.title}</td>
                      <td className="py-2.5 px-3 text-xs text-stone-500">{TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area ?? '—'}</td>
                      <td className="py-2.5 px-3">
                        {d.read_at ? <span className="text-xs text-emerald-600">✓ Lido</span> : <span className="text-xs text-stone-400">Não lido</span>}
                      </td>
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminPersonalization() {
  const [activeTab, setActiveTab] = useState<AdminTab>('queue')
  const [allTasks, setAllTasks] = useState<PersonalizationTask[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [profileMap, setProfileMap] = useState<Record<string, UserRow>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>({ search: '', plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [generateTask, setGenerateTask] = useState<PersonalizationTask | null>(null)
  const [bulkGenerateTasks, setBulkGenerateTasks] = useState<PersonalizationTask[] | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    const [tasks, { data: profiles }, { data: delivs }] = await Promise.all([
      loadAllTasksForAdmin(),
      supabase.from('profiles').select('user_id, full_name, email, plan, created_at').limit(500),
      supabase.from('personalized_content_deliveries').select('*').eq('status', 'sent').order('sent_at', { ascending: false }).limit(500),
    ])
    const map: Record<string, UserRow> = {}
    for (const p of (profiles ?? []) as UserRow[]) map[p.user_id] = p
    setAllTasks(tasks)
    setProfileMap(map)
    setDeliveries((delivs ?? []) as Delivery[])
    setLoading(false)
  }, [])

  const refreshTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await refreshTasksForAllUsers()
      if (result.errors.length > 0) showToast('Erros: ' + result.errors.slice(0, 2).join('; '), true)
      else showToast(`Atualizado: ${result.created} criadas, ${result.updated} atualizadas.`)
    } catch { showToast('Erro ao atualizar pendências.', true) }
    await loadData()
    setRefreshing(false)
  }, [loadData])

  useEffect(() => {
    setLoading(true)
    loadData().then(() => refreshTasks())
  }, [])

  // Tasks filtradas pela aba ativa
  const tabTasks = useMemo(() => {
    const conf = TAB_CONFIG.find(t => t.id === activeTab)
    if (!conf || activeTab === 'history') return []
    return allTasks.filter(t => conf.statuses.includes(t.status))
  }, [allTasks, activeTab])

  // Tasks com filtros aplicados
  const filteredTasks = useMemo(() => {
    return tabTasks.filter(t => applyFilters(t, filters, profileMap))
  }, [tabTasks, filters, profileMap])

  // Counts por status para os tabs
  const tabCounts = useMemo(() => {
    const counts: Record<AdminTab, number> = { queue: 0, drafts: 0, resolved: 0, overdue: 0, cancelled: 0, history: deliveries.length }
    for (const t of allTasks) {
      if (['pending', 'overdue'].includes(t.status)) counts.queue++
      if (['draft', 'generated'].includes(t.status)) counts.drafts++
      if (['sent', 'resolved', 'completed'].includes(t.status)) counts.resolved++
      if (t.status === 'overdue') counts.overdue++
      if (t.status === 'cancelled') counts.cancelled++
    }
    return counts
  }, [allTasks, deliveries.length])

  async function bulkCancel(note: string) {
    const ids = [...selectedIds]
    let done = 0
    for (const id of ids) {
      const { error } = await supabase.from('user_personalization_tasks').update({ status: 'cancelled', admin_notes: note || 'Cancelado em massa.', updated_at: new Date().toISOString() }).eq('id', id)
      if (!error) done++
    }
    showToast(`${done} pendência${done !== 1 ? 's' : ''} cancelada${done !== 1 ? 's' : ''}.`)
    setSelectedIds(new Set())
    setShowCancelModal(false)
    await loadData()
  }

  async function bulkResolve(note: string) {
    const ids = [...selectedIds]
    let done = 0
    for (const id of ids) {
      const { error } = await supabase.from('user_personalization_tasks').update({ status: 'resolved', completed_at: new Date().toISOString(), admin_notes: note || 'Resolvido manualmente.', updated_at: new Date().toISOString() }).eq('id', id)
      if (!error) done++
    }
    showToast(`${done} pendência${done !== 1 ? 's' : ''} marcada${done !== 1 ? 's' : ''} como resolvida${done !== 1 ? 's' : ''}.`)
    setSelectedIds(new Set())
    setShowResolveModal(false)
    await loadData()
  }

  function handleCardFilter(tab: AdminTab) {
    setActiveTab(tab)
    setSelectedIds(new Set())
  }

  const selectedTasks = filteredTasks.filter(t => selectedIds.has(t.id))

  return (
    <div>
      {/* Toast */}
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>{toast.msg}</div>}

      {/* Modals */}
      {generateTask && (
        <GenerateModal task={generateTask} profileMap={profileMap} onClose={() => setGenerateTask(null)} onSaved={() => { setGenerateTask(null); loadData() }} showToast={showToast} />
      )}
      {bulkGenerateTasks && (
        <BulkGenerateModal tasks={bulkGenerateTasks} profileMap={profileMap} onClose={() => setBulkGenerateTasks(null)} onDone={async () => { setBulkGenerateTasks(null); setSelectedIds(new Set()); setActiveTab('drafts'); await loadData() }} showToast={showToast} />
      )}
      {showCancelModal && <CancelModal count={selectedIds.size} onConfirm={bulkCancel} onClose={() => setShowCancelModal(false)} />}
      {showResolveModal && <ResolveModal count={selectedIds.size} onConfirm={bulkResolve} onClose={() => setShowResolveModal(false)} />}

      {/* Header */}
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

      {/* Cards */}
      <SummaryCards allTasks={allTasks} deliveries={deliveries} onFilter={handleCardFilter} />

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-stone-200 mb-4 overflow-x-auto">
        {TAB_CONFIG.map(t => (
          <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedIds(new Set()) }} className={`text-sm px-4 py-2.5 border-b-2 transition-colors font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === t.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
            {t.label}
            {tabCounts[t.id] > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === t.id ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{tabCounts[t.id]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filtros (não no histórico) */}
      {activeTab !== 'history' && (
        <FilterBar filters={filters} onChange={f => { setFilters(prev => ({ ...prev, ...f })); setSelectedIds(new Set()) }} />
      )}

      {/* Barra de ações em massa */}
      {activeTab !== 'history' && activeTab !== 'resolved' && activeTab !== 'cancelled' && (
        <BulkActionBar
          count={selectedIds.size}
          onGenerate={() => { const tasks = selectedTasks; if (tasks.length) setBulkGenerateTasks(tasks) }}
          onCancel={() => setShowCancelModal(true)}
          onResolve={() => setShowResolveModal(true)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Conteúdo das abas */}
      {loading && activeTab !== 'history' ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-300" /></div>
      ) : activeTab === 'history' ? (
        <HistoryTable profileMap={profileMap} />
      ) : (
        <TaskTable
          tasks={filteredTasks}
          profileMap={profileMap}
          selectedIds={selectedIds}
          onSelectChange={setSelectedIds}
          onGenerate={setGenerateTask}
          showResolved={activeTab === 'resolved' || activeTab === 'cancelled'}
        />
      )}
    </div>
  )
}
