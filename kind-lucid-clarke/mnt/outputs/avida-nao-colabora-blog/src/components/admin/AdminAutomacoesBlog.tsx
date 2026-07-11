import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Loader2, Play, Pause, Trash2, Zap, Clock } from 'lucide-react'

interface Automation {
  id: string
  name: string
  type: string
  frequency: string
  category: string | null
  plan_required: string | null
  status: string
  mode: string
  last_run_at: string | null
  next_run_at: string | null
  last_result: string | null
  last_error: string | null
}

const TYPES: [string, string][] = [
  ['generate_daily', 'Gerar artigo diário'],
  ['generate_weekly_package', 'Gerar pacote semanal'],
  ['generate_pauta', 'Gerar pauta'],
  ['monthly_pauta', 'Pauta mensal'],
  ['update_old', 'Atualizar artigo antigo'],
  ['publish_scheduled', 'Publicar agendados'],
  ['notify_after_publish', 'Notificar após publicar'],
  ['email_after_publish', 'E-mail após publicar'],
  ['social_caption', 'Legenda social após publicar'],
  ['review_low_perf', 'Revisar baixo desempenho'],
]
const TYPE_TXT = Object.fromEntries(TYPES)
const FREQS: [string, string][] = [['daily', 'Diário'], ['weekly', 'Semanal'], ['biweekly', 'Quinzenal'], ['monthly', 'Mensal']]
const FREQ_TXT = Object.fromEntries(FREQS)

export default function AdminAutomacoesBlog() {
  const [items, setItems] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 3500) }

  const [nName, setNName] = useState('')
  const [nType, setNType] = useState('generate_daily')
  const [nFreq, setNFreq] = useState('weekly')
  const [nPlan, setNPlan] = useState('free')
  const [nMode, setNMode] = useState('require_approval')

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('content_automations').select('*').order('created_at', { ascending: false })
    if (error) setMissing(true)
    setItems((data as Automation[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function create() {
    if (!nName.trim()) { flash('Dê um nome à automação.', true); return }
    setBusy(true)
    const { error } = await supabase.from('content_automations').insert({
      name: nName, type: nType, frequency: nFreq, plan_required: nPlan, mode: nMode, status: 'paused',
    })
    setBusy(false)
    if (error) { flash('Erro: ' + error.message, true); return }
    flash('Automação criada (pausada).'); setShowNew(false); setNName(''); load()
  }

  async function toggle(a: Automation) {
    const status = a.status === 'active' ? 'paused' : 'active'
    setItems(prev => prev.map(x => x.id === a.id ? { ...x, status } : x))
    await supabase.from('content_automations').update({ status }).eq('id', a.id)
  }

  async function remove(a: Automation) {
    if (!confirm(`Excluir a automação "${a.name}"?`)) return
    const { error } = await supabase.from('content_automations').delete().eq('id', a.id)
    if (error) flash('Erro ao excluir: ' + error.message, true)
    else { flash('Automação excluída.'); load() }
  }

  // Ação manual REAL: publica artigos agendados cujo horário já venceu.
  async function publishDue() {
    setBusy(true)
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase.from('articles')
      .update({ status: 'published', published_at: nowIso, updated_at: nowIso })
      .eq('status', 'scheduled').lte('scheduled_at', nowIso).select('id')
    setBusy(false)
    if (error) { flash('Erro ao publicar agendados: ' + error.message, true); return }
    const n = (data as unknown[] | null)?.length ?? 0
    flash(n ? `${n} conteúdo(s) agendado(s) publicado(s).` : 'Nenhum agendado vencido no momento.')
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Automações do blog</h1>
          <p className="text-sm text-ink-soft mt-1">Regras de geração, publicação e divulgação. Fila de aprovação por padrão.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={publishDue} disabled={busy} className="inline-flex items-center gap-2 border border-line bg-white text-forest-800 px-4 py-2 rounded-xl text-sm font-medium hover:border-forest-300 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />} Publicar agendados vencidos
          </button>
          <button onClick={() => setShowNew(v => !v)} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Nova automação</button>
        </div>
      </div>

      <div className="border border-[#e6d8b0] bg-[#fbf6e6] text-[#7a5c12] rounded-xl px-4 py-2.5 text-sm mb-5">
        A <strong>execução automática</strong> (rodar sozinha na frequência) exige um agendador no servidor (cron/Edge Function) — próximo passo. Por enquanto: você gerencia as regras aqui e usa o botão <strong>“Publicar agendados vencidos”</strong> como gatilho manual real.
      </div>

      {showNew && (
        <div className="bg-white border border-line rounded-2xl p-4 mb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="lg:col-span-2"><label className="block text-xs text-stone-500 mb-1">Nome</label><input value={nName} onChange={e => setNName(e.target.value)} placeholder="Ex: Artigo diário de ansiedade" className={inputCls} /></div>
          <div><label className="block text-xs text-stone-500 mb-1">Tipo</label><select value={nType} onChange={e => setNType(e.target.value)} className={inputCls}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Frequência</label><select value={nFreq} onChange={e => setNFreq(e.target.value)} className={inputCls}>{FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Plano</label><select value={nPlan} onChange={e => setNPlan(e.target.value)} className={inputCls}><option value="free">Gratuito</option><option value="essential">Essencial</option><option value="plus">Plus</option></select></div>
          <div><label className="block text-xs text-stone-500 mb-1">Modo</label><select value={nMode} onChange={e => setNMode(e.target.value)} className={inputCls}><option value="require_approval">Exige aprovação</option><option value="auto_publish">Publicação automática</option></select></div>
          <button onClick={create} disabled={busy} className="inline-flex items-center justify-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar</button>
        </div>
      )}

      {missing ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">A tabela <code>content_automations</code> ainda não está disponível — aplica com a migration 061 (CI).</p>
        </div>
      ) : loading ? (
        <p className="text-ink-soft text-sm">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-paper-soft">
          <p className="text-ink-soft text-sm">Nenhuma automação ainda. Crie uma regra para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(a => (
            <div key={a.id} className="bg-white border border-line rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${a.status === 'active' ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-400'}`}><Zap className="w-4 h-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-forest-900">{a.name}</p>
                <p className="text-xs text-ink-soft mt-0.5">
                  {TYPE_TXT[a.type] ?? a.type} · {FREQ_TXT[a.frequency] ?? a.frequency}
                  {a.plan_required ? ` · ${a.plan_required}` : ''} · {a.mode === 'auto_publish' ? 'Publicação automática' : 'Exige aprovação'}
                  {a.last_run_at ? ` · última: ${new Date(a.last_run_at).toLocaleDateString('pt-BR')}` : ' · nunca executou'}
                </p>
                {a.last_error && <p className="text-[11px] text-red-600 mt-0.5">Erro: {a.last_error}</p>}
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-500'}`}>{a.status === 'active' ? 'Ativa' : 'Pausada'}</span>
              <button onClick={() => toggle(a)} className="p-2 text-stone-400 hover:text-forest-700 hover:bg-stone-100 rounded-lg" title={a.status === 'active' ? 'Pausar' : 'Ativar'}>
                {a.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={() => remove(a)} className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
