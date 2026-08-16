import { useEffect, useState } from 'react'
import { Save, Check, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DIARY_FIELDS as FIELDS, DEFAULT_DIARY_CONFIGS as DEFAULT_CONFIGS, type DiaryPlanConfig, type PlanKey } from '../../lib/diaryConfig'

// FIELDS e DEFAULT_CONFIGS vêm de ../../lib/diaryConfig (fonte única, também usada pelo DiaryPage).

export default function AdminDiaryConfig() {
  const [configs, setConfigs] = useState<DiaryPlanConfig[]>(DEFAULT_CONFIGS)
  const [activeTab, setActiveTab] = useState<PlanKey>('free')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [newQuestion, setNewQuestion] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('diary_plan_configs').select('*')
      if (data && data.length > 0) {
        setConfigs(prev => prev.map(c => {
          const row = data.find((r: { plan_key: string; config: unknown }) => r.plan_key === c.plan)
          if (!row?.config) return c
          return { ...c, ...row.config }
        }))
      }
      setLoading(false)
    }
    load()
  }, [])

  const cfg = configs.find(c => c.plan === activeTab)!

  // O painel pode personalizar a experiência, mas nunca contradizer o catálogo oficial.
  const lockedFields: Record<PlanKey, string[]> = {
    free: ['context_tags', 'need_tags', 'care_action_tags', 'trigger_tags', 'energy', 'anxiety_level', 'stress_level', 'sleep_quality', 'self_esteem', 'irritability', 'overload', 'emotional_triggers', 'recurring_thoughts', 'emotional_need', 'relationships', 'habits'],
    essential: ['trigger_tags', 'stress_level', 'self_esteem', 'irritability', 'overload', 'emotional_triggers', 'recurring_thoughts', 'emotional_need', 'relationships', 'habits'],
    plus: [],
  }
  const isLockedField = (key: string) => lockedFields[activeTab].includes(key)
  const enforcePlanRules = (config: DiaryPlanConfig): DiaryPlanConfig => {
    const fields = { ...config.fields }
    for (const key of lockedFields[config.plan]) fields[key] = false
    if (config.plan === 'free') return { ...config, entriesPerMonth: 5, exportPDF: false, fields, reports: [], graphs: [] }
    if (config.plan === 'essential') return { ...config, entriesPerMonth: null, fields, reports: ['Relatório semanal automático'] }
    return { ...config, entriesPerMonth: null, fields }
  }

  function updateCfg(field: keyof DiaryPlanConfig, value: DiaryPlanConfig[keyof DiaryPlanConfig]) {
    if (activeTab === 'free' && (field === 'entriesPerMonth' || field === 'exportPDF')) return
    setConfigs(cs => cs.map(c => c.plan === activeTab ? { ...c, [field]: value } : c))
  }

  function toggleField(key: string) {
    if (isLockedField(key)) return
    updateCfg('fields', { ...cfg.fields, [key]: !cfg.fields[key] })
  }

  function addQuestion() {
    if (!newQuestion.trim()) return
    updateCfg('guidedQuestions', [...cfg.guidedQuestions, newQuestion.trim()])
    setNewQuestion('')
  }

  function removeQuestion(i: number) {
    updateCfg('guidedQuestions', cfg.guidedQuestions.filter((_, idx) => idx !== i))
  }

  async function save() {
    setSaving(true)
    try {
      const protectedConfigs = configs.map(enforcePlanRules)
      for (const c of protectedConfigs) {
        await supabase.from('diary_plan_configs').upsert(
          { plan_key: c.plan, config: c, updated_at: new Date().toISOString() },
          { onConflict: 'plan_key' }
        )
      }
      setConfigs(protectedConfigs)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // noop
    }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-forest-900">Diário por Plano</h1>
        <button
          onClick={save}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-forest-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-forest-800 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-stone-100 p-1 rounded-xl">
        {configs.map(c => (
          <button key={c.plan} onClick={() => setActiveTab(c.plan)}
            className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === c.plan ? 'bg-white text-forest-900 shadow-sm' : 'text-stone-500'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* Limits */}
        <div className="bg-white rounded-xl border border-line p-5 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Limites e acesso</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Registros básicos por mês (vazio = ilimitado)</label>
              <input
                type="number"
                value={cfg.entriesPerMonth ?? ''}
                onChange={e => updateCfg('entriesPerMonth', e.target.value ? Number(e.target.value) : null)}
                placeholder="Ilimitado"
                className={inputCls}
                min={1}
                disabled={activeTab === 'free'}
              />
              <p className="text-[11px] text-stone-400 mt-1">
                Check-ins rápidos são sempre ilimitados. No Gratuito, há 5 registros básicos por mês e 1 por dia; no Essencial e Plus, o diário principal é 1 por dia e os complementos são liberados.
              </p>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Histórico disponível</label>
              <input
                value={cfg.history}
                onChange={e => updateCfg('history', e.target.value)}
                placeholder="Ex: 30 dias / Completo"
                className={inputCls}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" checked={cfg.exportPDF} disabled={activeTab === 'free'} onChange={e => updateCfg('exportPDF', e.target.checked)} className="accent-forest-700 disabled:opacity-40" />
            Permitir exportação em PDF
          </label>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-xl border border-line p-5">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Campos disponíveis</h2>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => (
              <label key={f.key} className={`flex items-center gap-2 text-sm py-0.5 ${isLockedField(f.key) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={!!cfg.fields[f.key]} disabled={isLockedField(f.key)} onChange={() => toggleField(f.key)} className="accent-forest-700" />
                <span className={cfg.fields[f.key] ? 'text-forest-900' : 'text-stone-400'}>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-forest-100 bg-forest-50/50 px-4 py-3 text-sm text-forest-800 leading-relaxed">
          {activeTab === 'free' && 'No Gratuito, check-ins são ilimitados e o Registro Básico permite até 5 registros por mês, um por dia. Diário Completo e complementos ficam desativados.'}
          {activeTab === 'essential' && 'O Essencial possui Diário Completo, um diário principal por dia e complementos liberados. Possui relatório semanal, mas não mensal.'}
          {activeTab === 'plus' && 'O Plus possui Diário Completo, complementos e aprofundamento avançado, com relatório mensal, plano de autocuidado e orientação.'}
        </div>

        {/* Guided questions */}
        <div className="bg-white rounded-xl border border-line p-5">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Perguntas guiadas</h2>
          <div className="space-y-2 mb-3">
            {cfg.guidedQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                <span className="flex-1 text-sm text-stone-700">{q}</span>
                <button onClick={() => removeQuestion(i)} className="text-stone-300 hover:text-red-500 text-xs">✕</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newQuestion}
              onChange={e => setNewQuestion(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addQuestion()}
              placeholder="Nova pergunta guiada..."
              className={`${inputCls} flex-1`}
            />
            <button onClick={addQuestion} className="px-3 py-2 bg-forest-900 text-white rounded-lg text-sm hover:bg-forest-800">
              Adicionar
            </button>
          </div>
        </div>

        {/* Reports & graphs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-line p-5">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">Gráficos disponíveis</h2>
            <div className="space-y-1">
              {cfg.graphs.length === 0
                ? <p className="text-sm text-stone-400">Nenhum gráfico neste plano</p>
                : cfg.graphs.map((g, i) => <p key={i} className="text-sm text-stone-700">• {g}</p>)
              }
            </div>
          </div>
          <div className="bg-white rounded-xl border border-line p-5">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">Relatórios disponíveis</h2>
            <div className="space-y-1">
              {cfg.reports.length === 0
                ? <p className="text-sm text-stone-400">Nenhum relatório neste plano</p>
                : cfg.reports.map((r, i) => <p key={i} className="text-sm text-stone-700">• {r}</p>)
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
