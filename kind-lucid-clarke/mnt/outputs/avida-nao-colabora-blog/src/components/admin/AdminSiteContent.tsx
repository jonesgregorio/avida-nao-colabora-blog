import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Save, History, Plus, Trash2, Eye, RotateCcw, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { renderArticleContent } from '../../lib/renderArticle'
import { refreshSiteContent } from '../../lib/siteContent'

// Editor do conteúdo institucional do site (migration 20260903120000):
// páginas longas (Sobre/Termos/Privacidade/Aviso), textos do Hero/Home e FAQ.
// Cada edição gera uma revisão; dá para restaurar versões anteriores.

type Section = 'paginas' | 'hero' | 'faq'

const PAGES = [
  { slug: 'sobre', name: 'Sobre nós' },
  { slug: 'termos', name: 'Termos de Uso' },
  { slug: 'privacidade', name: 'Política de Privacidade' },
  { slug: 'aviso-responsabilidade', name: 'Aviso de Responsabilidade' },
] as const

interface PageRow { slug: string; title: string; body_md: string; updated_at: string }
interface SnippetRow { key: string; label: string; value: string; updated_at: string }
interface FaqRow { id: string; category: string; question: string; answer: string; sort_order: number; is_active: boolean }
interface Revision { id: string; snapshot: Record<string, unknown>; created_at: string; note: string | null }

function Toast({ msg }: { msg: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-700">
      <Check className="h-3.5 w-3.5" /> {msg}
    </span>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Revisões ────────────────────────────────────────────────────────────────

function RevisionList({ refType, refId, onRestore }: { refType: string; refId: string; onRestore: (snap: Record<string, unknown>) => void }) {
  const [rows, setRows] = useState<Revision[] | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('site_content_revisions')
      .select('id,snapshot,created_at,note')
      .eq('ref_type', refType).eq('ref_id', refId)
      .order('created_at', { ascending: false }).limit(20)
    setRows((data ?? []) as Revision[])
  }, [refType, refId])

  useEffect(() => { if (open) void load() }, [open, load])

  return (
    <div className="mt-3">
      <button onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-soft hover:text-forest-800">
        <History className="h-3.5 w-3.5" /> {open ? 'Ocultar histórico' : 'Histórico de versões'}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-line bg-paper/50 p-2 text-xs">
          {rows === null ? <p className="p-2 text-ink-soft">Carregando…</p>
            : rows.length === 0 ? <p className="p-2 text-ink-soft">Nenhuma versão anterior ainda.</p>
            : (
              <ul className="divide-y divide-line/60">
                {rows.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-2 px-1 py-1.5">
                    <span className="text-ink-soft">{fmt(r.created_at)}</span>
                    <button
                      onClick={() => { if (confirm('Restaurar esta versão? O texto atual vira uma nova entrada no histórico.')) onRestore(r.snapshot) }}
                      className="inline-flex items-center gap-1 rounded border border-line bg-white px-2 py-0.5 font-medium text-forest-800 hover:border-forest-300"
                    >
                      <RotateCcw className="h-3 w-3" /> restaurar
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
      )}
    </div>
  )
}

// ─── Páginas longas ──────────────────────────────────────────────────────────

function PagesEditor() {
  const [slug, setSlug] = useState<string>(PAGES[0].slug)
  const [row, setRow] = useState<PageRow | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState('')
  const [preview, setPreview] = useState(false)

  const load = useCallback(async () => {
    setErr('')
    const { data, error } = await supabase.from('site_pages').select('slug,title,body_md,updated_at').eq('slug', slug).maybeSingle()
    if (error) { setErr(error.message); return }
    const r = (data ?? { slug, title: '', body_md: '', updated_at: '' }) as PageRow
    setRow(r); setTitle(r.title); setBody(r.body_md)
  }, [slug])
  useEffect(() => { void load() }, [load])

  const dirty = row ? (title !== row.title || body !== row.body_md) : false

  async function save() {
    setBusy(true); setErr(''); setSaved(false)
    const { error } = await supabase.from('site_pages').upsert({ slug, title, body_md: body }, { onConflict: 'slug' })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    await refreshSiteContent()
    await load()
  }

  function restore(snap: Record<string, unknown>) {
    setTitle(String(snap.title ?? ''))
    setBody(String(snap.body_md ?? ''))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {PAGES.map(p => (
          <button
            key={p.slug}
            onClick={() => setSlug(p.slug)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              slug === p.slug ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Título da página</label>
        <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300" />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Texto (usa a formatação do blog: <code>## título</code>, <code>**negrito**</code>, listas com <code>-</code>)</label>
          <button onClick={() => setPreview(p => !p)} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-forest-800">
            <Eye className="h-3.5 w-3.5" /> {preview ? 'editar' : 'pré-visualizar'}
          </button>
        </div>
        {preview ? (
          <div className="min-h-[16rem] rounded-lg border border-line bg-white p-4 text-sm leading-relaxed text-ink-soft">
            {renderArticleContent(body)}
          </div>
        ) : (
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={18} className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2.5 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-forest-300" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar página
        </button>
        {saved && <Toast msg="Salvo — o site já está usando esta versão" />}
        {err && <span className="text-xs text-red-600">{err}</span>}
        {row?.updated_at && <span className="text-xs text-stone-400">última alteração {fmt(row.updated_at)}</span>}
      </div>

      <RevisionList refType="page" refId={slug} onRestore={restore} />
    </div>
  )
}

// ─── Hero / Home ─────────────────────────────────────────────────────────────

function SnippetsEditor() {
  const [rows, setRows] = useState<SnippetRow[] | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('site_snippets').select('key,label,value,updated_at').order('key')
    if (error) { setErr(error.message); return }
    setRows((data ?? []) as SnippetRow[])
  }, [])
  useEffect(() => { void load() }, [load])

  async function save(key: string) {
    const value = draft[key]
    if (value === undefined) return
    setSavingKey(key); setErr('')
    const { error } = await supabase.from('site_snippets').update({ value }).eq('key', key)
    setSavingKey(null)
    if (error) { setErr(error.message); return }
    setSavedKey(key); setTimeout(() => setSavedKey(k => (k === key ? null : k)), 2000)
    await refreshSiteContent(); await load()
    setDraft(d => { const c = { ...d }; delete c[key]; return c })
  }

  if (rows === null) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-forest-500" /></div>

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">Textos curtos do topo do site. Alterou, salvou, já aparece.</p>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {rows.map(s => {
        const val = draft[s.key] ?? s.value
        const dirty = draft[s.key] !== undefined && draft[s.key] !== s.value
        return (
          <div key={s.key} className="rounded-lg border border-line bg-white p-3">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{s.label}</label>
            <textarea
              value={val}
              onChange={e => setDraft(d => ({ ...d, [s.key]: e.target.value }))}
              rows={val.length > 90 ? 3 : 1}
              className="w-full resize-y rounded-lg border border-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={() => save(s.key)} disabled={!dirty || savingKey === s.key} className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40">
                {savingKey === s.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} salvar
              </button>
              {savedKey === s.key && <Toast msg="salvo" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FaqEditor() {
  const [rows, setRows] = useState<FaqRow[] | null>(null)
  const [draft, setDraft] = useState<Record<string, Partial<FaqRow>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('faq_items').select('id,category,question,answer,sort_order,is_active').order('sort_order')
    if (error) { setErr(error.message); return }
    setRows((data ?? []) as FaqRow[])
  }, [])
  useEffect(() => { void load() }, [load])

  const categories = useMemo(() => [...new Set((rows ?? []).map(r => r.category))], [rows])

  function patch(id: string, p: Partial<FaqRow>) {
    setDraft(d => ({ ...d, [id]: { ...d[id], ...p } }))
  }

  async function save(row: FaqRow) {
    const d = draft[row.id] ?? {}
    setBusyId(row.id); setErr('')
    const { error } = await supabase.from('faq_items').update({
      category: d.category ?? row.category,
      question: d.question ?? row.question,
      answer: d.answer ?? row.answer,
      sort_order: d.sort_order ?? row.sort_order,
      is_active: d.is_active ?? row.is_active,
    }).eq('id', row.id)
    setBusyId(null)
    if (error) { setErr(error.message); return }
    setSavedId(row.id); setTimeout(() => setSavedId(s => (s === row.id ? null : s)), 2000)
    setDraft(dd => { const c = { ...dd }; delete c[row.id]; return c })
    await refreshSiteContent(); await load()
  }

  async function add() {
    const maxSort = Math.max(0, ...(rows ?? []).map(r => r.sort_order))
    setBusyId('new'); setErr('')
    const { error } = await supabase.from('faq_items').insert({
      category: categories[0] ?? 'Geral', question: 'Nova pergunta', answer: 'Resposta…', sort_order: maxSort + 10, is_active: false,
    })
    setBusyId(null)
    if (error) { setErr(error.message); return }
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta pergunta? Não gera histórico.')) return
    setBusyId(id)
    const { error } = await supabase.from('faq_items').delete().eq('id', id)
    setBusyId(null)
    if (error) { setErr(error.message); return }
    await refreshSiteContent(); await load()
  }

  if (rows === null) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-forest-500" /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft">Perguntas desativadas não aparecem no site. Ordem = número menor primeiro.</p>
        <button onClick={add} disabled={busyId === 'new'} className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40">
          {busyId === 'new' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} nova pergunta
        </button>
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      {rows.map(row => {
        const d = draft[row.id] ?? {}
        const dirty = Object.keys(d).length > 0
        return (
          <div key={row.id} className={`rounded-lg border p-3 ${row.is_active ? 'border-line bg-white' : 'border-line bg-paper/40'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={d.category ?? row.category}
                onChange={e => patch(row.id, { category: e.target.value })}
                list="faq-cats"
                className="w-40 rounded border border-line bg-paper px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-forest-300"
                placeholder="Categoria"
              />
              <input
                type="number"
                value={d.sort_order ?? row.sort_order}
                onChange={e => patch(row.id, { sort_order: parseInt(e.target.value, 10) || 0 })}
                className="w-16 rounded border border-line bg-paper px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-forest-300"
              />
              <label className="inline-flex items-center gap-1.5 text-xs text-ink">
                <input type="checkbox" checked={d.is_active ?? row.is_active} onChange={e => patch(row.id, { is_active: e.target.checked })} className="h-3.5 w-3.5 rounded border-stone-300 text-forest-700" />
                ativa
              </label>
              <button onClick={() => remove(row.id)} disabled={busyId === row.id} className="ml-auto text-ink-soft hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <input
              value={d.question ?? row.question}
              onChange={e => patch(row.id, { question: e.target.value })}
              className="mt-2 w-full rounded border border-line bg-paper px-2.5 py-1.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-forest-300"
              placeholder="Pergunta"
            />
            <textarea
              value={d.answer ?? row.answer}
              onChange={e => patch(row.id, { answer: e.target.value })}
              rows={3}
              className="mt-1.5 w-full resize-y rounded border border-line bg-paper px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-forest-300"
              placeholder="Resposta"
            />
            <div className="mt-1.5 flex items-center gap-3">
              <button onClick={() => save(row)} disabled={!dirty || busyId === row.id} className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40">
                {busyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} salvar
              </button>
              {savedId === row.id && <Toast msg="salvo" />}
            </div>
          </div>
        )
      })}
      <datalist id="faq-cats">{categories.map(c => <option key={c} value={c} />)}</datalist>
    </div>
  )
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export default function AdminSiteContent() {
  const [section, setSection] = useState<Section>('paginas')

  return (
    <div className="max-w-4xl">
      <h2 className="font-serif text-2xl text-forest-900">Site &amp; páginas</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Edita o texto das páginas institucionais, do topo do site e da central de ajuda — sem precisar de deploy.
        Cada alteração fica registrada e pode ser revertida.
      </p>

      <div className="mt-5 flex flex-wrap gap-1 border-b border-line">
        {([
          ['paginas', 'Páginas (Sobre, Termos, Privacidade, Aviso)'],
          ['hero', 'Hero / Home'],
          ['faq', 'Perguntas frequentes'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              section === id ? 'border-forest-600 text-forest-900' : 'border-transparent text-ink-soft hover:text-forest-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {section === 'paginas' && <PagesEditor />}
        {section === 'hero' && <SnippetsEditor />}
        {section === 'faq' && <FaqEditor />}
      </div>
    </div>
  )
}
