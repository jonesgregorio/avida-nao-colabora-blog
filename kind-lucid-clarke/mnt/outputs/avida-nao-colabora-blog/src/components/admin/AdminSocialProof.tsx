import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, Star, Sparkles } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'

interface Testimonial {
  id: string
  name: string
  text: string
  role: string | null
  avatar_url: string | null
  rating: number
  active: boolean
  created_at: string
}

interface SiteMetric {
  id: string
  key: string | null
  metric: string | null
  label: string | null
  value: string
  updated_at: string
}

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminSocialProof() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([])
  const [metrics, setMetrics] = useState<SiteMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [savingMetrics, setSavingMetrics] = useState(false)

  // Testimonial form
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [role, setRole] = useState('')
  const [rating, setRating] = useState(5)
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase.from('testimonials').select('*').order('created_at', { ascending: false }),
      supabase.from('site_metrics').select('*').order('label', { nullsFirst: false }),
    ])
    setTestimonials(t || [])
    if (m && m.length > 0) {
      setMetrics(m)
    } else {
      // Initialize default metrics if none exist
      const defaults = [
        { key: 'users_count', label: 'Usuários', value: '0' },
        { key: 'articles_count', label: 'Artigos publicados', value: '0' },
        { key: 'diary_entries', label: 'Entradas de diário', value: '0' },
        { key: 'satisfaction', label: 'Taxa de satisfação', value: '98%' },
      ]
      await supabase.from('site_metrics').insert(defaults)
      setMetrics(defaults.map((d, i) => ({ ...d, metric: d.key, id: String(i), updated_at: new Date().toISOString() })))
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveTestimonial() {
    if (!name.trim() || !text.trim()) return
    setSaving(true)
    const { error } = await supabase.from('testimonials').insert({
      name, text, role: role || null, rating,
      active: true,
    })
    setSaving(false)
    if (error) { showToast('Erro: ' + error.message); return }
    showToast('Depoimento salvo!')
    setShowForm(false); setName(''); setText(''); setRole(''); setRating(5)
    load()
  }

  async function toggleTestimonial(id: string, active: boolean) {
    await supabase.from('testimonials').update({ active: !active }).eq('id', id)
    setTestimonials(ts => ts.map(t => t.id === id ? { ...t, active: !active } : t))
  }

  async function deleteTestimonial(id: string) {
    if (!confirm('Excluir depoimento?')) return
    await supabase.from('testimonials').delete().eq('id', id)
    load()
  }

  async function saveMetrics() {
    setSavingMetrics(true)
    const results = await Promise.all(metrics.map(m =>
      supabase.from('site_metrics').update({ value: m.value, updated_at: new Date().toISOString() }).eq('id', m.id)
    ))
    setSavingMetrics(false)
    const firstError = results.find(r => r.error)?.error
    if (firstError) showToast('Erro: ' + firstError.message)
    else showToast('Métricas salvas!')
  }

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(null), 3000)
  }

  return (
    <div>
      {toast && <div className="fixed top-4 right-4 z-50 bg-forest-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">{toast}</div>}

      <h1 className="font-serif text-2xl text-forest-900 mb-6">Prova Social</h1>

      {/* Metrics */}
      <div className="bg-white rounded-xl border border-line p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Métricas do site</h2>
          <button onClick={saveMetrics} disabled={savingMetrics} className="flex items-center gap-2 bg-forest-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-forest-800 disabled:opacity-50">
            <Save className="w-3 h-3" /> {savingMetrics ? 'Salvando...' : 'Salvar métricas'}
          </button>
        </div>
        {loading ? (
          <p className="text-stone-400 text-sm">Carregando...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.map((m, i) => (
              <div key={m.id || i}>
                <label className="block text-xs text-stone-500 mb-1">{m.label || m.key || m.metric || '—'}</label>
                <input
                  value={m.value}
                  onChange={e => setMetrics(ms => ms.map((x, j) => j === i ? { ...x, value: e.target.value } : x))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Testimonials */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Depoimentos</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-forest-900 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-forest-800">
          <Plus className="w-3.5 h-3.5" /> Novo depoimento
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-line p-5 mb-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nome</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Ana Silva" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Cargo / Descrição (opcional)</label>
              <input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex: Usuária há 6 meses" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nota (1-5)</label>
              <select value={rating} onChange={e => setRating(Number(e.target.value))} className={inputCls}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'⭐'.repeat(n)} ({n})</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-stone-500">Depoimento</label>
              <button
                type="button"
                onClick={() => setShowAI(true)}
                className="flex items-center gap-1 text-xs text-forest-800 bg-mint border border-forest-200 px-2.5 py-1 rounded-lg hover:bg-mint transition-colors font-medium"
              >
                <Sparkles className="w-3 h-3" /> Gerar com IA
              </button>
            </div>
            {showAI && (
              <AIContentAssistant
                contentType="social_proof"
                defaultTheme="depoimento de usuário do app de bem-estar"
                label="Gerar texto de prova social"
                onInsert={result => { setText(result); setShowAI(false) }}
                onClose={() => setShowAI(false)}
              />
            )}
            <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="O que a pessoa disse sobre a plataforma..." className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={saveTestimonial} disabled={saving} className="px-4 py-2 bg-forest-700 text-white text-sm rounded-lg hover:bg-forest-800 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-line text-stone-600 text-sm rounded-lg hover:bg-stone-50">Cancelar</button>
          </div>
        </div>
      )}

      {loading ? null : testimonials.length === 0 ? (
        <div className="text-center py-12 text-stone-400 bg-white rounded-xl border border-line">
          <Star className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum depoimento cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map(t => (
            <div key={t.id} className={`bg-white rounded-xl border p-4 ${!t.active ? 'opacity-60' : 'border-line'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-forest-900 text-sm">{t.name}</p>
                  {t.role && <p className="text-xs text-stone-400">{t.role}</p>}
                  <div className="flex mt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? 'text-amber-400 fill-amber-400' : 'text-stone-200'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleTestimonial(t.id, t.active)}
                    className={`text-xs px-2 py-1 rounded ${t.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}
                  >
                    {t.active ? 'Aprovado' : 'Pendente'}
                  </button>
                  <button onClick={() => deleteTestimonial(t.id)} className="p-1.5 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-stone-600 leading-relaxed line-clamp-3">{t.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
