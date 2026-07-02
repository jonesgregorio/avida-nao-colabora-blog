import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, ArrowLeft, Save, BookOpen, GripVertical, Sparkles } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'

interface Trail {
  id: string
  title: string
  description: string
  plan_required: string
  is_active: boolean
  active: boolean
  created_at: string
}

interface TrailArticle {
  id: string
  trail_id: string
  article_id: string
  order_index: number
  article?: { title: string; slug: string }
}

type Screen = 'list' | 'edit'

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminTrails() {
  const [trails, setTrails] = useState<Trail[]>([])
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>('list')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [planRequired, setPlanRequired] = useState('free')
  const [active, setActive] = useState(true)
  const [showAI, setShowAI] = useState(false)
  const [trailArticles, setTrailArticles] = useState<TrailArticle[]>([])
  const [allArticles, setAllArticles] = useState<{ id: string; title: string; slug: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  async function loadTrails() {
    setLoading(true)
    const { data, error } = await supabase.from('trails').select('*').order('created_at', { ascending: false })
    if (error) showToast('Erro ao carregar trilhas: ' + error.message, true)
    setTrails(data || [])
    setLoading(false)
  }

  async function loadAllArticles() {
    const { data } = await supabase.from('articles').select('id, title, slug').eq('status', 'published').order('title')
    setAllArticles(data || [])
  }

  useEffect(() => { loadTrails(); loadAllArticles() }, // eslint-disable-next-line react-hooks/exhaustive-deps
  [])

  function openNew() {
    setEditingId(null); setTitle(''); setDescription('')
    setPlanRequired('free'); setActive(true); setTrailArticles([])
    setScreen('edit')
  }

  async function openEdit(trail: Trail) {
    setEditingId(trail.id); setTitle(trail.title); setDescription(trail.description)
    setPlanRequired(trail.plan_required); setActive(trail.is_active ?? trail.active ?? true)
    const { data, error } = await supabase
      .from('trail_articles')
      .select('*, article:articles(title, slug)')
      .eq('trail_id', trail.id)
      .order('order_index')
    if (error) showToast('Erro ao carregar artigos da trilha: ' + error.message, true)
    setTrailArticles(data || [])
    setScreen('edit')
  }

  async function save() {
    if (!title.trim()) { showToast('Título obrigatório', true); return }
    setSaving(true)

    let trailId = editingId
    if (editingId) {
      const { error } = await supabase.from('trails').update({
        title, description,
        plan_required: planRequired,
        is_active: active,
        active,
      }).eq('id', editingId)
      if (error) { showToast('Erro ao salvar trilha: ' + error.message, true); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('trails').insert({
        title, description,
        plan_required: planRequired,
        is_active: active,
        active,
      }).select().single()
      if (error) { showToast('Erro ao criar trilha: ' + error.message, true); setSaving(false); return }
      trailId = data?.id
    }

    if (trailId) {
      await supabase.from('trail_articles').delete().eq('trail_id', trailId)
      if (trailArticles.length > 0) {
        const { error: insertError } = await supabase.from('trail_articles').insert(
          trailArticles.map((ta, i) => ({
            trail_id: trailId,
            article_id: ta.article_id,
            order_index: i + 1,
            position: i + 1,
          }))
        )
        if (insertError) { showToast('Aviso: trilha salva, mas erro ao salvar artigos: ' + insertError.message, true); setSaving(false); return }
      }
    }

    showToast('Trilha salva!')
    setSaving(false)
    loadTrails()
    setScreen('list')
  }

  async function deleteTrail(id: string) {
    if (!confirm('Excluir esta trilha?')) return
    await supabase.from('trail_articles').delete().eq('trail_id', id)
    const { error } = await supabase.from('trails').delete().eq('id', id)
    if (error) showToast('Erro ao excluir: ' + error.message, true)
    else loadTrails()
  }

  function addArticle(articleId: string) {
    const article = allArticles.find(a => a.id === articleId)
    if (!article || trailArticles.find(ta => ta.article_id === articleId)) return
    setTrailArticles(ts => [...ts, {
      id: `new-${Date.now()}`, trail_id: editingId || '', article_id: articleId,
      order_index: ts.length + 1, article: { title: article.title, slug: article.slug },
    }])
  }

  function removeArticle(articleId: string) {
    setTrailArticles(ts => ts.filter(ta => ta.article_id !== articleId))
  }

  const availableArticles = allArticles.filter(a => !trailArticles.find(ta => ta.article_id === a.id))

  if (screen === 'edit') {
    return (
      <div className="max-w-3xl">
        {toast && (
          <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
            {toast.msg}
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setScreen('list')} className="text-stone-400 hover:text-stone-700">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-stone-800 flex-1">{editingId ? 'Editar trilha' : 'Nova trilha'}</h1>
          <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Informações</h2>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Título</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Ansiedade no Dia a Dia" className={inputCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-stone-500">Descrição</label>
                  <button
                    type="button"
                    onClick={() => setShowAI(true)}
                    className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 transition-colors font-medium"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar com IA
                  </button>
                </div>
                {showAI && (
                  <AIContentAssistant
                    contentType="trail"
                    defaultTheme={title}
                    label="Gerar estrutura da trilha com IA"
                    onInsert={result => { setDescription(result); setShowAI(false) }}
                    onClose={() => setShowAI(false)}
                  />
                )}
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descreva o objetivo desta trilha..." className={inputCls} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-stone-200 p-5">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Artigos da trilha ({trailArticles.length})</h2>

              {trailArticles.length > 0 && (
                <div className="space-y-2 mb-4">
                  {trailArticles.map((ta, i) => (
                    <div key={ta.article_id} className="flex items-center gap-3 bg-stone-50 rounded-lg px-3 py-2">
                      <GripVertical className="w-4 h-4 text-stone-300 flex-shrink-0" />
                      <span className="text-xs text-stone-400 w-5">{i + 1}.</span>
                      <span className="flex-1 text-sm text-stone-700 truncate">{ta.article?.title}</span>
                      <button onClick={() => removeArticle(ta.article_id)} className="text-stone-300 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {availableArticles.length > 0 && (
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Adicionar artigo</label>
                  <select
                    onChange={e => { if (e.target.value) { addArticle(e.target.value); e.target.value = '' } }}
                    className={inputCls}
                    defaultValue=""
                  >
                    <option value="" disabled>Selecione um artigo...</option>
                    {availableArticles.map(a => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {trailArticles.length === 0 && availableArticles.length === 0 && (
                <p className="text-sm text-stone-400">Nenhum artigo publicado disponível. Publique artigos primeiro.</p>
              )}
              {trailArticles.length === 0 && availableArticles.length > 0 && (
                <p className="text-sm text-stone-400">Nenhum artigo adicionado ainda.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Configurações</h2>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Plano necessário</label>
                <select value={planRequired} onChange={e => setPlanRequired(e.target.value)} className={inputCls}>
                  <option value="free">Gratuito</option>
                  <option value="essential">Essencial</option>
                  <option value="therapeutic">Terapêutico</option>
                  <option value="therapeutic-plus">Terapêutico Plus</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-emerald-600" />
                Trilha ativa (visível no site)
              </label>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Trilhas</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700">
          <Plus className="w-4 h-4" /> Nova trilha
        </button>
      </div>

      {loading ? (
        <p className="text-stone-400 text-sm">Carregando...</p>
      ) : trails.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma trilha criada ainda.</p>
          <button onClick={openNew} className="mt-3 text-sm text-emerald-600 hover:underline">Criar primeira trilha</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {trails.map(trail => (
            <div key={trail.id} className="bg-white rounded-xl border border-stone-200 p-5">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-stone-800 leading-snug">{trail.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${(trail.is_active ?? trail.active) ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
                  {(trail.is_active ?? trail.active) ? 'Ativa' : 'Inativa'}
                </span>
              </div>
              <p className="text-xs text-stone-500 mb-3 line-clamp-2">{trail.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-stone-400 capitalize">{trail.plan_required}</span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(trail)} className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTrail(trail.id)} className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
