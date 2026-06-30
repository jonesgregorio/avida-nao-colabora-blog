import { useEffect, useState, useCallback } from 'react'
import { Save, Check, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type PlanKey = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'

interface PlanConfig {
  key: PlanKey
  label: string
  price: string
  description: string
  recommended: boolean
  active: boolean
  diaryLimit: number | null
}

interface Feature {
  feature_key: string
  feature_name: string
  feature_description: string
  category: string
  display_order: number
}

interface AccessMap {
  [planKey: string]: { [featureKey: string]: boolean }
}

const PLAN_KEYS: PlanKey[] = ['free', 'essential', 'therapeutic', 'therapeutic-plus']

const DEFAULT_PLANS: PlanConfig[] = [
  { key: 'free',             label: 'Gratuito',         price: 'R$ 0',    description: 'Para quem quer começar a se conhecer melhor.', recommended: false, active: true, diaryLimit: 5 },
  { key: 'essential',        label: 'Essencial',        price: 'R$ 19,90', description: 'Diário completo e relatórios mensais.',        recommended: true,  active: true, diaryLimit: null },
  { key: 'therapeutic',      label: 'Terapêutico',      price: 'R$ 39,90', description: 'Análise profunda de padrões emocionais.',     recommended: false, active: true, diaryLimit: null },
  { key: 'therapeutic-plus', label: 'Terapêutico Plus', price: 'R$ 79,90', description: 'Tudo do Terapêutico + sessão individual.',    recommended: false, active: true, diaryLimit: null },
]

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS)
  const [features, setFeatures] = useState<Feature[]>([])
  const [access, setAccess] = useState<AccessMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAccess, setSavingAccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<PlanKey>('free')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)

    const [{ data: cfgData }, { data: featData }, { data: accessData }] = await Promise.all([
      supabase.from('plan_configs').select('*'),
      supabase.from('plan_features').select('*').order('category').order('display_order'),
      supabase.from('plan_feature_access').select('*'),
    ])

    if (cfgData && cfgData.length > 0) {
      setPlans(prev => prev.map(pl => {
        const saved = cfgData.find((d: { plan_key: string }) => d.plan_key === pl.key) as Record<string,unknown> | undefined
        if (!saved) return pl
        return {
          ...pl,
          label: (saved.label as string) ?? pl.label,
          price: (saved.price as string) ?? pl.price,
          description: (saved.description as string) ?? pl.description,
          recommended: (saved.recommended as boolean) ?? pl.recommended,
          active: (saved.active as boolean) ?? pl.active,
          diaryLimit: (saved.diary_limit as number | null) ?? pl.diaryLimit,
        }
      }))
    }

    if (featData) setFeatures(featData)

    if (accessData) {
      const map: AccessMap = {}
      for (const row of accessData as { plan_key: string; feature_key: string; enabled: boolean }[]) {
        if (!map[row.plan_key]) map[row.plan_key] = {}
        map[row.plan_key][row.feature_key] = row.enabled
      }
      setAccess(map)
    }

    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function updatePlan(key: PlanKey, field: keyof PlanConfig, value: unknown) {
    setPlans(p => p.map(pl => pl.key === key ? { ...pl, [field]: value } : pl))
  }

  async function savePlans() {
    setSaving(true)
    let hasError = false
    for (const pl of plans) {
      const { error } = await supabase.from('plan_configs').upsert({
        plan_key: pl.key,
        label: pl.label,
        price: pl.price,
        description: pl.description,
        recommended: pl.recommended,
        active: pl.active,
        diary_limit: pl.diaryLimit,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'plan_key' })
      if (error) { console.error(error); hasError = true; break }
    }
    setSaving(false)
    if (hasError) showToast('Erro ao salvar planos. Verifique o console.', false)
    else showToast('Planos salvos com sucesso!')
  }

  async function toggleFeature(planKey: string, featureKey: string, current: boolean) {
    const newValue = !current
    setSavingAccess(`${planKey}:${featureKey}`)

    // Optimistic update
    setAccess(prev => ({
      ...prev,
      [planKey]: { ...(prev[planKey] || {}), [featureKey]: newValue },
    }))

    const { error } = await supabase.from('plan_feature_access').upsert(
      { plan_key: planKey, feature_key: featureKey, enabled: newValue, updated_at: new Date().toISOString() },
      { onConflict: 'plan_key,feature_key' }
    )
    setSavingAccess(null)
    if (error) {
      // Revert
      setAccess(prev => ({
        ...prev,
        [planKey]: { ...(prev[planKey] || {}), [featureKey]: current },
      }))
      showToast('Erro ao salvar: ' + error.message, false)
    }
  }

  const categories = Array.from(new Set(features.map(f => f.category))).sort()
  const plan = plans.find(p => p.key === activeTab)!

  return (
    <div className="max-w-6xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Planos</h1>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex bg-stone-100 rounded-lg p-1 gap-1">
            <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode==='cards' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Cards</button>
            <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode==='table' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}>Tabela comparativa</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : viewMode === 'cards' ? (
        <>
          {/* Plan tabs */}
          <div className="flex gap-1 mb-6 bg-stone-100 p-1 rounded-xl">
            {plans.map(p => (
              <button key={p.key} onClick={() => setActiveTab(p.key)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === p.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {p.label}{p.recommended && <span className="ml-1 text-xs text-emerald-600">★</span>}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Plan info */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Informações do plano</h2>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nome</label>
                <input value={plan.label} onChange={e => updatePlan(plan.key, 'label', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Preço (texto)</label>
                <input value={plan.price} onChange={e => updatePlan(plan.key, 'price', e.target.value)} placeholder="Ex: R$ 19,90/mês" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Descrição curta</label>
                <textarea value={plan.description} onChange={e => updatePlan(plan.key, 'description', e.target.value)} rows={2} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Limite do diário / mês (vazio = ilimitado)</label>
                <input type="number" value={plan.diaryLimit ?? ''} onChange={e => updatePlan(plan.key, 'diaryLimit', e.target.value ? Number(e.target.value) : null)} placeholder="Ilimitado" className={inputCls} min={1} />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={plan.recommended} onChange={e => updatePlan(plan.key, 'recommended', e.target.checked)} className="accent-emerald-600" />
                  Mais recomendado
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input type="checkbox" checked={plan.active} onChange={e => updatePlan(plan.key, 'active', e.target.checked)} className="accent-emerald-600" />
                  Plano ativo
                </label>
              </div>
              <button onClick={savePlans} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar informações'}
              </button>
            </div>

            {/* Features for this plan */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 overflow-y-auto max-h-[600px]">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Recursos incluídos</h2>
              {categories.map(cat => {
                const catFeatures = features.filter(f => f.category === cat)
                return (
                  <div key={cat} className="mb-5">
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 border-b pb-1">{cat}</p>
                    <div className="space-y-1">
                      {catFeatures.map(feat => {
                        const enabled = access[plan.key]?.[feat.feature_key] ?? false
                        const saving = savingAccess === `${plan.key}:${feat.feature_key}`
                        return (
                          <label key={feat.feature_key} className="flex items-center gap-3 cursor-pointer group py-1">
                            {saving
                              ? <Loader2 className="w-4 h-4 animate-spin text-stone-400 flex-shrink-0" />
                              : <input type="checkbox" checked={enabled} onChange={() => toggleFeature(plan.key, feat.feature_key, enabled)} className="accent-emerald-600 w-4 h-4 flex-shrink-0" />
                            }
                            <span className={`text-sm ${enabled ? 'text-stone-800' : 'text-stone-400'}`}>{feat.feature_name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {features.length === 0 && <p className="text-sm text-stone-400">Nenhum recurso cadastrado ainda.</p>}
            </div>
          </div>
        </>
      ) : (
        /* Comparative table */
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium w-56">Recurso</th>
                  {plans.map(p => (
                    <th key={p.key} className="px-4 py-3 text-center text-stone-600 font-semibold min-w-[120px]">
                      <div>{p.label}</div>
                      <div className="font-normal text-stone-400 text-[11px]">{p.price}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const catFeatures = features.filter(f => f.category === cat)
                  return [
                    <tr key={`cat-${cat}`} className="bg-stone-100">
                      <td colSpan={5} className="px-4 py-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                        {cat}
                      </td>
                    </tr>,
                    ...catFeatures.map(feat => (
                      <tr key={feat.feature_key} className="hover:bg-stone-50 border-t border-stone-50">
                        <td className="px-4 py-2.5 text-stone-700 font-medium">
                          {feat.feature_name}
                          {feat.feature_description && (
                            <span className="block text-stone-400 font-normal text-[11px] leading-tight mt-0.5">{feat.feature_description}</span>
                          )}
                        </td>
                        {PLAN_KEYS.map(pk => {
                          const enabled = access[pk]?.[feat.feature_key] ?? false
                          const isSaving = savingAccess === `${pk}:${feat.feature_key}`
                          return (
                            <td key={pk} className="px-4 py-2.5 text-center">
                              {isSaving
                                ? <Loader2 className="w-4 h-4 animate-spin text-stone-400 mx-auto" />
                                : <button
                                    onClick={() => toggleFeature(pk, feat.feature_key, enabled)}
                                    title={enabled ? 'Desativar' : 'Ativar'}
                                    className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center transition-colors ${enabled ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-stone-500'}`}
                                  >
                                    {enabled && <Check className="w-3 h-3" />}
                                  </button>
                              }
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  ]
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
