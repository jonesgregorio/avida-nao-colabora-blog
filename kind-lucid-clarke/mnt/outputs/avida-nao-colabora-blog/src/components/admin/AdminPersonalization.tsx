import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { createUserNotification } from '../../lib/notifications'
import { emailGuidanceAnsweredForUser, emailPersonalizedContentForUser, emailProfessionalCommentForUser } from '../../lib/emailTriggers'
import {
  Sparkles, Loader2, Search, X, Copy, Send, Save, RefreshCw,
  CheckCircle, Square, CheckSquare, Ban, Check, FileText, AlertCircle,
  SlidersHorizontal, UserRound,
} from 'lucide-react'
import {
  TASK_DEFS, PersonalizationTask, TaskStatus,
  loadAllTasksForAdmin,
  formatDueLabel, dueBadgeColors, priorityBadgeColors, calculateTaskPriority,
  PRIORITY_LABELS, STATUS_LABELS, TARGET_AREA_LABELS, ACTION_VIEW_MAP,
  generateContentForTask, TaskSnapshot, monthKey,
  refreshTasksForAllUsers,
} from '../../lib/personalizationTasks'
import { sendPersonalizedDelivery } from '../../services/personalizedDeliveryService'
import { PLAN_LABELS } from '../../lib/planConstants'
import { EMOTIONAL_SUPPORT_DISCLAIMER } from '../../lib/emotionalDisclaimers'
import { ADMIN_INPUT_CLASS as inputCls } from '../../lib/styleConstants'

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600',
  essential: 'bg-blue-100 text-blue-700',
  plus: 'bg-mint text-forest-800',
  therapeutic: 'bg-mint text-forest-800',
  'therapeutic-plus': 'bg-mint text-forest-800',
}
const DISCLAIMER = EMOTIONAL_SUPPORT_DISCLAIMER

type AdminTab = 'queue' | 'drafts' | 'resolved' | 'overdue' | 'cancelled' | 'history'
type ViewMode = 'default' | 'advanced'

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
  updated_at?: string | null
  data_snapshot?: (TaskSnapshot & { topContexts?: string[]; topNeeds?: string[]; topCareActions?: string[]; topTriggers?: string[] }) | null
}

const TAB_CONFIG: { id: AdminTab; label: string; statuses: string[] }[] = [
  { id: 'queue',     label: 'Fila de trabalho',    statuses: ['pending', 'overdue'] },
  { id: 'drafts',    label: 'Rascunhos',            statuses: ['draft', 'generated'] },
  { id: 'resolved',  label: 'Resolvidas',           statuses: ['sent', 'resolved', 'completed'] },
  { id: 'overdue',   label: 'Atrasadas',            statuses: ['overdue'] },
  { id: 'cancelled', label: 'Canceladas',           statuses: ['cancelled'] },
  { id: 'history',   label: 'Histórico de envios',  statuses: [] },
]

async function buildSnapshot(userId: string, plan: string, taskKey: string): Promise<TaskSnapshot & {
  topContexts: string[]
  topNeeds: string[]
  topCareActions: string[]
  topTriggers: string[]
}> {
  const [
    { count: diaryCount }, { data: diaryData },
    { count: qCount }, { count: savedCount }, { count: articlesRead },
  ] = await Promise.all([
    supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('diary_entries')
      .select('mood,mood_score,emotional_tags,context_tags,need_tags,care_action_tags,trigger_tags')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
    supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event', 'article_view'),
  ])
  const rows = (diaryData ?? []) as Record<string, unknown>[]
  const freq = (field: string, limit = 5): string[] => {
    const counts: Record<string, number> = {}
    for (const row of rows) {
      const values = Array.isArray(row[field]) ? row[field] as unknown[] : []
      for (const raw of values) {
        const value = String(raw ?? '').trim()
        if (value) counts[value] = (counts[value] ?? 0) + 1
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value]) => value)
  }
  let moodSum = 0; let moodCount = 0
  for (const row of rows) {
    const mood = Number(row.mood_score ?? row.mood)
    if (Number.isFinite(mood) && mood > 0) { moodSum += mood; moodCount++ }
  }
  const normalizedPlan = ['plus', 'therapeutic', 'therapeutic-plus', 'therapeutic_plus'].includes(plan) ? 'plus' : plan
  return {
    plan: normalizedPlan, task: taskKey, period: monthKey(),
    diaryCount: diaryCount ?? 0,
    topMarkers: freq('emotional_tags'),
    topContexts: freq('context_tags'),
    topNeeds: freq('need_tags'),
    topCareActions: freq('care_action_tags'),
    topTriggers: normalizedPlan === 'plus' ? freq('trigger_tags') : [],
    avgMood: moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null,
    questionnaireCount: qCount ?? 0, articlesRead: articlesRead ?? 0, savedCount: savedCount ?? 0,
  }
}

function SnapshotPanel({ snapshot }: { snapshot: Delivery['data_snapshot'] }) {
  if (!snapshot) return null
  const rows: [string, string[] | undefined][] = [
    ['Marcadores emocionais', snapshot.topMarkers],
    ['Contextos percebidos', snapshot.topContexts],
    ['Necessidades registradas', snapshot.topNeeds],
    ['Ações de cuidado', snapshot.topCareActions],
    ['Gatilhos reais', snapshot.topTriggers],
  ]
  const withData = rows.filter(([, values]) => values && values.length > 0)
  return (
    <details open className="bg-white border border-line rounded-xl text-xs overflow-hidden">
      <summary className="cursor-pointer px-3.5 py-2.5 font-medium text-forest-900 hover:bg-stone-50 select-none">Dados usados pela IA</summary>
      <div className="border-t border-line px-3.5 py-3 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-stone-50 rounded-lg p-2"><p className="text-stone-400">Período</p><p className="font-medium text-stone-700 mt-0.5">{snapshot.period}</p></div>
          <div className="bg-stone-50 rounded-lg p-2"><p className="text-stone-400">Diário</p><p className="font-medium text-stone-700 mt-0.5">{snapshot.diaryCount} registros</p></div>
          <div className="bg-stone-50 rounded-lg p-2"><p className="text-stone-400">Humor médio</p><p className="font-medium text-stone-700 mt-0.5">{snapshot.avgMood ?? 'Sem dado'}</p></div>
          <div className="bg-stone-50 rounded-lg p-2"><p className="text-stone-400">Questionários</p><p className="font-medium text-stone-700 mt-0.5">{snapshot.questionnaireCount ?? 0}</p></div>
        </div>
        {withData.length === 0 ? (
          <p className="text-stone-400 italic">Não houve tags recorrentes suficientes neste período. Revise o texto com atenção antes de enviar.</p>
        ) : (
          <div className="space-y-2">
            {withData.map(([label, values]) => (
              <div key={label}>
                <p className="text-stone-500 mb-1">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {values!.map(value => <span key={`${label}-${value}`} className="bg-mint text-forest-800 rounded-full px-2 py-0.5">{value}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-stone-400">Esses são sinais estruturados usados como base. Eles não autorizam diagnóstico nem afirmações clínicas.</p>
      </div>
    </details>
  )
}

function deliveryWasEdited(delivery: Delivery | null): boolean {
  if (!delivery?.ai_generated || !delivery.updated_at || !delivery.created_at || delivery.status === 'sent') return false
  const created = Date.parse(delivery.created_at)
  const updated = Date.parse(delivery.updated_at)
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1500
}

function DeliveryJourney({ delivery, dirty = false }: { delivery: Delivery | null; dirty?: boolean }) {
  const generated = Boolean(delivery?.id && delivery.ai_generated)
  const edited = Boolean(delivery?.id && (dirty || deliveryWasEdited(delivery)))
  const sent = delivery?.status === 'sent' || Boolean(delivery?.sent_at)
  const steps = [
    { label: 'Gerado', active: generated },
    { label: 'Editado', active: edited },
    { label: 'Enviado', active: sent },
  ]
  return (
    <div className="flex items-center gap-1.5 flex-wrap" aria-label="Etapas do conteúdo personalizado">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${step.active ? 'bg-mint text-forest-800' : 'bg-stone-100 text-stone-400'}`}>
            {step.active && <Check className="w-2.5 h-2.5" />}{step.label}
          </span>
          {index < steps.length - 1 && <span className="text-stone-300">→</span>}
        </div>
      ))}
    </div>
  )
}

function applyFilters(task: PersonalizationTask, filters: Filters, profileMap: Record<string, UserRow>): boolean {
  const profile = profileMap[task.user_id]
  if (filters.plan !== 'all' && task.plan_key !== filters.plan) return false
  if (filters.taskKey !== 'all' && task.task_key !== filters.taskKey) return false
  if (filters.priority !== 'all' && calculateTaskPriority(task) !== filters.priority) return false
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

function DraftEditor({ task, profileMap, initialDelivery, onClose, onDone, showToast }: {
  task: PersonalizationTask
  profileMap: Record<string, UserRow>
  initialDelivery: Delivery | null
  onClose: () => void
  onDone: (reloadNeeded: boolean) => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const def = TASK_DEFS.find(d => d.key === task.task_key)
  const profile = profileMap[task.user_id]
  const [delivery, setDelivery] = useState<Delivery | null>(initialDelivery)
  const [editTitle, setEditTitle] = useState(initialDelivery?.title ?? '')
  const [editBody, setEditBody] = useState(initialDelivery?.body ?? '')
  const [phase, setPhase] = useState<'view' | 'edit' | 'generate' | 'confirm-regen'>(() => initialDelivery ? 'view' : 'generate')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelNote, setCancelNote] = useState('')
  const snapshotRef = useRef<TaskSnapshot | null>(null)

  const dirty = Boolean(delivery && (editTitle !== delivery.title || editBody !== delivery.body))

  async function getSnapshot() {
    if (snapshotRef.current) return snapshotRef.current
    const snap = await buildSnapshot(task.user_id, task.plan_key, task.task_key)
    snapshotRef.current = snap
    return snap
  }

  // A geração manual começa imediatamente ao abrir uma pendência sem rascunho.
  // O Admin não depende do worker periódico de 60 minutos para trabalhar a fila.
  useEffect(() => {
    if (phase === 'generate' && !delivery) void generateContent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function generateContent() {
    setGenerating(true)
    setPhase('generate')
    try {
      const snap = await getSnapshot()
      const { data: me } = await supabase.auth.getUser()
      const result = await generateContentForTask(
        { task_key: task.task_key, task_title: task.task_title, plan_key: task.plan_key },
        snap,
      )
      const lines = result.split('\n').filter(l => l.trim())
      const title = lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? task.task_title
      let savedDelivery: Delivery | null = null

      if (delivery?.id) {
        const { data } = await supabase
          .from('personalized_content_deliveries')
          .update({ title, body: result, data_snapshot: snap, status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', delivery.id)
          .select('*').single()
        savedDelivery = data as Delivery | null
      } else {
        const { data } = await supabase
          .from('personalized_content_deliveries')
          .insert({
            user_id: task.user_id, created_by: me.user?.id ?? null,
            plan_key: task.plan_key, content_type: task.content_type,
            title, body: result, target_area: task.target_area ?? 'my_evolution',
            data_snapshot: snap, ai_generated: true, status: 'draft', task_id: task.id,
          })
          .select('*').single()
        savedDelivery = data as Delivery | null
      }

      if (!savedDelivery?.id) {
        showToast('Conteúdo gerado mas falhou ao salvar rascunho no banco.', true)
      } else {
        await supabase.from('user_personalization_tasks').update({
          status: 'draft', delivery_id: savedDelivery.id,
          generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', task.id)
      }
      setDelivery(savedDelivery)
      setEditTitle(title)
      setEditBody(result)
      setPhase('edit')
    } catch (e) {
      console.error('[DraftEditor] Erro ao gerar:', e)
      showToast('Erro ao gerar conteúdo: ' + String(e), true)
      setPhase(delivery ? 'view' : 'generate')
    }
    setGenerating(false)
  }

  async function saveDraft() {
    if (!editTitle.trim() || !editBody.trim()) {
      showToast('Preencha título e conteúdo antes de salvar.', true)
      return
    }
    setSaving(true)
    const { data: me } = await supabase.auth.getUser()
    const snap = await getSnapshot()

    if (delivery?.id) {
      const { data } = await supabase
        .from('personalized_content_deliveries')
        .update({ title: editTitle, body: editBody, updated_at: new Date().toISOString() })
        .eq('id', delivery.id).select('*').single()
      if (data) setDelivery(data as Delivery)
      await supabase.from('user_personalization_tasks')
        .update({ status: 'draft', delivery_id: delivery.id, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      showToast('Rascunho salvo com sucesso!')
    } else {
      const { data: d } = await supabase.from('personalized_content_deliveries').insert({
        user_id: task.user_id, created_by: me.user?.id ?? null,
        plan_key: task.plan_key, content_type: task.content_type,
        title: editTitle, body: editBody, target_area: task.target_area ?? 'my_evolution',
        data_snapshot: snap, ai_generated: false, status: 'draft', task_id: task.id,
      }).select('*').single()
      if (d?.id) {
        await supabase.from('user_personalization_tasks')
          .update({ status: 'draft', delivery_id: d.id, updated_at: new Date().toISOString() })
          .eq('id', task.id)
        setDelivery(d as Delivery)
        showToast('Rascunho salvo com sucesso!')
      } else showToast('Falha ao salvar rascunho.', true)
    }
    setSaving(false)
    onDone(true)
    onClose()
  }

  async function send() {
    if (!editTitle.trim() || !editBody.trim()) {
      showToast('Não foi possível enviar: título ou conteúdo está vazio.', true)
      return
    }
    if (!delivery?.id) {
      showToast('Não foi possível enviar: rascunho não está salvo corretamente. Salve antes.', true)
      return
    }
    if (!task.user_id) {
      showToast('Não foi possível enviar: user_id ausente.', true)
      return
    }
    setSending(true)

    const { data: meData } = await supabase.auth.getUser()
    const adminId = meData.user?.id ?? ''
    const now = new Date().toISOString()
    const isGuidance = ['guidance', 'monthly_guidance', 'guidance_response', 'monthly_guidance_draft'].includes(task.content_type ?? '') || task.target_area === 'guidance'
    const isProfComment = ['professional_comment', 'report_comment', 'monthly_report_comment'].includes(task.content_type ?? '') || task.target_area === 'professional_comments'

    if (isGuidance) {
      if (!task.related_guidance_id) {
        showToast('Não foi possível enviar: a orientação não está vinculada à solicitação mensal oficial.', true)
        setSending(false)
        return
      }
      try {
        const reflected = await sendPersonalizedDelivery({
          taskId: task.id, deliveryId: delivery.id, userId: task.user_id, adminId,
          contentType: task.content_type ?? '', targetArea: task.target_area ?? null,
          title: editTitle, body: editBody, planKey: task.plan_key ?? null,
          relatedGuidanceId: task.related_guidance_id,
        })
        if (!reflected.ok) {
          showToast(reflected.error ?? 'Não foi possível registrar a resposta na Orientação Mensal.', true)
          setSending(false)
          return
        }
      } catch (e) {
        console.warn('[send] Falha ao refletir orientação oficial:', e)
        showToast('Não foi possível registrar a resposta na Orientação Mensal.', true)
        setSending(false)
        return
      }
    }

    const { error: deliveryError } = await supabase.from('personalized_content_deliveries').update({
      title: editTitle, body: editBody, status: 'sent', sent_at: now, updated_at: now,
    }).eq('id', delivery.id)
    if (deliveryError) {
      showToast('Não foi possível marcar o conteúdo como enviado.', true)
      setSending(false)
      return
    }

    if (isGuidance) void emailGuidanceAnsweredForUser(task.user_id, task.related_guidance_id!, now)
    else if (isProfComment) void emailProfessionalCommentForUser(task.user_id, delivery.id)
    else void emailPersonalizedContentForUser(task.user_id, delivery.id)

    const { error: taskError } = await supabase.from('user_personalization_tasks').update({
      status: 'sent', delivery_id: delivery.id, sent_at: now, completed_at: now, updated_at: now,
    }).eq('id', task.id)
    if (taskError) {
      console.warn('[send] Delivery enviado, mas task não foi atualizada:', taskError)
      showToast('Conteúdo enviado, mas a fila não conseguiu atualizar o status. Recarregue antes de tentar novamente.', true)
      setSending(false)
      onDone(true)
      onClose()
      return
    }

    if (def && !isGuidance && !isProfComment) {
      await createUserNotification({
        userId: task.user_id, type: 'personalized_content',
        title: def.notificationTitle ?? 'Novo conteúdo personalizado disponível',
        message: def.notificationBody ?? 'Preparamos uma nova entrega personalizada para você.',
        destination: ACTION_VIEW_MAP[task.target_area ?? 'my_evolution'],
      })
    }

    if (!isGuidance) {
      try {
        const reflected = await sendPersonalizedDelivery({
          taskId: task.id, deliveryId: delivery.id, userId: task.user_id, adminId,
          contentType: task.content_type ?? '', targetArea: task.target_area ?? null,
          title: editTitle, body: editBody, planKey: task.plan_key ?? null,
          relatedGuidanceId: task.related_guidance_id ?? null,
        })
        if (!reflected.ok) console.warn('[send] Reflexo em módulo oficial não confirmado:', reflected.error)
      } catch (e) { console.warn('[send] Reflexo em módulos oficiais falhou:', e) }
    }

    setDelivery(prev => prev ? { ...prev, title: editTitle, body: editBody, status: 'sent', sent_at: now, updated_at: now } : prev)
    showToast('Conteúdo enviado e usuário notificado!')
    setSending(false)
    onDone(true)
    onClose()
  }

  async function cancelTask() {
    await supabase.from('user_personalization_tasks')
      .update({ status: 'cancelled', admin_notes: cancelNote || 'Cancelado pelo admin.', updated_at: new Date().toISOString() })
      .eq('id', task.id)
    showToast('Pendência cancelada.')
    onDone(true)
    onClose()
  }

  const dueLabel = formatDueLabel(task.due_at)
  const dueCls = dueBadgeColors(task.status as TaskStatus, task.due_at)
  const hasContent = editTitle.trim() && editBody.trim()

  return (
    <div className="fixed inset-0 z-50 bg-black/35 flex justify-end" onClick={e => { if (!generating && !saving && !sending && e.target === e.currentTarget) onClose() }}>
      <aside role="dialog" aria-modal="true" aria-label={`Revisar personalização: ${task.task_title}`} className="bg-white shadow-2xl h-full w-full max-w-2xl overflow-y-auto sm:rounded-l-2xl">
        <div className="p-5 border-b border-line flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[task.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[task.plan_key] ?? task.plan_key}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dueCls}`}>{dueLabel}</span>
              {def && <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${priorityBadgeColors(def.priority)}`}>{PRIORITY_LABELS[def.priority]}</span>}
            </div>
            <h2 className="font-bold text-forest-900 text-lg truncate">{task.task_title}</h2>
            <p className="text-sm text-stone-500 truncate">{profile?.full_name ?? '(sem nome)'} · {profile?.email ?? '—'}</p>
            <div className="mt-2"><DeliveryJourney delivery={delivery} dirty={dirty} /></div>
          </div>
          {!generating && !saving && !sending && (
            <button onClick={onClose} aria-label="Fechar painel de personalização" className="w-9 h-9 inline-flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex-shrink-0"><X className="w-5 h-5" /></button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {def && (
            <div className="bg-stone-50 rounded-xl p-3 text-sm space-y-1">
              <p><span className="font-medium text-stone-700">Motivo:</span> <span className="text-stone-600">{def.description}</span></p>
              <p><span className="font-medium text-stone-700">Destino:</span> <span className="text-stone-600">{TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area ?? '—'}</span></p>
              {task.due_at && <p><span className="font-medium text-stone-700">Prazo:</span> <span className="text-stone-600">{new Date(task.due_at).toLocaleDateString('pt-BR')}</span></p>}
            </div>
          )}

          {phase === 'generate' && generating && (
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <Loader2 className="w-8 h-8 animate-spin text-forest-600" />
              <p className="text-sm font-medium text-stone-700">Gerando conteúdo personalizado com IA...</p>
              <p className="text-xs text-stone-400">A geração acontece agora; não é preciso aguardar o próximo ciclo automático.</p>
            </div>
          )}

          {phase === 'generate' && !generating && !delivery && (
            <div className="text-center py-8 space-y-3">
              <AlertCircle className="w-8 h-8 mx-auto text-amber-400" />
              <p className="text-sm text-stone-600">Não foi possível gerar o conteúdo. Tente novamente.</p>
              <button onClick={generateContent} className="flex items-center gap-2 mx-auto bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800"><Sparkles className="w-4 h-4" /> Tentar novamente</button>
            </div>
          )}

          {phase === 'confirm-regen' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">Substituir rascunho existente?</p>
              <p className="text-sm text-amber-700">Já existe um rascunho salvo. Ao gerar novamente, o conteúdo atual será substituído.</p>
              <div className="flex gap-2">
                <button onClick={generateContent} className="text-sm bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">Substituir rascunho</button>
                <button onClick={() => setPhase(delivery ? 'view' : 'edit')} className="text-sm border border-amber-300 text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50">Cancelar</button>
              </div>
            </div>
          )}

          {phase === 'view' && delivery && (
            <div className="space-y-3">
              <div className="bg-stone-50 rounded-xl p-4 space-y-3">
                <div><p className="text-xs text-stone-400 mb-1">Título</p><p className="text-sm font-semibold text-forest-900">{editTitle}</p></div>
                <div><p className="text-xs text-stone-400 mb-1">Conteúdo</p><p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{editBody}</p></div>
              </div>
              <SnapshotPanel snapshot={delivery.data_snapshot} />
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-700 italic">{DISCLAIMER}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPhase('edit')} className="flex items-center gap-1.5 bg-stone-100 text-stone-700 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-200"><FileText className="w-3.5 h-3.5" /> Editar</button>
                <button onClick={() => setPhase('confirm-regen')} className="flex items-center gap-1.5 border border-line text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50"><RefreshCw className="w-3.5 h-3.5" /> Gerar novamente</button>
                <button onClick={() => navigator.clipboard.writeText(editBody).catch(() => {})} className="flex items-center gap-1.5 border border-line text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50"><Copy className="w-3.5 h-3.5" /> Copiar</button>
                <button onClick={send} disabled={sending} className="flex items-center gap-1.5 bg-forest-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-forest-800 disabled:opacity-50 ml-auto">{sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar ao usuário</button>
              </div>
            </div>
          )}

          {phase === 'edit' && (
            <div className="space-y-3">
              <div><label className="text-xs text-stone-500 block mb-1">Título</label><input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} /></div>
              <div><label className="text-xs text-stone-500 block mb-1">Conteúdo — revise antes de enviar</label><textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={12} className={inputCls + ' font-mono text-xs resize-y'} /></div>
              <SnapshotPanel snapshot={delivery?.data_snapshot} />
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-xs text-amber-700 italic">{DISCLAIMER}</div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setPhase('confirm-regen')} disabled={generating} className="flex items-center gap-1.5 border border-line text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"><RefreshCw className="w-3.5 h-3.5" /> Gerar novamente</button>
                <button onClick={() => navigator.clipboard.writeText(editBody).catch(() => {})} className="flex items-center gap-1.5 border border-line text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50"><Copy className="w-3.5 h-3.5" /> Copiar</button>
                <button onClick={saveDraft} disabled={saving || sending || !hasContent} className="flex items-center gap-1.5 border border-line text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50">{saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Salvar rascunho</button>
                <button onClick={send} disabled={saving || sending || !hasContent} className="flex items-center gap-1.5 bg-forest-700 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-forest-800 disabled:opacity-50">{sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Enviar ao usuário</button>
              </div>
              {!hasContent && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Preencha título e conteúdo antes de salvar ou enviar.</p>}
            </div>
          )}

          <div className="border-t border-line pt-3">
            {!showCancel ? (
              <button onClick={() => setShowCancel(true)} className="text-xs text-stone-400 hover:text-red-500">Cancelar esta pendência</button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-stone-500 font-medium">Motivo do cancelamento (opcional):</p>
                <input value={cancelNote} onChange={e => setCancelNote(e.target.value)} className={inputCls} placeholder="Ex: não aplicável, usuário solicitou..." />
                <div className="flex gap-2">
                  <button onClick={cancelTask} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg">Confirmar cancelamento</button>
                  <button onClick={() => setShowCancel(false)} className="text-xs border border-line text-stone-600 px-3 py-1.5 rounded-lg">Voltar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

function BulkGenerateModal({ tasks, profileMap, onClose, onDone, showToast: _showToast }: {
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
      if (task.delivery_id && task.status === 'draft') {
        prog.skipped.push({ id: task.id, title: task.task_title }); prog.done++; setProgress({ ...prog }); continue
      }
      try {
        const snap = await buildSnapshot(task.user_id, task.plan_key, task.task_key)
        const result = await generateContentForTask({ task_key: task.task_key, task_title: task.task_title, plan_key: task.plan_key }, snap)
        const lines = result.split('\n').filter(l => l.trim())
        const title = lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? task.task_title
        const { data: delivery } = await supabase.from('personalized_content_deliveries').insert({
          user_id: task.user_id, created_by: me.user?.id ?? null, plan_key: task.plan_key,
          content_type: task.content_type, title, body: result,
          target_area: task.target_area ?? 'my_evolution', data_snapshot: snap,
          ai_generated: true, status: 'draft', task_id: task.id,
        }).select('id').single()
        await supabase.from('user_personalization_tasks').update({
          status: 'draft', delivery_id: delivery?.id ?? null,
          generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', task.id)
        prog.done++; setProgress({ ...prog })
      } catch (e) {
        console.error('[BulkGenerate] Falha na task:', task.id, e)
        prog.failed.push({ id: task.id, title: task.task_title, error: String(e) }); prog.done++; setProgress({ ...prog })
      }
    }
    prog.active = false; prog.complete = true; setProgress({ ...prog }); onDone()
  }

  const generated = progress ? progress.done - progress.failed.length - progress.skipped.length : 0
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-5 border-b border-line flex items-start justify-between">
          <h2 className="font-bold text-forest-900">Gerar conteúdos com IA</h2>
          {!progress?.active && <button onClick={onClose} aria-label="Fechar"><X className="w-5 h-5 text-stone-400" /></button>}
        </div>
        <div className="p-5 space-y-4">
          {!progress && (
            <>
              <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                <p className="text-sm font-medium text-stone-700">Você está prestes a gerar conteúdos para <span className="text-forest-800">{tasks.length} pendências</span>.</p>
                <p className="text-sm text-stone-500">Cada conteúdo será criado individualmente de acordo com o plano, perfil do usuário e tipo da pendência.</p>
                <p className="text-sm text-stone-500 font-semibold">Tudo será salvo como <span className="text-blue-600">rascunho</span>. Nada será enviado automaticamente.</p>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {tasks.map(t => {
                  const p = profileMap[t.user_id]
                  return <div key={t.id} className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 rounded-lg px-2 py-1.5"><span className="truncate font-medium">{p?.full_name ?? '(sem nome)'}</span><span className="text-stone-400">·</span><span className="truncate text-stone-500">{t.task_title}</span><span className={`ml-auto flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PLAN_COLORS[t.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[t.plan_key] ?? t.plan_key}</span></div>
                })}
              </div>
              <div className="flex gap-2">
                <button onClick={run} className="flex items-center gap-2 bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800"><Sparkles className="w-4 h-4" /> Confirmar geração</button>
                <button onClick={onClose} className="text-sm border border-line text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Cancelar</button>
              </div>
            </>
          )}
          {progress && (
            <div className="space-y-4">
              <div><div className="flex justify-between text-sm mb-1"><span className="text-stone-600">{progress.active ? 'Gerando...' : 'Concluído'}</span><span className="text-stone-500">{progress.done} / {progress.total}</span></div><div className="w-full bg-stone-100 rounded-full h-2"><div className="bg-forest-600 h-2 rounded-full transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div></div>
              {progress.active && <div className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" /> Processando individualmente...</div>}
              {progress.complete && (
                <div className="space-y-2">
                  <div className="bg-mint border border-forest-200 rounded-xl p-3 space-y-1"><p className="text-sm font-semibold text-forest-800">{generated} rascunho{generated !== 1 ? 's' : ''} gerado{generated !== 1 ? 's' : ''} com sucesso.</p><p className="text-xs text-stone-500">0 conteúdos enviados automaticamente. Revise cada rascunho antes de enviar.</p>{progress.skipped.length > 0 && <p className="text-xs text-stone-500">{progress.skipped.length} ignorado{progress.skipped.length !== 1 ? 's' : ''} (já tinham rascunho).</p>}{progress.failed.length > 0 && <p className="text-xs text-red-600">{progress.failed.length} falhou{progress.failed.length !== 1 ? 'ram' : ''}.</p>}</div>
                  {progress.failed.length > 0 && <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1"><p className="text-xs font-medium text-red-700">Pendências que falharam:</p>{progress.failed.map(f => <p key={f.id} className="text-xs text-red-600">• {f.title}</p>)}</div>}
                  <button onClick={onClose} className="w-full text-sm bg-stone-700 text-white py-2 rounded-lg hover:bg-forest-900">Fechar e ir para Rascunhos</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CancelModal({ count, onConfirm, onClose }: { count: number; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"><div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"><h2 className="font-bold text-forest-900">Cancelar {count} pendência{count !== 1 ? 's' : ''}</h2><p className="text-sm text-stone-500">Motivo do cancelamento (opcional):</p><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Ex: usuário mudou de plano, não aplicável este mês..." /><div className="flex gap-2"><button onClick={() => onConfirm(note)} className="flex items-center gap-2 bg-red-500 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-600"><Ban className="w-4 h-4" /> Confirmar</button><button onClick={onClose} className="text-sm border border-line text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Voltar</button></div></div></div>
}

function ResolveModal({ count, onConfirm, onClose }: { count: number; onConfirm: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState('')
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"><div role="dialog" aria-modal="true" className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4"><h2 className="font-bold text-forest-900">Marcar {count} pendência{count !== 1 ? 's' : ''} como resolvida{count !== 1 ? 's' : ''}</h2><p className="text-sm text-stone-500">Como foi resolvid{count !== 1 ? 'as' : 'a'}?</p><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="Ex: respondido por e-mail, resolvido fora do sistema..." /><div className="flex gap-2"><button onClick={() => onConfirm(note)} className="flex items-center gap-2 bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800"><Check className="w-4 h-4" /> Confirmar</button><button onClick={onClose} className="text-sm border border-line text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Voltar</button></div></div></div>
}

function SummaryCards({ allTasks, onFilter, advanced }: {
  allTasks: PersonalizationTask[]
  onFilter: (tab: AdminTab) => void
  advanced: boolean
}) {
  const cur = monthKey(); const today = new Date().toDateString(); const now = Date.now()
  const cards = [
    { key: 'open', label: 'Pendências abertas', value: allTasks.filter(t => t.status === 'pending').length, color: 'text-stone-700', bg: 'bg-stone-50 hover:bg-stone-100', tab: 'queue' as AdminTab },
    { key: 'high', label: 'Alta prioridade', value: allTasks.filter(t => ['pending','overdue','draft','generated'].includes(t.status) && calculateTaskPriority(t) === 'high').length, color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100', tab: 'queue' as AdminTab },
    { key: 'overdue', label: 'Atrasadas', value: allTasks.filter(t => t.status === 'overdue' || (t.due_at != null && new Date(t.due_at).getTime() < now && ['pending','draft','generated'].includes(t.status))).length, color: 'text-rose-700', bg: 'bg-rose-50 hover:bg-rose-100', tab: 'overdue' as AdminTab },
    { key: 'today', label: 'Vencem hoje', value: allTasks.filter(t => t.due_at && new Date(t.due_at).toDateString() === today && ['pending','overdue'].includes(t.status)).length, color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100', tab: 'queue' as AdminTab },
    { key: 'drafts', label: 'Rascunhos', value: allTasks.filter(t => ['draft','generated'].includes(t.status)).length, color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', tab: 'drafts' as AdminTab },
    { key: 'resolved', label: 'Resolvidas este mês', value: allTasks.filter(t => ['sent','resolved'].includes(t.status) && (t.sent_at?.startsWith(cur) || t.completed_at?.startsWith(cur))).length, color: 'text-forest-700', bg: 'bg-mint hover:bg-mint', tab: 'resolved' as AdminTab },
    { key: 'users', label: 'Usuários c/ pendência', value: new Set(allTasks.filter(t => ['pending','overdue'].includes(t.status)).map(t => t.user_id)).size, color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100', tab: 'queue' as AdminTab },
    { key: 'errors', label: 'Falhas de IA', value: allTasks.filter(t => !!t.last_error).length, color: 'text-red-700', bg: 'bg-red-50 hover:bg-red-100', tab: 'cancelled' as AdminTab },
  ]
  const visible = advanced ? cards : cards.filter(card => ['open', 'overdue', 'drafts', 'errors'].includes(card.key))
  return <div className={`grid grid-cols-2 ${advanced ? 'sm:grid-cols-4 lg:grid-cols-8' : 'sm:grid-cols-4'} gap-2 mb-5`}>{visible.map(c => <button key={c.label} onClick={() => onFilter(c.tab)} className={`${c.bg} rounded-xl p-3 text-center transition-colors`}><p className={`font-serif text-xl ${c.color}`}>{c.value}</p><p className="text-[10px] text-stone-500 mt-0.5 leading-tight">{c.label}</p></button>)}</div>
}

function FilterBar({ filters, onChange, mode, profiles }: {
  filters: Filters
  onChange: (f: Partial<Filters>) => void
  mode: ViewMode
  profiles: UserRow[]
}) {
  const taskTypes = [...new Map(TASK_DEFS.map(d => [d.key, d])).values()]
  const q = filters.search.trim().toLowerCase()
  const suggestions = q.length >= 2
    ? profiles.filter(profile => (profile.full_name ?? '').toLowerCase().includes(q) || (profile.email ?? '').toLowerCase().includes(q)).slice(0, 6)
    : []
  const hasAdvanced = filters.plan !== 'all' || filters.taskKey !== 'all' || filters.priority !== 'all' || filters.deadline !== 'all'
  return (
    <div className="bg-white border border-line rounded-xl p-3 mb-3">
      <div className="relative">
        <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input value={filters.search} onChange={e => onChange({ search: e.target.value })} placeholder="Buscar usuário por nome ou e-mail..." className="w-full pl-9 pr-9 py-2 text-sm border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-300" />
        {filters.search && <button onClick={() => onChange({ search: '' })} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-stone-400" /></button>}
        {suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-line rounded-xl shadow-lg overflow-hidden">
            {suggestions.map(profile => (
              <button key={profile.user_id} type="button" onClick={() => onChange({ search: profile.email || profile.full_name || '' })} className="w-full text-left px-3 py-2 hover:bg-stone-50 border-b last:border-b-0 border-line">
                <p className="text-sm font-medium text-stone-700">{profile.full_name || '(sem nome)'}</p>
                <p className="text-xs text-stone-400">{profile.email || 'Sem e-mail'} · {PLAN_LABELS[profile.plan] ?? profile.plan}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {mode === 'advanced' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2.5 pt-2.5 border-t border-line">
          <select value={filters.plan} onChange={e => onChange({ plan: e.target.value })} className="text-sm border border-line rounded-lg px-2 py-2 bg-white"><option value="all">Todos os planos</option>{Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select value={filters.taskKey} onChange={e => onChange({ taskKey: e.target.value })} className="text-sm border border-line rounded-lg px-2 py-2 bg-white"><option value="all">Todos os tipos</option>{taskTypes.map(d => <option key={d.key} value={d.key}>{d.title}</option>)}</select>
          <select value={filters.priority} onChange={e => onChange({ priority: e.target.value })} className="text-sm border border-line rounded-lg px-2 py-2 bg-white"><option value="all">Todas as prioridades</option><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select>
          <select value={filters.deadline} onChange={e => onChange({ deadline: e.target.value })} className="text-sm border border-line rounded-lg px-2 py-2 bg-white"><option value="all">Qualquer prazo</option><option value="today">Vence hoje</option><option value="tomorrow">Vence amanhã</option><option value="week">Vence em até 7 dias</option><option value="overdue">Atrasado</option><option value="overdue7">Atrasado há mais de 7 dias</option></select>
        </div>
      )}

      {(filters.search || hasAdvanced) && <div className="flex justify-end mt-2"><button onClick={() => onChange({ search: '', plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all' })} className="text-xs text-stone-500 hover:text-stone-700">Limpar filtros</button></div>}
    </div>
  )
}

function BulkActionBar({ count, onGenerate, onCancel, onResolve, onClear }: {
  count: number; onGenerate: () => void; onCancel: () => void; onResolve: () => void; onClear: () => void
}) {
  if (count === 0) return null
  return <div className="flex items-center gap-2 bg-forest-900 text-white rounded-xl px-4 py-2.5 mb-3 flex-wrap"><span className="text-sm font-medium">{count} pendência{count !== 1 ? 's' : ''} selecionada{count !== 1 ? 's' : ''}</span><div className="flex gap-1.5 ml-auto flex-wrap"><button onClick={onGenerate} className="flex items-center gap-1 text-xs bg-forest-700 hover:bg-forest-800 px-3 py-1.5 rounded-lg"><Sparkles className="w-3 h-3" /> Gerar com IA</button><button onClick={onResolve} className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg"><Check className="w-3 h-3" /> Marcar resolvidas</button><button onClick={onCancel} className="flex items-center gap-1 text-xs bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg"><Ban className="w-3 h-3" /> Cancelar</button><button onClick={onClear} className="flex items-center gap-1 text-xs border border-stone-500 hover:border-stone-300 px-3 py-1.5 rounded-lg"><X className="w-3 h-3" /> Limpar seleção</button></div></div>
}

function TaskTable({ tasks, profileMap, deliveryMap, selectedIds, onSelectChange, onOpen, showResolved = false }: {
  tasks: PersonalizationTask[]
  profileMap: Record<string, UserRow>
  deliveryMap: Record<string, Delivery>
  selectedIds: Set<string>
  onSelectChange: (ids: Set<string>) => void
  onOpen: (task: PersonalizationTask) => void
  showResolved?: boolean
}) {
  const allSelected = tasks.length > 0 && tasks.every(t => selectedIds.has(t.id))
  const someSelected = tasks.some(t => selectedIds.has(t.id))
  function toggleAll() {
    if (allSelected) { const next = new Set(selectedIds); tasks.forEach(t => next.delete(t.id)); onSelectChange(next) }
    else { const next = new Set(selectedIds); tasks.forEach(t => next.add(t.id)); onSelectChange(next) }
  }
  function toggle(id: string) { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); onSelectChange(next) }
  if (tasks.length === 0) return <div className="text-center py-14"><CheckCircle className="w-10 h-10 mx-auto mb-3 text-stone-200" /><p className="text-sm text-stone-400">Nenhuma pendência nesta categoria com os filtros aplicados.</p></div>

  return (
    <div className="bg-white rounded-xl border border-line overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line bg-stone-50"><th className="py-2.5 px-3 w-8"><button onClick={toggleAll} className="text-stone-400 hover:text-stone-600">{allSelected ? <CheckSquare className="w-4 h-4 text-forest-700" /> : someSelected ? <CheckSquare className="w-4 h-4 text-stone-400" /> : <Square className="w-4 h-4" />}</button></th>{['Usuário', 'Plano', 'Pendência / Rascunho', 'Prazo', 'Prioridade', 'Status', 'Ação'].map(h => <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>)}</tr></thead>
      <tbody>{tasks.map(task => {
        const profile = profileMap[task.user_id]
        const delivery = task.delivery_id ? deliveryMap[task.delivery_id] : undefined
        const isSelected = selectedIds.has(task.id)
        const dueLabel = formatDueLabel(task.due_at); const dueCls = dueBadgeColors(task.status as TaskStatus, task.due_at)
        const isDraft = ['draft', 'generated'].includes(task.status); const hasDelivery = !!delivery?.id && !!delivery.body
        const inconsistent = isDraft && task.delivery_id && !hasDelivery
        return <tr key={task.id} className={`border-b border-line transition-colors ${isSelected ? 'bg-mint/40' : 'hover:bg-stone-50/40'}`}>
          <td className="py-3 px-3"><button onClick={() => toggle(task.id)}>{isSelected ? <CheckSquare className="w-4 h-4 text-forest-700" /> : <Square className="w-4 h-4 text-stone-300" />}</button></td>
          <td className="py-3 px-3"><p className="text-sm font-medium text-forest-900">{profile?.full_name ?? '(sem nome)'}</p><p className="text-xs text-stone-400">{profile?.email ?? '—'}</p></td>
          <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[task.plan_key] ?? 'bg-stone-100 text-stone-600'}`}>{PLAN_LABELS[task.plan_key] ?? task.plan_key}</span></td>
          <td className="py-3 px-3 max-w-xs"><p className="text-sm text-stone-700">{task.task_title}</p>{isDraft && hasDelivery && delivery.title !== task.task_title && <p className="text-xs text-blue-600 mt-0.5 truncate">Rascunho: “{delivery.title}”</p>}{hasDelivery && <div className="mt-1"><DeliveryJourney delivery={delivery} /></div>}{inconsistent && <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Rascunho inconsistente — gere novamente</p>}{task.last_error && <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1" title={task.last_error}><AlertCircle className="w-3 h-3 flex-shrink-0" /><span className="truncate">{task.attempts >= 1 ? `Falhou ${task.attempts}x: ` : ''}{task.last_error}</span></p>}<p className="text-xs text-stone-400 mt-0.5">{TARGET_AREA_LABELS[task.target_area ?? ''] ?? task.target_area}</p></td>
          <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${dueCls}`}>{dueLabel}</span>{task.due_at && <p className="text-[10px] text-stone-400 mt-0.5">{new Date(task.due_at).toLocaleDateString('pt-BR')}</p>}</td>
          <td className="py-3 px-3">{(() => { const p = calculateTaskPriority(task); return <span className={`text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${priorityBadgeColors(p)}`}>{PRIORITY_LABELS[p]}</span> })()}</td>
          <td className="py-3 px-3 text-xs text-stone-500 whitespace-nowrap">{STATUS_LABELS[task.status] ?? task.status}</td>
          <td className="py-3 px-3">{!showResolved && <button onClick={() => onOpen(task)} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap border ${isDraft && hasDelivery ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-mint border-forest-200 text-forest-800 hover:bg-mint'}`}><Sparkles className="w-3 h-3" />{isDraft && hasDelivery ? 'Revisar rascunho' : isDraft ? 'Gerar novamente' : 'Gerar com IA'}</button>}</td>
        </tr>
      })}</tbody></table></div>
      <div className="px-4 py-2 border-t border-line flex items-center justify-between text-xs text-stone-400"><span>{tasks.length} item{tasks.length !== 1 ? 's' : ''}</span>{someSelected && <span className="text-forest-700 font-medium">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>}</div>
    </div>
  )
}

function HistoryTable({ profileMap }: { profileMap: Record<string, UserRow> }) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [monthFilter, setMonthFilter] = useState(monthKey())
  useEffect(() => {
    setLoading(true)
    const [year, month] = monthFilter.split('-').map(Number)
    const nextMonth = new Date(year, month, 1).toISOString().slice(0, 10)
    supabase.from('personalized_content_deliveries').select('*').eq('status', 'sent')
      .gte('sent_at', `${monthFilter}-01`).lt('sent_at', nextMonth).order('sent_at', { ascending: false }).limit(200)
      .then(({ data }) => { setDeliveries((data ?? []) as Delivery[]); setLoading(false) })
  }, [monthFilter])

  return <div><div className="flex items-center gap-2 mb-4"><input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} className="text-sm border border-line rounded-lg px-3 py-2" /><span className="text-sm text-stone-400">{deliveries.length} envio{deliveries.length !== 1 ? 's' : ''}</span></div>{loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-stone-300" /></div> : deliveries.length === 0 ? <p className="text-center py-12 text-stone-400 text-sm">Nenhum envio neste mês.</p> : <div className="bg-white rounded-xl border border-line overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line bg-stone-50">{['Data', 'Usuário', 'Plano', 'Título enviado', 'Destino', 'Lido', ''].map(h => <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{deliveries.map(d => { const profile = profileMap[d.user_id]; return <tr key={d.id} className="border-b border-line hover:bg-stone-50/50"><td className="py-2.5 px-3 text-xs text-stone-500 whitespace-nowrap">{d.sent_at ? new Date(d.sent_at).toLocaleDateString('pt-BR') : '—'}</td><td className="py-2.5 px-3"><p className="text-sm font-medium text-stone-700">{profile?.full_name ?? '(sem nome)'}</p><p className="text-xs text-stone-400">{profile?.email ?? '—'}</p></td><td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[d.plan_key] ?? 'bg-stone-100'}`}>{PLAN_LABELS[d.plan_key] ?? d.plan_key}</span></td><td className="py-2.5 px-3 text-sm text-stone-700 max-w-xs truncate">{d.title}</td><td className="py-2.5 px-3 text-xs text-stone-500">{TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area ?? '—'}</td><td className="py-2.5 px-3">{d.read_at ? <span className="text-xs text-forest-700">✓ Lido</span> : <span className="text-xs text-stone-400">Não lido</span>}</td><td className="py-2.5 px-3"><button onClick={() => setExpanded(expanded === d.id ? null : d.id)} className="text-xs text-forest-700 hover:text-forest-800">{expanded === d.id ? 'Fechar' : 'Ver'}</button>{expanded === d.id && <div className="mt-2 bg-stone-50 rounded-lg p-2 max-w-xs"><p className="text-xs text-stone-600 whitespace-pre-wrap line-clamp-6">{d.body}</p><button onClick={() => navigator.clipboard.writeText(d.body).catch(() => {})} className="text-xs text-stone-400 hover:text-stone-600 mt-1 flex items-center gap-1"><Copy className="w-2.5 h-2.5" /> Copiar</button></div>}</td></tr> })}</tbody></table></div></div>}</div>
}

export default function AdminPersonalization() {
  const [activeTab, setActiveTab] = useState<AdminTab>('queue')
  const [viewMode, setViewMode] = useState<ViewMode>('default')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50
  const [allTasks, setAllTasks] = useState<PersonalizationTask[]>([])
  const [deliveryMap, setDeliveryMap] = useState<Record<string, Delivery>>({})
  const [profileMap, setProfileMap] = useState<Record<string, UserRow>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Filters>({ search: '', plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editorTask, setEditorTask] = useState<PersonalizationTask | null>(null)
  const [editorDelivery, setEditorDelivery] = useState<Delivery | null>(null)
  const [bulkGenerateTasks, setBulkGenerateTasks] = useState<PersonalizationTask[] | null>(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  const loadData = useCallback(async () => {
    const tasks = await loadAllTasksForAdmin()
    const userIds = [...new Set(tasks.map(task => task.user_id).filter(Boolean))]
    const deliveryIds = [...new Set(tasks.map(task => task.delivery_id).filter((id): id is string => Boolean(id)))]
    const chunks = <T,>(items: T[], size = 200): T[][] => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))
    const [profileResults, deliveryResults] = await Promise.all([
      Promise.all(chunks(userIds).map(ids => supabase.from('profiles').select('user_id, full_name, email, plan, created_at').in('user_id', ids))),
      Promise.all(chunks(deliveryIds).map(ids => supabase.from('personalized_content_deliveries').select('*').in('id', ids))),
    ])
    const profiles = profileResults.flatMap(result => result.data ?? [])
    const delivs = deliveryResults.flatMap(result => result.data ?? [])
    const pMap: Record<string, UserRow> = {}; for (const p of profiles as UserRow[]) pMap[p.user_id] = p
    const dMap: Record<string, Delivery> = {}; for (const d of delivs as Delivery[]) dMap[d.id] = d
    setAllTasks(tasks); setProfileMap(pMap); setDeliveryMap(dMap); setLoading(false)
  }, [])

  const doRefreshTasks = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await refreshTasksForAllUsers()
      if (result.errors.length > 0) showToast('Erros: ' + result.errors.slice(0, 2).join('; '), true)
      else showToast(`Atualizado: ${result.created} criadas, ${result.updated} atualizadas.`)
    } catch { showToast('Erro ao atualizar pendências.', true) }
    await loadData(); setRefreshing(false)
  }, [loadData])

  useEffect(() => { setLoading(true); void doRefreshTasks() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tabTasks = useMemo(() => {
    const conf = TAB_CONFIG.find(t => t.id === activeTab)
    if (!conf || activeTab === 'history') return []
    return allTasks.filter(t => conf.statuses.includes(t.status))
  }, [allTasks, activeTab])

  const filteredTasks = useMemo(() => {
    const filtered = tabTasks.filter(t => applyFilters(t, filters, profileMap))
    return filtered.sort((a, b) => {
      const daysA = a.due_at ? Math.floor((new Date(a.due_at).getTime() - Date.now()) / 86400000) : 9999
      const daysB = b.due_at ? Math.floor((new Date(b.due_at).getTime() - Date.now()) / 86400000) : 9999
      return daysA - daysB
    })
  }, [tabTasks, filters, profileMap])

  useEffect(() => { setPage(1) }, [activeTab, filters])
  const pagedTasks = useMemo(() => filteredTasks.slice(0, page * PAGE_SIZE), [filteredTasks, page])

  const tabCounts = useMemo(() => {
    const deliverySentCount = Object.values(deliveryMap).filter(d => d.status === 'sent').length
    const counts: Record<AdminTab, number> = { queue: 0, drafts: 0, resolved: 0, overdue: 0, cancelled: 0, history: deliverySentCount }
    for (const t of allTasks) {
      if (['pending', 'overdue'].includes(t.status)) counts.queue++
      if (['draft', 'generated'].includes(t.status)) counts.drafts++
      if (['sent', 'resolved', 'completed'].includes(t.status)) counts.resolved++
      if (t.status === 'overdue') counts.overdue++
      if (t.status === 'cancelled') counts.cancelled++
    }
    return counts
  }, [allTasks, deliveryMap])

  function openEditor(task: PersonalizationTask) {
    setEditorTask(task)
    setEditorDelivery(task.delivery_id ? (deliveryMap[task.delivery_id] ?? null) : null)
  }
  function closeEditor(reloadNeeded: boolean) { setEditorTask(null); setEditorDelivery(null); if (reloadNeeded) void loadData() }

  async function bulkCancel(note: string) {
    const ids = [...selectedIds]; let done = 0
    for (const id of ids) { const { error } = await supabase.from('user_personalization_tasks').update({ status: 'cancelled', admin_notes: note || 'Cancelado em massa.', updated_at: new Date().toISOString() }).eq('id', id); if (!error) done++ }
    showToast(`${done} pendência${done !== 1 ? 's' : ''} cancelada${done !== 1 ? 's' : ''}.`); setSelectedIds(new Set()); setShowCancelModal(false); await loadData()
  }
  async function bulkResolve(note: string) {
    const ids = [...selectedIds]; let done = 0
    for (const id of ids) { const { error } = await supabase.from('user_personalization_tasks').update({ status: 'resolved', completed_at: new Date().toISOString(), admin_notes: note || 'Resolvido manualmente.', updated_at: new Date().toISOString() }).eq('id', id); if (!error) done++ }
    showToast(`${done} pendência${done !== 1 ? 's' : ''} marcada${done !== 1 ? 's' : ''} como resolvida${done !== 1 ? 's' : ''}.`); setSelectedIds(new Set()); setShowResolveModal(false); await loadData()
  }

  function changeMode(mode: ViewMode) {
    setViewMode(mode)
    if (mode === 'default') setFilters(prev => ({ ...prev, plan: 'all', taskKey: 'all', priority: 'all', deadline: 'all' }))
    setSelectedIds(new Set())
  }

  const selectedTasks = filteredTasks.filter(t => selectedIds.has(t.id))

  return (
    <div>
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}
      {editorTask && <DraftEditor task={editorTask} profileMap={profileMap} initialDelivery={editorDelivery} onClose={() => closeEditor(false)} onDone={(reload) => closeEditor(reload)} showToast={showToast} />}
      {bulkGenerateTasks && <BulkGenerateModal tasks={bulkGenerateTasks} profileMap={profileMap} onClose={() => setBulkGenerateTasks(null)} onDone={async () => { setBulkGenerateTasks(null); setSelectedIds(new Set()); setActiveTab('drafts'); await loadData() }} showToast={showToast} />}
      {showCancelModal && <CancelModal count={selectedIds.size} onConfirm={bulkCancel} onClose={() => setShowCancelModal(false)} />}
      {showResolveModal && <ResolveModal count={selectedIds.size} onConfirm={bulkResolve} onClose={() => setShowResolveModal(false)} />}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><Sparkles className="w-6 h-6 text-forest-700" /> Personalização por Plano</h1>
          <p className="text-sm text-stone-500 mt-0.5">Revise e envie entregas personalizadas. Você pode gerar rascunhos agora — não precisa aguardar o ciclo automático.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl border border-line bg-white p-1" aria-label="Modo da Personalização">
            <button type="button" onClick={() => changeMode('default')} className={`text-xs px-3 py-1.5 rounded-lg font-medium ${viewMode === 'default' ? 'bg-forest-900 text-white' : 'text-stone-500 hover:text-forest-900'}`}>Padrão</button>
            <button type="button" onClick={() => changeMode('advanced')} className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium ${viewMode === 'advanced' ? 'bg-forest-900 text-white' : 'text-stone-500 hover:text-forest-900'}`}><SlidersHorizontal className="w-3.5 h-3.5" /> Avançado</button>
          </div>
          <button onClick={doRefreshTasks} disabled={refreshing} className="flex items-center gap-2 text-sm border border-line text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50">{refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}{refreshing ? 'Atualizando...' : 'Atualizar fila'}</button>
        </div>
      </div>

      <SummaryCards allTasks={allTasks} onFilter={tab => { setActiveTab(tab); setSelectedIds(new Set()); setPage(1) }} advanced={viewMode === 'advanced'} />

      <div className="flex gap-0.5 border-b border-line mb-4 overflow-x-auto">
        {TAB_CONFIG.map(t => <button key={t.id} onClick={() => { setActiveTab(t.id); setSelectedIds(new Set()); setPage(1) }} className={`text-sm px-4 py-2.5 border-b-2 transition-colors font-medium whitespace-nowrap flex items-center gap-1.5 ${activeTab === t.id ? 'border-forest-700 text-forest-800' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>{t.label}{tabCounts[t.id] > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === t.id ? 'bg-mint text-forest-800' : 'bg-stone-100 text-stone-500'}`}>{tabCounts[t.id]}</span>}</button>)}
      </div>

      {activeTab !== 'history' && <FilterBar filters={filters} onChange={f => { setFilters(prev => ({ ...prev, ...f })); setSelectedIds(new Set()) }} mode={viewMode} profiles={Object.values(profileMap)} />}

      {activeTab !== 'history' && activeTab !== 'resolved' && activeTab !== 'cancelled' && <BulkActionBar count={selectedIds.size} onGenerate={() => { if (selectedTasks.length) setBulkGenerateTasks(selectedTasks) }} onCancel={() => setShowCancelModal(true)} onResolve={() => setShowResolveModal(true)} onClear={() => setSelectedIds(new Set())} />}

      {loading && activeTab !== 'history' ? <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-300" /></div> : activeTab === 'history' ? <HistoryTable profileMap={profileMap} /> : <><TaskTable tasks={pagedTasks} profileMap={profileMap} deliveryMap={deliveryMap} selectedIds={selectedIds} onSelectChange={setSelectedIds} onOpen={openEditor} showResolved={activeTab === 'resolved' || activeTab === 'cancelled'} />{filteredTasks.length > pagedTasks.length && <div className="flex justify-center mt-4"><button onClick={() => setPage(p => p + 1)} className="text-sm border border-line text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50">Carregar mais ({filteredTasks.length - pagedTasks.length} restantes)</button></div>}{filteredTasks.length > PAGE_SIZE && <p className="text-center text-xs text-stone-400 mt-2">Exibindo {pagedTasks.length} de {filteredTasks.length} pendências</p>}</>}
    </div>
  )
}
