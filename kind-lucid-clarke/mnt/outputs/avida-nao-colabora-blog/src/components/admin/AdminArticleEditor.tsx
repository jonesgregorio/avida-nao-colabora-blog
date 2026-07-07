import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, Eye, Sparkles } from 'lucide-react'
import AIContentAssistant, { type AIContentType } from './AIContentAssistant'

interface ArticleData {
  title: string
  slug: string
  status: string
  category: string
  content: string
  summary: string
  image_url: string
  image_alt: string
  seo_title: string
  seo_description: string
  diary_question: string
  cta_text: string
  cta_link: string
  plan_required: string
  published_at: string
  scheduled_at: string
  read_time: number
}

const EMPTY: ArticleData = {
  title: '', slug: '', status: 'draft', category: '',
  content: '', summary: '', image_url: '', image_alt: '',
  seo_title: '', seo_description: '',
  diary_question: '', cta_text: '', cta_link: '',
  plan_required: 'free', published_at: '', scheduled_at: '',
  read_time: 5,
}

interface Props {
  articleId: string | null
  onBack: () => void
}

export default function AdminArticleEditor({ articleId, onBack }: Props) {
  const [data, setData] = useState<ArticleData>(EMPTY)
  const [loading, setLoading] = useState(!!articleId)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [aiModal, setAiModal] = useState<{ type: AIContentType; label?: string } | null>(null)

  useEffect(() => {
    supabase.from('categories').select('name').eq('is_active', true).order('name').then(({ data: cats }) => {
      if (cats) setCategories(cats.map(c => c.name))
    })
  }, [])

  useEffect(() => {
    if (!articleId) return
    supabase.from('articles').select('*').eq('id', articleId).single().then(({ data: a, error }) => {
      if (error) { showToast('Erro ao carregar artigo: ' + error.message, true); setLoading(false); return }
      if (a) {
        setData({
          title: a.title || '',
          slug: a.slug || '',
          status: a.status || 'draft',
          category: a.category || '',
          content: a.content || '',
          summary: a.summary || a.excerpt || '',
          image_url: a.image_url || a.cover_image || a.cover_image_url || '',
          image_alt: a.image_alt || '',
          seo_title: a.seo_title || '',
          seo_description: a.seo_description || '',
          diary_question: a.diary_question || '',
          cta_text: a.cta_text || '',
          cta_link: a.cta_link || '',
          plan_required: a.plan_required || 'free',
          published_at: a.published_at ? a.published_at.slice(0, 16) : '',
          scheduled_at: a.scheduled_at ? a.scheduled_at.slice(0, 16) : '',
          read_time: a.read_time || a.reading_time_minutes || 5,
        })
      }
      setLoading(false)
    })
  }, [articleId])

  function set(key: keyof ArticleData, value: ArticleData[keyof ArticleData]) {
    setData(d => {
      const next = { ...d, [key]: value }
      if (key === 'title' && !articleId) {
        next.slug = (value as string).toLowerCase()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim().replace(/\s+/g, '-')
      }
      return next
    })
  }

  async function save(status?: string) {
    if (!data.title.trim()) { showToast('Título obrigatório', true); return }
    if (!data.slug.trim()) { showToast('Slug obrigatório', true); return }
    setSaving(true)

    const targetStatus = status || data.status
    const payload: Record<string, unknown> = {
      title: data.title,
      slug: data.slug,
      status: targetStatus,
      category: data.category,
      content: data.content,
      summary: data.summary,
      excerpt: data.summary,
      image_url: data.image_url,
      cover_image: data.image_url,
      cover_image_url: data.image_url,
      image_alt: data.image_alt,
      seo_title: data.seo_title,
      seo_description: data.seo_description,
      diary_question: data.diary_question,
      cta_text: data.cta_text,
      cta_link: data.cta_link,
      plan_required: data.plan_required,
      read_time: data.read_time,
      updated_at: new Date().toISOString(),
    }

    if (data.scheduled_at) payload.scheduled_at = new Date(data.scheduled_at).toISOString()
    if (targetStatus === 'published' && !data.published_at) {
      payload.published_at = new Date().toISOString()
    } else if (data.published_at) {
      payload.published_at = new Date(data.published_at).toISOString()
    }

    let error: { message: string } | null
    if (articleId) {
      const res = await supabase.from('articles').update(payload).eq('id', articleId)
      error = res.error
    } else {
      const res = await supabase.from('articles').insert(payload).select().single()
      error = res.error
    }

    if (error) {
      showToast('Erro ao salvar: ' + error.message, true)
    } else {
      showToast('Salvo com sucesso!')
      if (status) setData(d => ({ ...d, status }))
    }
    setSaving(false)
  }

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 4000)
  }

  function handleAIInsert(result: string) {
    if (!aiModal) return
    switch (aiModal.type) {
      case 'article':           set('content', result); break
      case 'article_title':     set('title', result); break
      case 'article_summary':   set('summary', result); break
      case 'article_seo': {
        // Tenta extrair campos do bloco SEO gerado
        const titleMatch = result.match(/META TITLE:\s*(.+)/i)
        const descMatch  = result.match(/META DESCRIPTION:\s*(.+)/i)
        if (titleMatch) set('seo_title', titleMatch[1].trim())
        if (descMatch)  set('seo_description', descMatch[1].trim())
        break
      }
      case 'article_diary_question': set('diary_question', result); break
      case 'article_cta':       set('cta_text', result); break
      case 'improve':
      case 'rewrite':           set('content', result); break
      default:                  set('content', result)
    }
  }

  if (loading) return <p className="text-stone-400 text-sm">Carregando artigo...</p>

  return (
    <div className="max-w-4xl">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>
          {toast.msg}
        </div>
      )}

      {aiModal && (
        <AIContentAssistant
          contentType={aiModal.type}
          label={aiModal.label}
          contextTitle={data.title}
          contextContent={data.content}
          contextCategory={data.category}
          defaultTheme={data.title}
          onInsert={handleAIInsert}
          onClose={() => setAiModal(null)}
        />
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-forest-900 flex-1">
          {articleId ? 'Editar artigo' : 'Novo artigo'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => save('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-line rounded-lg text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> Salvar rascunho
          </button>
          <button
            onClick={() => save('published')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
          >
            <Eye className="w-4 h-4" /> Publicar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Painel de IA */}
          <div className="bg-gradient-to-r from-mint to-stone-50 border border-forest-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-forest-700" />
              <span className="text-sm font-semibold text-forest-900">Assistente de IA</span>
              <span className="text-[10px] bg-mint text-forest-800 px-2 py-0.5 rounded-full">Gratuito · Sem chave</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                { type: 'article', label: 'Gerar artigo completo' },
                { type: 'article_title', label: 'Gerar título' },
                { type: 'article_summary', label: 'Gerar resumo' },
                { type: 'article_seo', label: 'Gerar SEO' },
                { type: 'article_diary_question', label: 'Pergunta para diário' },
                { type: 'article_cta', label: 'Gerar CTA' },
                { type: 'improve', label: 'Melhorar texto' },
                { type: 'rewrite', label: 'Reescrever acolhedor' },
              ] as { type: AIContentType; label: string }[]).map(btn => (
                <button
                  key={btn.type}
                  onClick={() => setAiModal(btn)}
                  className="text-xs bg-white border border-forest-200 text-forest-800 px-3 py-1.5 rounded-lg hover:bg-mint transition-colors font-medium"
                >
                  ✦ {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Conteúdo</h2>
            <Field label="Título">
              <input value={data.title} onChange={e => set('title', e.target.value)} placeholder="Título do artigo" className={inputCls} />
            </Field>
            <Field label="Slug">
              <input value={data.slug} onChange={e => set('slug', e.target.value)} placeholder="slug-do-artigo" className={inputCls} />
            </Field>
            <Field label="Resumo">
              <textarea value={data.summary} onChange={e => set('summary', e.target.value)} rows={2} placeholder="Resumo exibido na listagem de artigos" className={inputCls} />
            </Field>
            <Field label="Conteúdo (Markdown ou HTML)">
              <textarea value={data.content} onChange={e => set('content', e.target.value)} rows={16} placeholder="Conteúdo completo do artigo..." className={`${inputCls} font-mono text-xs`} />
            </Field>
            <Field label="Pergunta para o diário">
              <input value={data.diary_question} onChange={e => set('diary_question', e.target.value)} placeholder="Ex: O que esse texto te fez sentir?" className={inputCls} />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">SEO</h2>
            <Field label="Título SEO">
              <input value={data.seo_title} onChange={e => set('seo_title', e.target.value)} placeholder="Título para mecanismos de busca" className={inputCls} />
            </Field>
            <Field label="Descrição SEO">
              <textarea value={data.seo_description} onChange={e => set('seo_description', e.target.value)} rows={2} placeholder="Descrição para mecanismos de busca (até 160 caracteres)" className={inputCls} />
              <p className="text-xs text-stone-400 mt-1">{data.seo_description.length}/160 caracteres</p>
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">CTA</h2>
            <Field label="Texto do CTA">
              <input value={data.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Ex: Abra seu diário agora" className={inputCls} />
            </Field>
            <Field label="Link do CTA">
              <input value={data.cta_link} onChange={e => set('cta_link', e.target.value)} placeholder="Ex: diary" className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Publicação</h2>
            <Field label="Status">
              <select value={data.status} onChange={e => set('status', e.target.value)} className={inputCls}>
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
                <option value="scheduled">Agendado</option>
              </select>
            </Field>
            {data.status === 'scheduled' && (
              <Field label="Agendar para">
                <input type="datetime-local" value={data.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} className={inputCls} />
              </Field>
            )}
            <Field label="Categoria">
              {categories.length > 0 ? (
                <select value={data.category} onChange={e => set('category', e.target.value)} className={inputCls}>
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input value={data.category} onChange={e => set('category', e.target.value)} placeholder="Ex: ansiedade" className={inputCls} />
              )}
            </Field>
            <Field label="Plano requerido">
              <select value={data.plan_required} onChange={e => set('plan_required', e.target.value)} className={inputCls}>
                <option value="free">Gratuito</option>
                <option value="essential">Essencial</option>
                <option value="therapeutic">Terapêutico</option>
                <option value="therapeutic-plus">Terapêutico Plus</option>
              </select>
            </Field>
            <Field label="Tempo de leitura (min)">
              <input type="number" value={data.read_time} onChange={e => set('read_time', Number(e.target.value))} className={inputCls} min={1} />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Imagem de capa</h2>
            <Field label="URL da imagem">
              <input value={data.image_url} onChange={e => set('image_url', e.target.value)} placeholder="https://..." className={inputCls} />
            </Field>
            <Field label="Texto alternativo (alt)">
              <input value={data.image_alt} onChange={e => set('image_alt', e.target.value)} placeholder="Descrição da imagem" className={inputCls} />
            </Field>
            {data.image_url && (
              <img src={data.image_url} alt={data.image_alt || 'Capa'} className="w-full h-32 object-cover rounded-lg border border-line" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
