import { useState } from 'react'
import { Save, Check } from 'lucide-react'

type PlanKey = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'

interface DiaryPlanConfig {
  plan: PlanKey
  label: string
  entriesPerMonth: number | null
  fields: Record<string, boolean>
  guidedQuestions: string[]
  exportPDF: boolean
  history: string
  graphs: string[]
  reports: string[]
}

const FIELDS = [
  { key: 'mood', label: 'Humor (escala simples)' },
  { key: 'mood_emoji', label: 'Emoji de humor' },
  { key: 'free_note', label: 'Campo livre' },
  { key: 'guided_question', label: 'Pergunta guiada' },
  { key: 'emotional_tags', label: 'Tags emocionais' },
  { key: 'energy', label: 'Energia' },
  { key: 'anxiety_level', label: 'Nível de ansiedade' },
  { key: 'stress_level', label: 'Nível de estresse' },
  { key: 'sleep_quality', label: 'Qualidade do sono' },
  { key: 'self_esteem', label: 'Autoestima' },
  { key: 'irritability', label: 'Irritabilidade' },
  { key: 'overload', label: 'Sobrecarga' },
  { key: 'emotional_triggers', label: 'Gatilhos emocionais' },
  { key: 'recurring_thoughts', label: 'Pensamentos recorrentes' },
  { key: 'emotional_need', label: 'Necessidade emocional' },
  { key: 'relationships', label: 'Relacionamentos' },
  { key: 'habits', label: 'Hábitos' },
  { key: 'gratitude', label: 'Gratidão' },
  { key: 'small_pride', label: 'Pequeno orgulho' },
]

const DEFAULT_CONFIGS: DiaryPlanConfig[] = [
  {
    plan: 'free', label: 'Gratuito', entriesPerMonth: 5, exportPDF: false,
    history: '30 dias',
    fields: { mood: true, free_note: true, guided_question: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?'],
    graphs: [], reports: [],
  },
  {
    plan: 'essential', label: 'Essencial', entriesPerMonth: null, exportPDF: true,
    history: 'Completo',
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, energy: true, anxiety_level: true, sleep_quality: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'Tem algo que gostaria de mudar amanhã?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia'], reports: ['Relatório mensal simples'],
  },
  {
    plan: 'therapeutic', label: 'Terapêutico', entriesPerMonth: null, exportPDF: true,
    history: 'Completo',
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, energy: true, anxiety_level: true, stress_level: true, sleep_quality: true, self_esteem: true, irritability: true, overload: true, emotional_triggers: true, recurring_thoughts: true, emotional_need: true, relationships: true, habits: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'Quais padrões você percebeu esta semana?', 'O que você precisa mais de você mesmo hoje?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia', 'Padrões emocionais', 'Mapa de gatilhos'],
    reports: ['Relatório mensal simples', 'Relatório avançado', 'Plano de autocuidado'],
  },
  {
    plan: 'therapeutic-plus', label: 'Terapêutico Plus', entriesPerMonth: null, exportPDF: true,
    history: 'Completo',
    fields: { mood: true, mood_emoji: true, free_note: true, guided_question: true, emotional_tags: true, energy: true, anxiety_level: true, stress_level: true, sleep_quality: true, self_esteem: true, irritability: true, overload: true, emotional_triggers: true, recurring_thoughts: true, emotional_need: true, relationships: true, habits: true, gratitude: true, small_pride: true },
    guidedQuestions: ['Como você está se sentindo agora?', 'O que marcou seu dia hoje?', 'Quais padrões você percebeu esta semana?', 'O que você precisa mais de você mesmo hoje?', 'Como posso me preparar melhor para minha próxima sessão?'],
    graphs: ['Humor ao longo do tempo', 'Nível de energia', 'Padrões emocionais', 'Mapa de gatilhos', 'Evolução semanal'],
    reports: ['Relatório mensal simples', 'Relatório avançado', 'Plano de autocuidado', 'Resumo para sessão', 'Preparação para sessão'],
  },
]

export default function AdminDiaryConfig() {
  const [configs, setConfigs] = useState<DiaryPlanConfig[]>(DEFAULT_CONFIGS)
  const [activeTab, setActiveTab] = useState<PlanKey>('free')
  const [saved, setSaved] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')

  const cfg = configs.find(c => c.plan === activeTab)!

  function updateCfg(field: keyof DiaryPlanConfig, value: any) {
    setConfigs(cs => cs.map(c => c.plan === activeTab ? { ...c, [field]: value } : c))
  }

  function toggleField(key: string) {
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

  function save() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Diário por Plano</h1>
        <button onClick={save} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700">
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-stone-100 p-1 rounded-xl">
        {configs.map(c => (
          <button key={c.plan} onClick={() => setActiveTab(c.plan)}
            className={`flex-1 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === c.plan ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* Limits */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Limites e acesso</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Entradas por mês (vazio = ilimitado)</label>
              <input
                type="number"
                value={cfg.entriesPerMonth ?? ''}
                onChange={e => updateCfg('entriesPerMonth', e.target.value ? Number(e.target.value) : null)}
                placeholder="Ilimitado"
                className={inputCls}
                min={1}
              />
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
            <input type="checkbox" checked={cfg.exportPDF} onChange={e => updateCfg('exportPDF', e.target.checked)} className="accent-emerald-600" />
            Permitir exportação em PDF
          </label>
        </div>

        {/* Fields */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Campos disponíveis</h2>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                <input type="checkbox" checked={!!cfg.fields[f.key]} onChange={() => toggleField(f.key)} className="accent-emerald-600" />
                <span className={cfg.fields[f.key] ? 'text-stone-800' : 'text-stone-400'}>{f.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Guided questions */}
        <div className="bg-white rounded-xl border border-stone-200 p-5">
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
            <button onClick={addQuestion} className="px-3 py-2 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700">
              Adicionar
            </button>
          </div>
        </div>

        {/* Reports & graphs */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">Gráficos disponíveis</h2>
            <div className="space-y-1">
              {cfg.graphs.length === 0
                ? <p className="text-sm text-stone-400">Nenhum gráfico neste plano</p>
                : cfg.graphs.map((g, i) => <p key={i} className="text-sm text-stone-700">• {g}</p>)
              }
            </div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-5">
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

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
