import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, Check, Edit3, Loader2, Plus, RefreshCw, RotateCcw, Save, Search, ShieldCheck, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import {
  buildFallbackPlanFeatureCatalog,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalogItem,
} from '../../lib/planFeatureCatalog'
import { OFFICIAL_PLANS, PLAN_KEYS, type PlanKey } from '../../lib/officialPlans'

const inputCls = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-200'

function cloneItem(item: PlanFeatureCatalogItem): PlanFeatureCatalogItem {
  return {
    ...item,
    plans: {
      free: { ...item.plans.free },
      essential: { ...item.plans.essential },
      plus: { ...item.plans.plus },
    },
  }
}

function emptyCommercialFeature(): PlanFeatureCatalogItem {
  const nextOrder = Math.max(100, ...buildFallbackPlanFeatureCatalog().items.map(item => item.order + 1))
  return {
    key: '',
    name: '',
    description: '',
    category: 'Outros',
    order: nextOrder,
    kind: 'commercial',
    isSystem: false,
    isActive: true,
    showOnPricing: true,
    showOnMyPlan: true,
    showOnComparison: true,
    showOnUpgrade: true,
    plans: {
      free: { enabled: false, label: null, description: null },
      essential: { enabled: false, label: null, description: null },
      plus: { enabled: false, label: null, description: null },
    },
  }
}

function customKey(name: string): string {
  const slug = name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 42)
  return `custom_${slug || 'beneficio'}_${Date.now().toString(36)}`
}

export default function AdminPlanFeatureCatalog() {
  const [items, setItems] = useState<PlanFeatureCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [editing, setEditing] = useState<PlanFeatureCatalogItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [fallback, setFallback] = useState(false)
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null)

  const notify = (text: string, ok = true) => {
    setToast({ ok, text })
    window.setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const catalog = await loadPlanFeatureCatalog()
    setItems(catalog.items)
    setFallback(catalog.source === 'fallback')
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => [...new Set(items.map(item => item.category).filter(Boolean))].sort(), [items])
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('pt-BR')
    return items.filter(item => {
      if (status === 'active' && !item.isActive) return false
      if (status === 'archived' && item.isActive) return false
      if (category !== 'all' && item.category !== category) return false
      if (needle && !`${item.name} ${item.description} ${item.category} ${item.key}`.toLocaleLowerCase('pt-BR').includes(needle)) return false
      return true
    })
  }, [items, query, category, status])

  function openEdit(item: PlanFeatureCatalogItem) {
    setIsNew(false)
    setEditing(cloneItem(item))
  }

  function openNew() {
    setIsNew(true)
    setEditing(emptyCommercialFeature())
  }

  function patchEditing(patch: Partial<PlanFeatureCatalogItem>) {
    setEditing(current => current ? { ...current, ...patch } : current)
  }

  function patchPlan(plan: PlanKey, patch: Partial<PlanFeatureCatalogItem['plans'][PlanKey]>) {
    setEditing(current => current ? {
      ...current,
      plans: { ...current.plans, [plan]: { ...current.plans[plan], ...patch } },
    } : current)
  }

  async function saveFeature() {
    if (!editing || !editing.name.trim()) {
      notify('Informe o nome da funcionalidade.', false)
      return
    }
    setSaving(true)
    const key = isNew ? customKey(editing.name) : editing.key
    const featurePayload = {
      feature_key: key,
      feature_name: editing.name.trim(),
      feature_description: editing.description.trim() || null,
      category: editing.category.trim() || 'Outros',
      display_order: Number.isFinite(editing.order) ? editing.order : 999,
      presentation_revision: Date.now(),
      ...(isNew ? { feature_kind: 'commercial', is_system: false, is_implemented: true } : {}),
      is_active: editing.isActive,
      show_on_pricing: editing.showOnPricing,
      show_on_my_plan: editing.showOnMyPlan,
      show_on_comparison: editing.showOnComparison,
      show_on_upgrade: editing.showOnUpgrade,
      archived_at: editing.isActive ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: featureError } = await supabase.from('plan_features').upsert(featurePayload, { onConflict: 'feature_key' })
    if (featureError) {
      setSaving(false)
      notify(`Não foi possível salvar: ${featureError.message}`, false)
      return
    }

    for (const plan of PLAN_KEYS) {
      const access = editing.plans[plan]
      const payload = {
        plan_key: plan,
        feature_key: key,
        enabled: access.enabled,
        custom_label: access.label?.trim() || null,
        custom_description: access.description?.trim() || null,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('plan_feature_access').upsert(payload, { onConflict: 'plan_key,feature_key' })
      if (error) {
        setSaving(false)
        notify(`A funcionalidade foi salva, mas houve erro no plano ${plan}: ${error.message}`, false)
        await load()
        return
      }
    }

    void logAdminAction('update', 'plan_features', key, null)
    setSaving(false)
    setEditing(null)
    setIsNew(false)
    notify(isNew ? 'Nova funcionalidade comercial criada.' : 'Textos da funcionalidade atualizados no catálogo.')
    await load()
  }

  async function toggleArchive(item: PlanFeatureCatalogItem) {
    const nextActive = !item.isActive
    const { error } = await supabase.from('plan_features').update({
      is_active: nextActive,
      archived_at: nextActive ? null : new Date().toISOString(),
      presentation_revision: Date.now(),
      updated_at: new Date().toISOString(),
    }).eq('feature_key', item.key)
    if (error) {
      notify(`Não foi possível ${nextActive ? 'reativar' : 'arquivar'}: ${error.message}`, false)
      return
    }
    void logAdminAction(nextActive ? 'restore' : 'archive', 'plan_features', item.key, null)
    notify(nextActive ? 'Funcionalidade reativada.' : 'Funcionalidade arquivada. Ela deixa de aparecer no site, mas o histórico é preservado.')
    await load()
  }

  if (loading) return <div className="flex items-center gap-2 py-12 text-sm text-ink-soft"><Loader2 className="w-4 h-4 animate-spin" /> Carregando catálogo…</div>

  return (
    <div className="max-w-6xl">
      {toast && <div className={`fixed top-4 right-4 z-[70] max-w-sm rounded-xl px-4 py-3 text-sm text-white shadow-lg ${toast.ok ? 'bg-forest-800' : 'bg-red-600'}`}>{toast.text}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="font-serif text-2xl text-forest-900">Catálogo de funcionalidades</h2>
          <p className="text-sm text-ink-soft mt-1 max-w-3xl">Edite aqui os nomes e descrições que aparecem nos planos do site. As chaves técnicas dos recursos do sistema permanecem protegidas.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-xl border border-line bg-white p-2.5 text-forest-700" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={openNew} disabled={fallback} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"><Plus className="w-4 h-4" /> Nova funcionalidade</button>
        </div>
      </div>

      {fallback && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Modo seguro:</strong> a estrutura dinâmica ainda não está disponível no banco. O site continua usando o catálogo oficial; edição fica bloqueada até a migration ser aplicada.</div>}

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_200px_160px]">
        <label className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-stone-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar nome, descrição ou chave…" className={`${inputCls} pl-9`} /></label>
        <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}><option value="all">Todas as categorias</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select>
        <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={inputCls}><option value="active">Ativas</option><option value="archived">Arquivadas</option><option value="all">Todas</option></select>
      </div>

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.key} className={`rounded-2xl border bg-white p-4 ${item.isActive ? 'border-line' : 'border-stone-200 opacity-70'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-forest-900">{item.name}</h3>
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">{item.category}</span>
                  {item.isSystem ? <span className="inline-flex items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-[10px] text-forest-700"><ShieldCheck className="w-3 h-3" /> Recurso do sistema</span> : <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">Texto comercial</span>}
                  {!item.isActive && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-700">Arquivada</span>}
                </div>
                {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
                <p className="mt-2 font-mono text-[10px] text-stone-400">{item.key}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">{PLAN_KEYS.filter(plan => item.plans[plan].enabled).map(plan => <span key={plan} className="rounded-full border border-line px-2 py-0.5 text-[10px] text-stone-600">{OFFICIAL_PLANS.find(p => p.key === plan)?.label}</span>)}</div>
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <button onClick={() => openEdit(item)} disabled={fallback} className="rounded-lg border border-line p-2 text-forest-700 disabled:opacity-40" title="Editar"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => void toggleArchive(item)} disabled={fallback} className="rounded-lg border border-line p-2 text-stone-500 disabled:opacity-40" title={item.isActive ? 'Arquivar' : 'Reativar'}>{item.isActive ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="rounded-2xl border border-dashed border-line p-10 text-center text-sm text-ink-soft">Nenhuma funcionalidade encontrada.</div>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={isNew ? 'Nova funcionalidade' : 'Editar funcionalidade'}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-4"><div><h3 className="font-serif text-2xl text-forest-900">{isNew ? 'Nova funcionalidade comercial' : editing.name}</h3><p className="text-xs text-ink-soft">{editing.isSystem ? 'A chave técnica é protegida. Você está editando somente apresentação.' : 'Este item é textual e não libera recursos técnicos.'}</p></div><button onClick={() => setEditing(null)} className="p-2 text-stone-400" aria-label="Fechar"><X className="w-5 h-5" /></button></div>
            <div className="space-y-6 p-5">
              <section className="grid gap-4 md:grid-cols-2">
                <label className="md:col-span-2"><span className="mb-1 block text-xs font-medium text-stone-600">Nome exibido no site</span><input value={editing.name} onChange={e => patchEditing({ name: e.target.value })} className={inputCls} /></label>
                <label className="md:col-span-2"><span className="mb-1 block text-xs font-medium text-stone-600">Descrição</span><textarea value={editing.description} onChange={e => patchEditing({ description: e.target.value })} rows={3} className={inputCls} placeholder="Explique o benefício em linguagem simples." /></label>
                <label><span className="mb-1 block text-xs font-medium text-stone-600">Categoria</span><input value={editing.category} onChange={e => patchEditing({ category: e.target.value })} className={inputCls} /></label>
                <label><span className="mb-1 block text-xs font-medium text-stone-600">Ordem</span><input type="number" value={editing.order} onChange={e => patchEditing({ order: Number(e.target.value) || 0 })} className={inputCls} /></label>
                {!isNew && <label className="md:col-span-2"><span className="mb-1 block text-xs font-medium text-stone-600">Chave interna — não editável</span><input value={editing.key} readOnly className={`${inputCls} bg-stone-50 font-mono text-stone-500`} /></label>}
              </section>

              <section><h4 className="text-sm font-semibold text-forest-900">Onde este texto aparece</h4><div className="mt-3 grid gap-2 sm:grid-cols-2">{[
                ['showOnPricing', 'Página de Planos'], ['showOnMyPlan', 'Meu Plano'], ['showOnComparison', 'Comparativo'], ['showOnUpgrade', 'Upgrade / troca de plano'],
              ].map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl border border-line p-3 text-sm text-stone-700"><input type="checkbox" checked={Boolean(editing[key as keyof PlanFeatureCatalogItem])} onChange={e => patchEditing({ [key]: e.target.checked } as Partial<PlanFeatureCatalogItem>)} className="accent-forest-700" /> {label}</label>)}</div></section>

              <section><h4 className="text-sm font-semibold text-forest-900">Texto por plano</h4><p className="mt-1 text-xs text-ink-soft">Deixe o texto específico vazio para usar o nome e a descrição gerais. Em recursos do sistema, a disponibilidade técnica continua sendo controlada na tela de permissões.</p><div className="mt-3 space-y-3">{PLAN_KEYS.map(plan => {
                const planLabel = OFFICIAL_PLANS.find(p => p.key === plan)?.label || plan
                const access = editing.plans[plan]
                return <div key={plan} className="rounded-2xl border border-line p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm text-forest-900">{planLabel}</strong>{editing.kind === 'commercial' ? <label className="flex items-center gap-2 text-xs text-stone-600"><input type="checkbox" checked={access.enabled} onChange={e => patchPlan(plan, { enabled: e.target.checked })} className="accent-forest-700" /> Mostrar neste plano</label> : <span className={`inline-flex items-center gap-1 text-xs ${access.enabled ? 'text-forest-700' : 'text-stone-400'}`}>{access.enabled && <Check className="w-3.5 h-3.5" />}{access.enabled ? 'Disponível' : 'Não disponível'}</span>}</div><div className="mt-3 grid gap-3 md:grid-cols-2"><label><span className="mb-1 block text-[11px] text-stone-500">Nome específico (opcional)</span><input value={access.label || ''} onChange={e => patchPlan(plan, { label: e.target.value || null })} className={inputCls} placeholder={editing.name || 'Nome geral'} /></label><label><span className="mb-1 block text-[11px] text-stone-500">Descrição específica (opcional)</span><input value={access.description || ''} onChange={e => patchPlan(plan, { description: e.target.value || null })} className={inputCls} placeholder="Usar descrição geral" /></label></div></div>
              })}</div></section>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-white px-5 py-4"><button onClick={() => setEditing(null)} className="rounded-xl border border-line px-4 py-2 text-sm text-stone-600">Cancelar</button><button onClick={() => void saveFeature()} disabled={saving || !editing.name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Salvando…' : 'Salvar e refletir no site'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
