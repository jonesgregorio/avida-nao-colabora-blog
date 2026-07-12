import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Leaf, Plus, Save, Loader2 } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'
import { emailSelfCarePlanForUser } from '../../lib/emailTriggers'

interface SelfCarePlan {
  id: string
  user_id: string
  month_key: string
  summary: string | null
  suggested_adjustments: string | null
  next_focus: string | null
  pdf_url: string | null
  created_at: string
  user?: { full_name?: string }
}

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminSelfCarePlans() {
  const [plans, setPlans] = useState<SelfCarePlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<SelfCarePlan | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAI, setShowAI] = useState<'summary' | 'adjustments' | 'focus' | null>(null)

  // Form fields
  const [userId, setUserId] = useState('')
  const [month, setMonth] = useState(monthKey())
  const [summary, setSummary] = useState('')
  const [adjustments, setAdjustments] = useState('')
  const [nextFocus, setNextFocus] = useState('')
  const [plusUsers, setPlusUsers] = useState<{ id: string; full_name: string }[]>([])

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    // self_care_plan_reviews.user_id referencia auth.users (não profiles), então
    // o embed do PostgREST (user:profiles) falha com 400. Resolve-se o nome à parte.
    const [{ data: ps }, { data: users }] = await Promise.all([
      supabase.from('self_care_plan_reviews').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, full_name, user_id').in('plan', ['therapeutic', 'therapeutic-plus', 'plus']).limit(200),
    ])
    const list = (ps ?? []) as SelfCarePlan[]
    const ids = [...new Set(list.map(p => p.user_id).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ids)
      const nameById = new Map(
        (profs ?? []).map((p: { user_id: string; full_name?: string }) => [p.user_id, p.full_name ?? undefined]),
      )
      list.forEach(p => { p.user = { full_name: nameById.get(p.user_id) } })
    }
    setPlans(list)
    setPlusUsers((users ?? []).map((u: { user_id?: string; id?: string; full_name?: string }) => ({ id: u.user_id ?? u.id ?? '', full_name: u.full_name ?? u.id ?? '' })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(p: SelfCarePlan) {
    setSelected(p)
    setSummary(p.summary ?? '')
    setAdjustments(p.suggested_adjustments ?? '')
    setNextFocus(p.next_focus ?? '')
  }

  function resetForm() {
    setUserId(''); setMonth(monthKey()); setSummary(''); setAdjustments(''); setNextFocus('')
  }

  async function save() {
    if (!summary.trim() || (!selected && !userId)) return
    setSaving(true)

    let error
    if (selected) {
      const res = await supabase.from('self_care_plan_reviews').update({
        summary, suggested_adjustments: adjustments || null, next_focus: nextFocus || null, updated_at: new Date().toISOString(),
      }).eq('id', selected.id)
      error = res.error

      if (!error) {
        await supabase.from('notifications').insert({
          user_id: selected.user_id,
          title: 'Revisão do plano de autocuidado disponível',
          body: `A revisão do seu plano de autocuidado de ${monthLabel(selected.month_key)} está disponível. Acesse o Mapa Emocional.`,
          type: 'system',
          action_view: 'my-evolution',
          action_label: 'Ver plano',
          is_read: false,
        })
        void emailSelfCarePlanForUser(selected.user_id, selected.id)
      }
    } else {
      const res = await supabase.from('self_care_plan_reviews').insert({
        user_id: userId, month_key: month, summary,
        suggested_adjustments: adjustments || null, next_focus: nextFocus || null,
      })
      error = res.error

      if (!error) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Plano de autocuidado disponível',
          body: `Seu plano de autocuidado de ${monthLabel(month)} está disponível. Acesse o Mapa Emocional.`,
          type: 'system',
          action_view: 'my-evolution',
          action_label: 'Ver plano',
          is_read: false,
        })
        void emailSelfCarePlanForUser(userId, `${userId}:${month}`)
      }
    }

    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }
    showToast('Plano salvo e usuário notificado!')
    setSaving(false)
    setSelected(null)
    setShowForm(false)
    resetForm()
    load()
  }

  const isForm = showForm || selected !== null

  // Métricas do mockup (#autocuidado): Pendentes / Em revisão / Enviados / Com erro.
  const curMonth = monthKey()
  const sentThisMonth = plans.filter(p => p.month_key === curMonth).length
  const pending = plusUsers.filter(u => !plans.some(p => p.user_id === u.id && p.month_key === curMonth)).length
  const metrics = [
    { n: pending, label: 'Pendentes' },
    { n: 0, label: 'Em revisão' },
    { n: sentThisMonth, label: 'Enviados' },
    { n: 0, label: 'Com erro' },
  ]

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}
      {showAI && (
        <AIContentAssistant
          contentType="self_care_plan"
          defaultTone="acolhedor"
          label={showAI === 'summary' ? 'Gerar resumo do plano' : showAI === 'adjustments' ? 'Gerar ajustes sugeridos' : 'Gerar foco do próximo período'}
          onInsert={text => {
            if (showAI === 'summary') setSummary(text)
            else if (showAI === 'adjustments') setAdjustments(text)
            else setNextFocus(text)
            setShowAI(null)
          }}
          onClose={() => setShowAI(null)}
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Plano de autocuidado</h1>
          <p className="text-sm text-ink-soft mt-1">Gere, revise e envie planos mensais para usuários Plus.</p>
        </div>
        {!isForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800">
            <Plus className="w-4 h-4" /> Gerar planos pendentes
          </button>
        )}
      </div>

      {!isForm && (
        <>
          <div className="border border-[#eeb7a7] bg-[#fff5f1] text-[#783426] rounded-xl px-4 py-3 text-sm mb-5">
            Revisão humana obrigatória antes de enviar qualquer plano gerado por IA.
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map(m => (
              <div key={m.label} className="bg-white border border-line rounded-2xl p-5">
                <p className="font-serif text-3xl text-forest-900">{loading ? '—' : m.n}</p>
                <p className="text-sm text-ink-soft mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {isForm ? (
        <div className="max-w-2xl space-y-5">
          <button onClick={() => { setSelected(null); setShowForm(false); resetForm() }} className="text-sm text-stone-500 hover:text-stone-700">← Voltar</button>
          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700">{selected ? `Editar plano de ${monthLabel(selected.month_key)}` : 'Novo plano de autocuidado'}</h2>

            {!selected && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Usuário</label>
                  <select value={userId} onChange={e => setUserId(e.target.value)} className={inputCls}>
                    <option value="">Selecione...</option>
                    {plusUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Mês de referência</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)} className={inputCls} />
                </div>
              </div>
            )}

            {[
              { key: 'summary' as const, label: 'Resumo do plano', value: summary, set: setSummary, placeholder: 'Descreva o plano personalizado para este usuário...' },
              { key: 'adjustments' as const, label: 'Ajustes sugeridos', value: adjustments, set: setAdjustments, placeholder: 'Quais práticas ou mudanças são sugeridas...' },
              { key: 'focus' as const, label: 'Foco do próximo período', value: nextFocus, set: setNextFocus, placeholder: 'Em que o usuário deve focar no próximo período...' },
            ].map(field => (
              <div key={field.key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-stone-500">{field.label}</label>
                  <button type="button" onClick={() => setShowAI(field.key)} className="text-xs text-forest-800 bg-mint border border-forest-200 px-2 py-0.5 rounded hover:bg-mint">
                    ✦ IA
                  </button>
                </div>
                <textarea value={field.value} onChange={e => field.set(e.target.value)} rows={3} placeholder={field.placeholder} className={inputCls} />
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !summary.trim()} className="flex items-center gap-2 bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar e notificar'}
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum plano de autocuidado criado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-line p-4 hover:border-stone-300 cursor-pointer" onClick={() => openEdit(p)}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-forest-900 text-sm">{p.user?.full_name ?? p.user_id}</p>
                <span className="text-xs text-stone-400">{monthLabel(p.month_key)}</span>
              </div>
              {p.summary && <p className="text-xs text-stone-500 line-clamp-2">{p.summary}</p>}
              <p className="text-xs text-stone-400 mt-1">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
