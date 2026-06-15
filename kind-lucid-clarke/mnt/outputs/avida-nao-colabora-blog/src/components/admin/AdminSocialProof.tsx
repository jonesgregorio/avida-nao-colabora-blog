import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Save, Plus, Trash2 } from 'lucide-react'

interface Metric { label: string; value: string }
interface Testimonial { name: string; text: string }

export default function AdminSocialProof() {
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: 'pessoas já passaram por aqui', value: '+800' },
    { label: 'usuários ativos atualmente', value: '335' },
    { label: 'registros emocionais criados', value: '+1.300' },
    { label: 'avaliação média', value: '4,7/5' },
  ])
  const [testimonials, setTestimonials] = useState<Testimonial[]>([
    { name: 'Mariana L.', text: 'Comecei usando o diário alguns dias por semana. Gosto porque não parece uma cobrança, só um espaço para entender melhor o que estou sentindo.' },
    { name: 'Rafael M.', text: 'Os artigos têm uma linguagem leve. Em alguns dias, só ler o resumo e responder uma pergunta já me ajuda a organizar as ideias.' },
    { name: 'Camila R.', text: 'Ainda estou conhecendo a plataforma, mas gostei da proposta de juntar diário, conteúdos e reflexões em um só lugar.' },
  ])
  const [saved, setSaved] = useState(false)

  function updateMetric(i: number, field: keyof Metric, val: string) {
    setMetrics(m => m.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  function updateTestimonial(i: number, field: keyof Testimonial, val: string) {
    setTestimonials(t => t.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  function saveAll() {
    // In a real implementation, this would save to a Supabase config table.
    // For now we show a confirmation and the user must update HomeContent.tsx manually or via this editor.
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Prova Social</h1>
        <button
          onClick={saveAll}
          className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
        >
          <Save className="w-4 h-4" /> {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 mb-4 text-sm uppercase tracking-wide">Métricas</h2>
        <div className="space-y-3">
          {metrics.map((m, i) => (
            <div key={i} className="flex gap-3 items-center">
              <input
                value={m.value}
                onChange={e => updateMetric(i, 'value', e.target.value)}
                className="w-32 px-3 py-2 border border-stone-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-stone-300"
                placeholder="Valor"
              />
              <input
                value={m.label}
                onChange={e => updateMetric(i, 'label', e.target.value)}
                className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                placeholder="Descrição"
              />
              <button onClick={() => setMetrics(m => m.filter((_, idx) => idx !== i))} className="text-stone-300 hover:text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setMetrics(m => [...m, { value: '', label: '' }])}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
          >
            <Plus className="w-4 h-4" /> Adicionar métrica
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h2 className="font-semibold text-stone-700 mb-4 text-sm uppercase tracking-wide">Depoimentos</h2>
        <div className="space-y-4">
          {testimonials.map((t, i) => (
            <div key={i} className="bg-stone-50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={t.name}
                  onChange={e => updateTestimonial(i, 'name', e.target.value)}
                  className="w-40 px-3 py-1.5 border border-stone-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-300"
                  placeholder="Nome"
                />
                <button onClick={() => setTestimonials(ts => ts.filter((_, idx) => idx !== i))} className="text-stone-300 hover:text-red-500 ml-auto">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={t.text}
                onChange={e => updateTestimonial(i, 'text', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
                placeholder="Depoimento"
              />
            </div>
          ))}
          <button
            onClick={() => setTestimonials(ts => [...ts, { name: '', text: '' }])}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
          >
            <Plus className="w-4 h-4" /> Adicionar depoimento
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-4">
          ⚠️ As alterações aqui são salvas localmente. Para refletir no site, será necessária integração com a tabela <code>site_config</code> no Supabase (ver SQL schema).
        </p>
      </div>
    </div>
  )
}
