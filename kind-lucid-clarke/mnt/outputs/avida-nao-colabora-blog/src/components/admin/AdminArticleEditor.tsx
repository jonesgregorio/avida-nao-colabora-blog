import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, Eye, Calendar } from 'lucide-react'

interface ArticleData {
  title: string
  slug: string
  status: string
  category: string
  content: string
  summary: string
  cover_image_url: string
  seo_title: string
  seo_description: string
  diary_question: string
  cta_text: string
  cta_link: string
  plan_required: string
  published_at: string
  scheduled_at: string
  reading_time_minutes: number
}

const EMPTY: ArticleData = {
  title: '', slug: '', status: 'draft', category: '',
  content: '', summary: '', cover_image_url: '',
  seo_title: '', seo_description: '',
  diary_question: '', cta_text: '', cta_link: '',
  plan_required: 'free', published_at: '', scheduled_at: '',
  reading_time_minutes: 5,
}

interface Props {
  articleId: string | null
  onBack: () => void
}

export default function AdminArticleEditor({ articleId, onBack }: Props) {
  const [data, setData] = useState<ArticleData>(EMPTY)
  const [loading, setLoading] = useState(!!articleId)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!articleId) return
    supabase.from('articles').select('*').eq('id', articleId).single().then(({ data: a }) => {
      if (a) setData({ ...EMPTY, ...a })
      setLoading(false)
    })
  }, [articleId])

  function set(key: keyof ArticleData, value: any) {
    setData(d => ({ ...d, [key]: value }))
    if (key === 'title' && !articleId) {
      setData(d => ({
        ...d,
        title: value,
        slug: value.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .trim().replace(/\s+/g, '-'),
      }))
    }
  }

  async function save(status?: string) {
    setSaving(true)
    const payload = { ...data, status: status || data.status }
    if (status === 'published' && !payload.published_at) {
      payload.published_at = new Date().toISOString()
    }
    try {
      if (articleId) {
        await supabase.from('articles').update(payload).eq('id', articleId)
      } else {
        await supabase.from('articles').insert(payload)
      }
      showToast('Salvo com sucesso!')
      if (status) setData(d => ({ ...d, status }))
    } catch (e: any) {
      showToast('Erro ao salvar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  if (loading) return <p className="text-stone-400 text-sm">Carregando artigo...</p>

  return (
    <div className="max-w-4xl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-stone-800 flex-1">
          {articleId ? 'Editar artigo' : 'Novo artigo'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => save('draft')}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-50"
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
        {/* Main fields */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Conteúdo</h2>
            <Field label="Título">
              <input
                value={data.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Título do artigo"
                className={inputCls}
              />
            </Field>
            <Field label="Slug">
              <input
                value={data.slug}
                onChange={e => set('slug', e.target.value)}
                placeholder="slug-do-artigo"
                className={inputCls}
              />
            </Field>
            <Field label="Resumo">
              <textarea
                value={data.summary}
                onChange={e => set('summary', e.target.value)}
                rows={2}
                placeholder="Resumo exibido na listagem de artigos"
                className={inputCls}
              />
            </Field>
            <Field label="Conteúdo (Markdown ou HTML)">
              <textarea
                value={data.content}
                onChange={e => set('content', e.target.value)}
                rows={16}
                placeholder="Conteúdo completo do artigo..."
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
            <Field label="Pergunta para o diário">
              <input
                value={data.diary_question}
                onChange={e => set('diary_question', e.target.value)}
                placeholder="Ex: O que esse texto te fez sentir?"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">SEO</h2>
            <Field label="Título SEO">
              <input value={data.seo_title} onChange={e => set('seo_title', e.target.value)} placeholder="Título para mecanismos de busca" className={inputCls} />
            </Field>
            <Field label="Descrição SEO">
              <textarea value={data.seo_description} onChange={e => set('seo_description', e.target.value)} rows={2} placeholder="Descrição para mecanismos de busca (até 160 caracteres)" className={inputCls} />
              <p className="text-xs text-stone-400 mt-1">{data.seo_description.length}/160 caracteres</p>
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">CTA</h2>
            <Field label="Texto do CTA">
              <input value={data.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Ex: Abra seu diário agora" className={inputCls} />
            </Field>
            <Field label="Link do CTA">
              <input value={data.cta_link} onChange={e => set('cta_link', e.target.value)} placeholder="Ex: diary" className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
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
              <input value={data.category} onChange={e => set('category', e.target.value)} placeholder="Ex: ansiedade" className={inputCls} />
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
              <input type="number" value={data.reading_time_minutes} onChange={e => set('reading_time_minutes', Number(e.target.value))} className={inputCls} min={1} />
            </Field>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Imagem de capa</h2>
            <Field label="URL da imagem">
              <input value={data.cover_image_url} onChange={e => set('cover_image_url', e.target.value)} placeholder="https://..." className={inputCls} />
            </Field>
            {data.cover_image_url && (
              <img src={data.cover_image_url} alt="Capa" className="w-full h-32 object-cover rounded-lg border border-stone-200" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300 bg-white"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}
