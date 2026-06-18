import { useState } from 'react'
import { Save, Check } from 'lucide-react'

type PlanKey = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'

interface PlanConfig {
  key: PlanKey
  label: string
  price: string
  description: string
  recommended: boolean
  active: boolean
  diaryLimit: number | null
  features: Record<string, boolean>
}

const ALL_FEATURES: { key: string; label: string }[] = [
  { key: 'diary_unlimited', label: 'Diário ilimitado' },
  { key: 'diary_advanced', label: 'Diário avançado (marcadores, padrões)' },
  { key: 'export_pdf', label: 'Exportação em PDF' },
  { key: 'monthly_report', label: 'Relatório mensal simples' },
  { key: 'advanced_report', label: 'Relatório avançado' },
  { key: 'emotional_map', label: 'Mapa emocional' },
  { key: 'saved_items', label: 'Caixa de Cuidado' },
  { key: 'trails', label: 'Trilhas de autocuidado' },
  { key: 'premium_articles', label: 'Artigos premium' },
  { key: 'guided_meditations', label: 'Meditações guiadas' },
  { key: 'automated_contents', label: 'Conteúdos automáticos' },
  { key: 'scheduled_contents', label: 'Conteúdos programados' },
  { key: 'therapeutic_questionnaire', label: 'Questionário aprofundado' },
  { key: 'autocuidado_plan', label: 'Plano de autocuidado' },
  { key: 'session_prep', label: 'Preparação para sessão' },
  { key: 'session_summary', label: 'Resumo para profissional' },
  { key: 'priority_support', label: 'Suporte prioritário' },
]

const DEFAULT_PLANS: PlanConfig[] = [
  {
    key: 'free', label: 'Gratuito', price: 'R$ 0', description: 'Para quem quer começar a se conhecer melhor.',
    recommended: false, active: true, diaryLimit: 5,
    features: { saved_items: true, trails: false, export_pdf: false, premium_articles: false, guided_meditations: false, automated_contents: false },
  },
  {
    key: 'essential', label: 'Essencial', price: 'R$ 19,90', description: 'Diário completo e relatórios mensais.',
    recommended: true, active: true, diaryLimit: null,
    features: { diary_unlimited: true, export_pdf: true, monthly_report: true, emotional_map: true, saved_items: true, trails: true, guided_meditations: true, automated_contents: true },
  },
  {
    key: 'therapeutic', label: 'Terapêutico', price: 'R$ 34,90', description: 'Análise profunda de padrões emocionais.',
    recommended: false, active: true, diaryLimit: null,
    features: { diary_unlimited: true, diary_advanced: true, export_pdf: true, monthly_report: true, advanced_report: true, emotional_map: true, saved_items: true, trails: true, guided_meditations: true, automated_contents: true, therapeutic_questionnaire: true, autocuidado_plan: true, scheduled_contents: true },
  },
  {
    key: 'therapeutic-plus', label: 'Terapêutico Plus', price: 'R$ 54,90', description: 'Tudo do Terapêutico + suporte a sessões.',
    recommended: false, active: true, diaryLimit: null,
    features: { diary_unlimited: true, diary_advanced: true, export_pdf: true, monthly_report: true, advanced_report: true, emotional_map: true, saved_items: true, trails: true, guided_meditations: true, automated_contents: true, therapeutic_questionnaire: true, autocuidado_plan: true, session_prep: true, session_summary: true, priority_support: true, scheduled_contents: true },
  },
]

export default function AdminPlans() {
  const [plans, setPlans] = useState<PlanConfig[]>(DEFAULT_PLANS)
  const [saved, setSaved] = useState(false)
  const [activeTab, setActiveTab] = useState<PlanKey>('free')

  function update(key: PlanKey, field: keyof PlanConfig, value: any) {
    setPlans(p => p.map(pl => pl.key === key ? { ...pl, [field]: value } : pl))
  }

  function toggleFeature(key: PlanKey, feature: string) {
    setPlans(p => p.map(pl => pl.key === key
      ? { ...pl, features: { ...pl.features, [feature]: !pl.features[feature] } }
      : pl
    ))
  }

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    // TODO: persist to supabase plan_configs table
  }

  const plan = plans.find(p => p.key === activeTab)!

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Planos</h1>
        <button
          onClick={save}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>

      {/* Plan tabs */}
      <div className="flex gap-1 mb-6 bg-stone-100 p-1 rounded-xl">
        {plans.map(p => (
          <button
            key={p.key}
            onClick={() => setActiveTab(p.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === p.key ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {p.label}
            {p.recommended && <span className="ml-1 text-xs text-emerald-600">★</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Informações do plano</h2>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Nome</label>
            <input
              value={plan.label}
              onChange={e => update(plan.key, 'label', e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Preço</label>
            <input
              value={plan.price}
              onChange={e => update(plan.key, 'price', e.target.value)}
              placeholder="Ex: R$ 19,90/mês"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Descrição curta</label>
            <textarea
              value={plan.description}
              onChange={e => update(plan.key, 'description', e.target.value)}
              rows={2}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">
              Limite do diário (entradas/mês — deixe vazio para ilimitado)
            </label>
            <input
              type="number"
              value={plan.diaryLimit ?? ''}
              onChange={e => update(plan.key, 'diaryLimit', e.target.value ? Number(e.target.value) : null)}
              placeholder="Ilimitado"
              className={inputCls}
              min={1}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={plan.recommended}
                onChange={e => update(plan.key, 'recommended', e.target.checked)}
                className="accent-emerald-600"
              />
              Destacar como mais recomendado
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
              <input
                type="checkbox"
                checked={plan.active}
                onChange={e => update(plan.key, 'active', e.target.checked)}
                className="accent-emerald-600"
              />
              Plano ativo
            </label>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Recursos incluídos</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {ALL_FEATURES.map(f => (
              <label key={f.key} className="flex items-center gap-3 cursor-pointer group py-1">
                <input
                  type="checkbox"
                  checked={!!plan.features[f.key]}
                  onChange={() => toggleFeature(plan.key, f.key)}
                  className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                />
                <span className={`text-sm ${plan.features[f.key] ? 'text-stone-800' : 'text-stone-400'}`}>
                  {f.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Overview table */}
      <div className="mt-6 bg-white rounded-xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h2 className="font-semibold text-stone-700 text-sm">Visão geral — todos os planos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead className="bg-stone-50">
              <tr>
                <th className="text-left px-4 py-2 text-stone-500 font-medium">Recurso</th>
                {plans.map(p => (
                  <th key={p.key} className="px-4 py-2 text-center text-stone-500 font-medium">{p.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {ALL_FEATURES.map(f => (
                <tr key={f.key} className="hover:bg-stone-50">
                  <td className="px-4 py-2 text-stone-600">{f.label}</td>
                  {plans.map(p => (
                    <td key={p.key} className="px-4 py-2 text-center">
                      {p.features[f.key]
                        ? <span className="text-emerald-600">✓</span>
                        : <span className="text-stone-200">—</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-400 mt-4">
        ⚠️ As configurações de plano ainda são gerenciadas no código. Integração completa com banco de dados será ativada na próxima etapa via tabela <code>plan_configs</code>.
      </p>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
