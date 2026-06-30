import { useEffect, useState, useCallback } from 'react'
import { Save, Check, Loader2, RefreshCw, RotateCcw, Upload, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  OFFICIAL_FEATURES,
  OFFICIAL_PLANS,
  DEFAULT_PLAN_ACCESS,
  PLAN_KEYS,
  buildDefaultAccessMap,
  resolveKey,
  type PlanKey,
} from '../../lib/officialPlans'

interface PlanConfig {
  key: PlanKey
  label: string
  price: string
  description: string
  recommended: boolean
  active: boolean
  diaryLimit: number | null
}

type AccessMap = Record<string, Record<string, boolean>>

const DEFAULT_PLAN_CONFIGS: PlanConfig[] = OFFICIAL_PLANS.map(p => ({
  key: p.key,
  label: p.label,
  price: p.price,
  description: p.tagline,
  recommended: p.recommended ?? false,
  active: true,
  diaryLimit: p.key === 'free' ? 5 : null,
}))

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

const categories = Array.from(new Set(OFFICIAL_FEATURES.map(f => f.category))).sort()

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLAN_CONFIGS)
  const [access, setAccess] = useState<AccessMap>(buildDefaultAccessMap())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingAccess, setSavingAccess] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<PlanKey>('free')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [usingFallback, setUsingFallback] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setUsingFallback(false)

    const [{ data: cfgData }, { data: featData }, { data: accessData }] = await Promise.all([
      supabase.from('plan_configs').select('*'),
      supabase.from('plan_features').select('*').eq('is_display', true).order('display_order'),
      supabase.from('plan_feature_access').select('*'),
    ])

    // ── Plan configs ──────────────────────────────────────────────────────────
    if (cfgData && cfgData.length > 0) {
      setPlans(prev => prev.map(pl => {
        const saved = cfgData.find((d: Record<string, unknown>) => d.plan_key === pl.key) as Record<string, unknown> | undefined
        if (!saved) return pl
        return {
          ...pl,
          label:       (saved.label       as string)         ?? pl.label,
          price:       (saved.price       as string)         ?? pl.price,
          description: (saved.description as string)         ?? pl.description,
          recommended: (saved.recommended as boolean)        ?? pl.recommended,
          active:      (saved.active      as boolean)        ?? pl.active,
          diaryLimit:  (saved.diary_limit as number | null)  ?? pl.diaryLimit,
        }
      }))
    }

    // ── Feature access ────────────────────────────────────────────────────────
    // Se o banco retornou dados de acesso, usamos — senão fallback local
    if (accessData && accessData.length > 0) {
      const map: AccessMap = buildDefaultAccessMap()
      for (const row of accessData as { plan_key: string; feature_key: string; enabled: boolean }[]) {
        const resolvedKey = resolveKey(row.feature_key)
        // só aplica se a chave é conhecida
        if (OFFICIAL_FEATURES.find(f => f.key === resolvedKey)) {
          if (!map[row.plan_key]) map[row.plan_key] = {}
          map[row.plan_key][resolvedKey] = row.enabled
        }
      }
      setAccess(map)
    } else if (!featData || featData.length === 0) {
      // Banco completamente vazio: usar fallback local
      setAccess(buildDefaultAccessMap())
      setUsingFallback(true)
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
        plan_key:    pl.key,
        label:       pl.label,
        price:       pl.price,
        description: pl.description,
        recommended: pl.recommended,
        active:      pl.active,
        diary_limit: pl.diaryLimit,
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'plan_key' })
      if (error) { console.error(error); hasError = true; break }
    }
    setSaving(false)
    hasError ? showToast('Erro ao salvar planos. Verifique o console.', false)
             : showToast('Informações dos planos salvas!')
  }

  async function toggleFeature(planKey: string, featureKey: string, current: boolean) {
    const newValue = !current
    setSavingAccess(`${planKey}:${featureKey}`)

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
      setAccess(prev => ({
        ...prev,
        [planKey]: { ...(prev[planKey] || {}), [featureKey]: current },
      }))
      showToast('Erro ao salvar permissão: ' + error.message, false)
    } else {
      setUsingFallback(false)
    }
  }

  function restoreDefaults() {
    setAccess(buildDefaultAccessMap())
    setConfirmRestore(false)
    showToast('Padrão oficial restaurado localmente. Clique em "Salvar permissões" para gravar no banco.')
  }

  async function saveAllAccess() {
    setSaving(true)
    let hasError = false
    const rows: { plan_key: string; feature_key: string; enabled: boolean; updated_at: string }[] = []
    for (const planKey of PLAN_KEYS) {
      for (const feat of OFFICIAL_FEATURES) {
        rows.push({
          plan_key:   planKey,
          feature_key: feat.key,
          enabled:    access[planKey]?.[feat.key] ?? false,
          updated_at: new Date().toISOString(),
        })
      }
    }
    const { error } = await supabase.from('plan_feature_access').upsert(rows, { onConflict: 'plan_key,feature_key' })
    if (error) { console.error(error); hasError = true }
    setSaving(false)
    hasError ? showToast('Erro ao salvar permissões.', false)
             : showToast('Permissões salvas com sucesso!')
  }

  async function syncToSupabase() {
    setSyncing(true)
    // Insere/atualiza plan_features com os recursos oficiais
    const featureRows = OFFICIAL_FEATURES.map(f => ({
      feature_key:         f.key,
      feature_name:        f.name,
      feature_description: '',
      category:            f.category,
      display_order:       f.order,
      is_display:          true,
      is_implemented:      true,
      updated_at:          new Date().toISOString(),
    }))
    const { error: featErr } = await supabase.from('plan_features')
      .upsert(featureRows, { onConflict: 'feature_key' })
    if (featErr) {
      showToast('Erro ao sincronizar recursos: ' + featErr.message, false)
      setSyncing(false)
      return
    }

    // Insere/atualiza plan_feature_access
    const accessRows: { plan_key: string; feature_key: string; enabled: boolean; updated_at: string }[] = []
    for (const planKey of PLAN_KEYS) {
      for (const feat of OFFICIAL_FEATURES) {
        accessRows.push({
          plan_key:    planKey,
          feature_key: feat.key,
          enabled:     DEFAULT_PLAN_ACCESS[planKey].includes(feat.key),
          updated_at:  new Date().toISOString(),
        })
      }
    }
    const { error: accErr } = await supabase.from('plan_feature_access')
      .upsert(accessRows, { onConflict: 'plan_key,feature_key' })
    if (accErr) {
      showToast('Erro ao sincronizar permissões: ' + accErr.message, false)
      setSyncing(false)
      return
    }

    showToast('Recursos oficiais sincronizados com o Supabase!')
    setUsingFallback(false)
    setSyncing(false)
    load()
  }

  const plan = plans.find(p => p.key === activeTab)!
  const activeCount = (planKey: string) =>
    OFFICIAL_FEATURES.filter(f => access[planKey]?.[f.key]).length

  return (
    <div className="max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm text-white max-w-sm ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Aviso de fallback */}
      {usingFallback && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Nenhum recurso encontrado no Supabase. Exibindo padrão oficial local.{' '}
            <button onClick={syncToSupabase} className="underline font-semibold">
              Clique aqui para sincronizar com o banco.
            </button>
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-stone-800">Planos</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={load}
            title="Recarregar"
            className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={syncToSupabase}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Sincronizar com Supabase
          </button>
          <button
            onClick={() => setConfirmRestore(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar padrão oficial
          </button>
          <div className="flex bg-stone-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              Tabela comparativa
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação de restauração */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-stone-800 mb-2">Restaurar padrão oficial?</h3>
            <p className="text-sm text-stone-500 mb-5">
              Isso irá restaurar os benefícios oficiais dos planos e pode sobrescrever alterações manuais. Deseja continuar?
            </p>
            <div className="flex gap-2">
              <button
                onClick={restoreDefaults}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-xl text-sm font-medium"
              >
                Restaurar
              </button>
              <button
                onClick={() => setConfirmRestore(false)}
                className="flex-1 border border-stone-200 text-stone-600 py-2 rounded-xl text-sm hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando...
        </div>
      ) : viewMode === 'cards' ? (
        <>
          {/* Tabs de plano */}
          <div className="flex gap-1 mb-6 bg-stone-100 p-1 rounded-xl overflow-x-auto">
            {plans.map(p => (
              <button
                key={p.key}
                onClick={() => setActiveTab(p.key)}
                className={`flex-1 min-w-[110px] px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === p.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {p.label}
                {p.recommended && <span className="ml-1 text-xs text-emerald-600">★</span>}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
            {/* Informações do plano */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Informações do plano</h2>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Nome</label>
                <input
                  value={plan.label}
                  onChange={e => updatePlan(plan.key, 'label', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Preço (texto)</label>
                <input
                  value={plan.price}
                  onChange={e => updatePlan(plan.key, 'price', e.target.value)}
                  placeholder="Ex: R$ 19,90/mês"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Descrição curta</label>
                <textarea
                  value={plan.description}
                  onChange={e => updatePlan(plan.key, 'description', e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Limite do diário / mês (vazio = ilimitado)</label>
                <input
                  type="number"
                  value={plan.diaryLimit ?? ''}
                  onChange={e => updatePlan(plan.key, 'diaryLimit', e.target.value ? Number(e.target.value) : null)}
                  placeholder="Ilimitado"
                  className={inputCls}
                  min={1}
                />
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.recommended}
                    onChange={e => updatePlan(plan.key, 'recommended', e.target.checked)}
                    className="accent-emerald-600"
                  />
                  Mais recomendado
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={e => updatePlan(plan.key, 'active', e.target.checked)}
                    className="accent-emerald-600"
                  />
                  Plano ativo
                </label>
              </div>
              <button
                onClick={savePlans}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar informações'}
              </button>
            </div>

            {/* Benefícios do plano */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Benefícios incluídos</h2>
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {activeCount(plan.key)} ativos
                </span>
              </div>

              <div className="overflow-y-auto flex-1 max-h-[480px] pr-1 space-y-4">
                {categories.map(cat => {
                  const catFeatures = OFFICIAL_FEATURES.filter(f => f.category === cat)
                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1.5 border-b pb-1">{cat}</p>
                      <div className="space-y-1">
                        {catFeatures.map(feat => {
                          const enabled = access[plan.key]?.[feat.key] ?? false
                          const isSaving = savingAccess === `${plan.key}:${feat.key}`
                          return (
                            <label key={feat.key} className="flex items-center gap-3 cursor-pointer group py-1">
                              {isSaving
                                ? <Loader2 className="w-4 h-4 animate-spin text-stone-400 flex-shrink-0" />
                                : (
                                  <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={() => toggleFeature(plan.key, feat.key, enabled)}
                                    className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                                  />
                                )
                              }
                              <span className={`text-sm leading-tight ${enabled ? 'text-stone-800' : 'text-stone-400'}`}>
                                {feat.name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                onClick={saveAllAccess}
                disabled={saving}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar permissões'}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Tabela comparativa */
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between">
            <p className="text-sm font-medium text-stone-700">Tabela comparativa de benefícios</p>
            <button
              onClick={saveAllAccess}
              disabled={saving}
              className="flex items-center gap-1.5 bg-stone-800 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-stone-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar permissões
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead className="bg-stone-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-stone-500 font-medium w-64">Benefício</th>
                  {plans.map(p => (
                    <th key={p.key} className="px-4 py-3 text-center text-stone-600 font-semibold min-w-[130px]">
                      <div>{p.label}</div>
                      <div className="font-normal text-stone-400 text-[11px]">{p.price}</div>
                      <div className="text-[10px] text-emerald-600 font-normal mt-0.5">{activeCount(p.key)} ativos</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const catFeatures = OFFICIAL_FEATURES.filter(f => f.category === cat)
                  return [
                    <tr key={`cat-${cat}`} className="bg-stone-100">
                      <td colSpan={5} className="px-4 py-2 text-xs font-bold text-stone-500 uppercase tracking-wider">
                        {cat}
                      </td>
                    </tr>,
                    ...catFeatures.map(feat => (
                      <tr key={feat.key} className="hover:bg-stone-50 border-t border-stone-50">
                        <td className="px-4 py-2.5 text-stone-700 font-medium leading-tight">{feat.name}</td>
                        {PLAN_KEYS.map(pk => {
                          const enabled = access[pk]?.[feat.key] ?? false
                          const isSaving = savingAccess === `${pk}:${feat.key}`
                          return (
                            <td key={pk} className="px-4 py-2.5 text-center">
                              {isSaving
                                ? <Loader2 className="w-4 h-4 animate-spin text-stone-400 mx-auto" />
                                : (
                                  <button
                                    onClick={() => toggleFeature(pk, feat.key, enabled)}
                                    title={enabled ? 'Desativar' : 'Ativar'}
                                    className={`w-5 h-5 rounded-full border-2 mx-auto flex items-center justify-center transition-colors ${enabled ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-stone-500'}`}
                                  >
                                    {enabled && <Check className="w-3 h-3" />}
                                  </button>
                                )
                              }
                            </td>
                          )
                        })}
                      </tr>
                    )),
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
