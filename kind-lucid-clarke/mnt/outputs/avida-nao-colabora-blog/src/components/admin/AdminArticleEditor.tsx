import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, Eye, Send, Sparkles } from 'lucide-react'
import AIContentAssistant, { type AIContentType } from './AIContentAssistant'
import CoverImageInput from './CoverImageInput'
import ArticlePreview from './ArticlePreview'
import FormattedTextarea from './FormattedTextarea'

interface ArticleData {
  title: string
  slug: string
  status: string
  content_type: string
  category: string
  content: string
  summary: string
  image_url: string
  image_alt: string
  seo_title: string
  seo_description: string
  keyword: string
  secondary_keywords: string
  tags: string
  emotion: string
  journey_stage: string
  intent: string
  audience: string
  og_image: string
  origin: string
  internal_notes: string
  diary_question: string
  cta_text: string
  cta_link: string
  plan_required: string
  published_at: string
  scheduled_at: string
  read_time: number
  // Recomendação de conteúdo guiado (086) — campos separados por vírgula na UI.
  keywords: string
  emotional_themes: string
  estimated_time_minutes: number | ''
  is_guided_content: boolean
  is_recommendable: boolean
}

const EMPTY: ArticleData = {
  title: '', slug: '', status: 'draft', content_type: 'article', category: '',
  content: '', summary: '', image_url: '', image_alt: '',
  seo_title: '', seo_description: '',
  keyword: '', secondary_keywords: '', tags: '', emotion: '', journey_stage: '',
  intent: '', audience: '', og_image: '', origin: 'manual', internal_notes: '',
  diary_question: '', cta_text: '', cta_link: '',
  plan_required: 'free', published_at: '', scheduled_at: '',
  read_time: 5,
  keywords: '', emotional_themes: '', estimated_time_minutes: '',
  is_guided_content: true, is_recommendable: true,
}

// "a, b, c" ↔ ['a','b','c'] — colunas TEXT[] no banco, string na UI.
function toArray(s: string): string[] {
  return s.split(/[,\n]/).map(t => t.trim()).filter(Boolean)
}
function fromArray(v: unknown): string {
  return Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v : '')
}

interface Props {
  articleId: string | null
  onBack: () => void
}

interface ArticleVersion {
  id: string
  version: number
  change_note: string | null
  source: string
  created_at: string
  snapshot: Record<string, unknown>
}

export default function AdminArticleEditor({ articleId, onBack }: Props) {
  const [data, setData] = useState<ArticleData>(EMPTY)
  const [loading, setLoading] = useState(!!articleId)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [aiModal, setAiModal] = useState<{ type: AIContentType; label?: string } | null>(null)
  const [versions, setVersions] = useState<ArticleVersion[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)

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
          content_type: a.content_type || 'article',
          category: a.category || '',
          content: a.content || '',
          summary: a.summary || a.excerpt || '',
          image_url: a.image_url || a.cover_image || a.cover_image_url || '',
          image_alt: a.image_alt || '',
          seo_title: a.seo_title || '',
          seo_description: a.seo_description || '',
          keyword: a.keyword || '',
          secondary_keywords: a.secondary_keywords || '',
          tags: fromArray(a.tags),
          emotion: a.emotion || '',
          journey_stage: a.journey_stage || '',
          intent: a.intent || '',
          audience: a.audience || '',
          og_image: a.og_image || '',
          origin: a.origin || 'manual',
          internal_notes: a.internal_notes || '',
          diary_question: a.diary_question || '',
          cta_text: a.cta_text || '',
          cta_link: a.cta_link || '',
          plan_required: a.plan_required || 'free',
          published_at: a.published_at ? a.published_at.slice(0, 16) : '',
          scheduled_at: a.scheduled_at ? a.scheduled_at.slice(0, 16) : '',
          read_time: a.read_time || a.reading_time_minutes || 5,
          keywords: fromArray(a.keywords),
          emotional_themes: fromArray(a.emotional_themes),
          estimated_time_minutes: (a.estimated_time_minutes ?? '') as number | '',
          is_guided_content: a.is_guided_content ?? true,
          is_recommendable: a.is_recommendable ?? true,
        })
      }
      setLoading(false)
    })
  }, [articleId])

  useEffect(() => {
    if (!articleId) { setVersions([]); return }
    supabase.from('content_versions')
      .select('id, version, change_note, source, created_at, snapshot')
      .eq('article_id', articleId)
      .order('version', { ascending: false })
      .limit(20)
      .then(({ data }) => setVersions((data as ArticleVersion[]) ?? []), () => { /* tabela ainda não migrada */ })
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
    // Checklist: bloqueia publicação se faltar item crítico.
    if ((status || data.status) === 'published' && missingCritical.length > 0) {
      showToast('Não dá para publicar: falta ' + missingCritical.map(c => c.label).join(', '), true)
      return
    }
    setSaving(true)

    const targetStatus = status || data.status
    const payload: Record<string, unknown> = {
      title: data.title,
      slug: data.slug,
      status: targetStatus,
      content_type: data.content_type,
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
      keyword: data.keyword,
      secondary_keywords: data.secondary_keywords,
      // Colunas TEXT[] (086): sempre array, nunca string.
      tags: toArray(data.tags),
      keywords: toArray(data.keywords),
      emotional_themes: toArray(data.emotional_themes),
      estimated_time_minutes: data.estimated_time_minutes === '' ? null : Number(data.estimated_time_minutes),
      is_guided_content: data.is_guided_content,
      is_recommendable: data.is_recommendable,
      emotion: data.emotion,
      journey_stage: data.journey_stage,
      intent: data.intent,
      audience: data.audience,
      og_image: data.og_image,
      origin: data.origin,
      internal_notes: data.internal_notes,
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

    // Salva; se a migration dos campos novos ainda não aplicou, faz fallback
    // gravando só o essencial (o editor não pode quebrar por causa do deploy).
    const EXTRA_KEYS = ['content_type', 'keyword', 'secondary_keywords', 'tags', 'emotion', 'journey_stage', 'intent', 'audience', 'og_image', 'origin', 'internal_notes', 'keywords', 'emotional_themes', 'estimated_time_minutes', 'is_guided_content', 'is_recommendable']
    const writeArticle = (p: Record<string, unknown>) =>
      articleId
        ? supabase.from('articles').update(p).eq('id', articleId)
        : supabase.from('articles').insert(p).select('id').single()

    let res = await writeArticle(payload)
    if (res.error && /column|schema cache|does not exist|PGRST204/i.test(res.error.message)) {
      const base: Record<string, unknown> = { ...payload }
      for (const k of EXTRA_KEYS) delete base[k]
      res = await writeArticle(base)
      if (!res.error) showToast('Salvo. Os campos editoriais serão gravados após a atualização do banco.')
    }
    const error: { message: string } | null = res.error
    const savedId: string | null = articleId ?? ((res.data as { id?: string } | null)?.id ?? null)

    if (error) {
      showToast('Erro ao salvar: ' + error.message, true)
      setSaving(false)
      return
    }

    // Snapshot de versão (best-effort — ignora se content_versions ainda não migrou)
    if (savedId) {
      try {
        const { data: last } = await supabase.from('content_versions')
          .select('version').eq('article_id', savedId)
          .order('version', { ascending: false }).limit(1).maybeSingle()
        const nextV = ((last as { version?: number } | null)?.version ?? 0) + 1
        await supabase.from('content_versions').insert({
          article_id: savedId, version: nextV, snapshot: payload,
          source: targetStatus === 'published' ? 'publish' : 'manual',
          change_note: `Salvo como ${targetStatus}`,
        })
        const { data: vs } = await supabase.from('content_versions')
          .select('id, version, change_note, source, created_at, snapshot')
          .eq('article_id', savedId).order('version', { ascending: false }).limit(20)
        setVersions((vs as ArticleVersion[]) ?? [])
      } catch { /* content_versions indisponível */ }
    }

    showToast('Salvo com sucesso!')
    if (status) setData(d => ({ ...d, status }))
    setSaving(false)
  }

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 4000)
  }

  function handleAIInsert(result: string) {
    if (!aiModal) return
    switch (aiModal.type) {
      case 'article':           set('content', result); set('origin', 'ia'); break
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

  // Checklist de publicação (críticos bloqueiam; opcionais afetam a pontuação).
  const checklist: { label: string; ok: boolean; critical: boolean }[] = [
    { label: 'Título', ok: !!data.title.trim(), critical: true },
    { label: 'Slug', ok: !!data.slug.trim(), critical: true },
    { label: 'Resumo', ok: !!data.summary.trim(), critical: true },
    { label: 'Conteúdo (≥ 300 caracteres)', ok: (data.content || '').trim().length >= 300, critical: true },
    { label: 'Categoria', ok: !!data.category.trim(), critical: true },
    { label: 'Plano definido', ok: !!data.plan_required, critical: true },
    { label: 'Imagem de capa', ok: !!data.image_url.trim(), critical: false },
    { label: 'Texto alternativo da imagem', ok: !!data.image_alt.trim(), critical: false },
    { label: 'SEO title', ok: !!data.seo_title.trim(), critical: false },
    { label: 'SEO description', ok: !!data.seo_description.trim(), critical: false },
    { label: 'Pergunta para o diário', ok: !!data.diary_question.trim(), critical: false },
    { label: 'CTA', ok: !!data.cta_text.trim(), critical: false },
  ]
  const missingCritical = checklist.filter(c => c.critical && !c.ok)
  const score = Math.round((checklist.filter(c => c.ok).length / checklist.length) * 100)

  function restoreVersion(v: ArticleVersion) {
    const s = v.snapshot
    const str = (k: string) => (typeof s[k] === 'string' ? (s[k] as string) : '')
    setData(d => ({
      ...d,
      title: str('title') || d.title,
      slug: str('slug') || d.slug,
      content: str('content'),
      summary: str('summary'),
      content_type: str('content_type') || 'article',
      category: str('category'),
      plan_required: str('plan_required') || 'free',
      image_url: str('image_url'),
      image_alt: str('image_alt'),
      seo_title: str('seo_title'),
      seo_description: str('seo_description'),
      diary_question: str('diary_question'),
      cta_text: str('cta_text'),
      cta_link: str('cta_link'),
    }))
    showToast(`Versão ${v.version} carregada no formulário. Revise e salve para confirmar.`)
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

      {previewOpen && (
        <ArticlePreview
          title={data.title}
          category={data.category}
          content={data.content}
          imageUrl={data.image_url}
          imageAlt={data.image_alt}
          readTime={data.read_time}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-stone-400 hover:text-stone-700">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-serif text-2xl text-forest-900 flex-1">
          {articleId ? 'Editar artigo' : 'Novo artigo'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-forest-700 text-forest-700 rounded-lg text-sm hover:bg-mint/40"
          >
            <Eye className="w-4 h-4" /> Visualizar
          </button>
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
            <Send className="w-4 h-4" /> Publicar
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
            <Field label="Conteúdo">
              <FormattedTextarea
                value={data.content}
                onChange={v => set('content', v)}
                rows={16}
                placeholder="Conteúdo completo do artigo…"
              />
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

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">SEO &amp; Editorial</h2>
            <Field label="SEO title (~60 caracteres)">
              <input value={data.seo_title} onChange={e => set('seo_title', e.target.value)} maxLength={70} placeholder="Título para mecanismos de busca" className={inputCls} />
            </Field>
            <Field label="SEO description (~155 caracteres)">
              <textarea value={data.seo_description} onChange={e => set('seo_description', e.target.value)} maxLength={180} rows={2} placeholder="Descrição para busca e compartilhamento" className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Palavra-chave principal">
                <input value={data.keyword} onChange={e => set('keyword', e.target.value)} placeholder="Ex: ansiedade no trabalho" className={inputCls} />
              </Field>
              <Field label="Palavras-chave secundárias">
                <input value={data.secondary_keywords} onChange={e => set('secondary_keywords', e.target.value)} placeholder="separadas por vírgula" className={inputCls} />
              </Field>
              <Field label="Tags">
                <input value={data.tags} onChange={e => set('tags', e.target.value)} placeholder="separadas por vírgula" className={inputCls} />
              </Field>
              <Field label="Emoção / dor principal">
                <input value={data.emotion} onChange={e => set('emotion', e.target.value)} placeholder="Ex: sobrecarga" className={inputCls} />
              </Field>
              <Field label="Etapa da jornada">
                <select value={data.journey_stage} onChange={e => set('journey_stage', e.target.value)} className={inputCls}>
                  <option value="">—</option>
                  <option value="descoberta">Descoberta</option>
                  <option value="consideracao">Consideração</option>
                  <option value="decisao">Decisão</option>
                </select>
              </Field>
              <Field label="Intenção do conteúdo">
                <input value={data.intent} onChange={e => set('intent', e.target.value)} placeholder="Ex: acolher / educar" className={inputCls} />
              </Field>
              <Field label="Público-alvo">
                <input value={data.audience} onChange={e => set('audience', e.target.value)} placeholder="Ex: adultos com rotina intensa" className={inputCls} />
              </Field>
              <Field label="Origem">
                <select value={data.origin} onChange={e => set('origin', e.target.value)} className={inputCls}>
                  <option value="manual">Manual</option>
                  <option value="ia">IA</option>
                </select>
              </Field>
            </div>
            <Field label="Imagem Open Graph (URL)">
              <input value={data.og_image} onChange={e => set('og_image', e.target.value)} placeholder="https://... (compartilhamento social)" className={inputCls} />
            </Field>
            <Field label="Notas internas (não aparecem no site)">
              <textarea value={data.internal_notes} onChange={e => set('internal_notes', e.target.value)} rows={2} placeholder="Anotações para a equipe" className={inputCls} />
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
            <Field label="Tipo de conteúdo">
              <select value={data.content_type} onChange={e => set('content_type', e.target.value)} className={inputCls}>
                <option value="article">Artigo</option>
                <option value="practice">Prática</option>
                <option value="meditation">Meditação</option>
              </select>
            </Field>
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
                <option value="plus">Plus</option>
              </select>
            </Field>
            <Field label="Tempo de leitura (min)">
              <input type="number" value={data.read_time} onChange={e => set('read_time', Number(e.target.value))} className={inputCls} min={1} />
            </Field>
          </div>

          {/* Recomendação (Conteúdos Guiados) — alimenta o motor de recomendação (086). */}
          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Recomendação (Conteúdos Guiados)</h2>
            <p className="text-xs text-stone-500 -mt-2">
              Estes campos ajudam o sistema a recomendar este conteúdo a partir do que o usuário
              escreve e marca no diário, check-in e questionários. Não aparecem para o leitor.
            </p>
            <Field label="Temas emocionais">
              <input
                value={data.emotional_themes}
                onChange={e => set('emotional_themes', e.target.value)}
                placeholder="ansiedade, sobrecarga, cansaco, sono..."
                className={inputCls}
              />
              <p className="text-[11px] text-stone-400 mt-1">
                Valores reconhecidos: ansiedade, sobrecarga, cansaco, autocobranca, autoestima, tristeza, irritacao, alimentacao, sono, rotina, limites, autocuidado.
              </p>
            </Field>
            <Field label="Tags temáticas">
              <input value={data.tags} onChange={e => set('tags', e.target.value)} placeholder="respiração, pausa, escrita guiada..." className={inputCls} />
            </Field>
            <Field label="Palavras-chave (o que o usuário costuma escrever)">
              <input value={data.keywords} onChange={e => set('keywords', e.target.value)} placeholder="coração acelerado, sem energia, não dou conta..." className={inputCls} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Tempo estimado (min)">
                <input
                  type="number" min={1}
                  value={data.estimated_time_minutes}
                  onChange={e => set('estimated_time_minutes', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Ex: 3"
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-stone-700 mt-6">
                <input type="checkbox" checked={data.is_guided_content} onChange={e => set('is_guided_content', e.target.checked)} className="accent-forest-600" />
                Aparece na biblioteca
              </label>
              <label className="flex items-center gap-2 text-sm text-stone-700 mt-6">
                <input type="checkbox" checked={data.is_recommendable} onChange={e => set('is_recommendable', e.target.checked)} className="accent-forest-600" />
                Pode ser recomendado
              </label>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-line p-5 space-y-4">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Imagem de capa</h2>
            <CoverImageInput
              url={data.image_url}
              alt={data.image_alt}
              onChangeUrl={u => set('image_url', u)}
              onChangeAlt={a => set('image_alt', a)}
            />
          </div>

          {/* Checklist de publicação + pontuação */}
          <div className="bg-white rounded-xl border border-line p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Pronto para publicar?</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${score >= 80 ? 'bg-green-100 text-green-700' : score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{score}%</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div className={`h-full ${score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${score}%` }} />
            </div>
            <ul className="space-y-1.5">
              {checklist.map(c => (
                <li key={c.label} className="flex items-center gap-2 text-xs">
                  <span className={c.ok ? 'text-green-600' : c.critical ? 'text-red-500' : 'text-stone-300'}>{c.ok ? '✓' : c.critical ? '✕' : '○'}</span>
                  <span className="text-stone-600">{c.label}{c.critical && !c.ok ? ' · obrigatório' : ''}</span>
                </li>
              ))}
            </ul>
            {missingCritical.length > 0 && (
              <p className="text-[11px] text-red-600">Publicação bloqueada até completar os itens obrigatórios.</p>
            )}
          </div>

          {/* Histórico de versões + rollback */}
          <div className="bg-white rounded-xl border border-line p-5 space-y-3">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Histórico de versões</h2>
            {versions.length === 0 ? (
              <p className="text-xs text-stone-400">As versões aparecem aqui a cada vez que você salva.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-auto">
                {versions.map(v => (
                  <li key={v.id} className="flex items-center justify-between gap-2 border border-line rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-forest-900">v{v.version} · {v.source}</p>
                      <p className="text-[11px] text-stone-400">{new Date(v.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <button onClick={() => restoreVersion(v)} className="text-[11px] text-forest-700 border border-line rounded-md px-2 py-1 hover:bg-stone-50 whitespace-nowrap">Restaurar</button>
                  </li>
                ))}
              </ul>
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
