import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { callAI, type AITone, type AISize } from '../../lib/aiContent'
import { Sparkles, Loader2, Save, Layers, FileText } from 'lucide-react'

interface Template { id: string; template_key: string; name: string; content_type: string; prompt: string }

const PLANS = [['free', 'Gratuito'], ['essential', 'Essencial'], ['plus', 'Plus']] as const
const TYPES = [['article', 'Artigo'], ['practice', 'Prática'], ['meditation', 'Meditação']] as const
const TONES: AITone[] = ['acolhedor', 'simples', 'leve', 'educativo', 'motivacional', 'direto']
const SIZES: AISize[] = ['curto', 'médio', 'longo']
const EXTRA_KEYS = ['content_type', 'keyword', 'origin']

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 72)
}
function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

// Insere um rascunho de artigo, tolerante a colunas novas ainda não migradas.
async function insertDraft(row: Record<string, unknown>) {
  let res = await supabase.from('articles').insert(row).select('id').single()
  if (res.error && /column|schema cache|does not exist|PGRST204/i.test(res.error.message)) {
    const base = { ...row }; for (const k of EXTRA_KEYS) delete base[k]
    res = await supabase.from('articles').insert(base).select('id').single()
  }
  return res
}

export default function AdminFabricaIA() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [mode, setMode] = useState<'single' | 'mass'>('single')
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  function flash(msg: string, err = false) { setToast({ msg, err }); setTimeout(() => setToast(null), 4000) }

  // Single
  const [tpl, setTpl] = useState('')
  const [tema, setTema] = useState('')
  const [categoria, setCategoria] = useState('')
  const [plano, setPlano] = useState('free')
  const [tipo, setTipo] = useState('article')
  const [tom, setTom] = useState<AITone>('acolhedor')
  const [tamanho, setTamanho] = useState<AISize>('médio')
  const [keyword, setKeyword] = useState('')
  const [publico, setPublico] = useState('')
  const [titulo, setTitulo] = useState('')
  const [resultado, setResultado] = useState('')
  const [gerando, setGerando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // Mass
  const [massTemas, setMassTemas] = useState('')
  const [massPlano, setMassPlano] = useState('free')
  const [massTipo, setMassTipo] = useState('article')
  const [massBusy, setMassBusy] = useState(false)
  const [massProg, setMassProg] = useState('')

  useEffect(() => {
    supabase.from('ai_prompt_templates').select('id, template_key, name, content_type, prompt').eq('is_active', true).order('template_key')
      .then(({ data }) => setTemplates((data as Template[]) ?? []), () => setTemplates([]))
  }, [])

  function buildPrompt() {
    const vars = { tema, categoria, tom, palavra_chave: keyword, publico, titulo: titulo || tema }
    const t = templates.find(x => x.id === tpl)
    if (t) return fill(t.prompt, vars)
    return `Escreva um conteúdo do tipo "${tipo}" sobre "${tema}" (categoria ${categoria || 'saúde emocional'}). Tom ${tom}. Público ${publico || 'geral'}. Palavra-chave: ${keyword}. Português brasileiro, acolhedor, sem diagnóstico nem promessa de cura. Inclua uma pergunta para o diário e um CTA gentil ao final.`
  }

  async function gerar() {
    if (!tema.trim()) { flash('Informe um tema.', true); return }
    setGerando(true); setResultado('')
    try {
      const out = await callAI(buildPrompt(), { tone: tom, size: tamanho })
      setResultado(out)
      if (!titulo.trim()) setTitulo(tema)
    } catch (e) { flash('Falha ao gerar: ' + (e instanceof Error ? e.message : String(e)), true) }
    setGerando(false)
  }

  async function salvarRascunho() {
    if (!resultado.trim() || !titulo.trim()) { flash('Gere o conteúdo e informe um título.', true); return }
    setSalvando(true)
    const { error } = await insertDraft({
      title: titulo, slug: `${slugify(titulo)}-${Date.now().toString(36).slice(-4)}`,
      content: resultado, summary: '', excerpt: '', category: categoria,
      plan_required: plano, content_type: tipo, status: 'draft', origin: 'ia', keyword,
      updated_at: new Date().toISOString(),
    })
    setSalvando(false)
    if (error) { flash('Erro ao salvar: ' + error.message, true); return }
    flash('Rascunho criado! Encontre em Conteúdos → ' + (tipo === 'practice' ? 'Práticas' : tipo === 'meditation' ? 'Meditações' : 'Artigos') + '.')
    setResultado(''); setTitulo(''); setTema('')
  }

  async function gerarMassa() {
    const temas = massTemas.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 12)
    if (!temas.length) { flash('Liste ao menos um tema (um por linha).', true); return }
    setMassBusy(true)
    let ok = 0, fail = 0
    const today = new Date()
    for (let i = 0; i < temas.length; i++) {
      setMassProg(`Gerando ${i + 1}/${temas.length}: ${temas[i]}`)
      try {
        const prompt = `Escreva um conteúdo do tipo "${massTipo}" sobre "${temas[i]}" para um app de saúde emocional. Português brasileiro, acolhedor, sem diagnóstico. Inclua pergunta para o diário e CTA gentil.`
        const content = await callAI(prompt, { tone: 'acolhedor', size: 'médio' })
        const date = new Date(today.getTime() + i * 86400000)
        const { data, error } = await insertDraft({
          title: temas[i], slug: `${slugify(temas[i])}-${Date.now().toString(36).slice(-4)}`,
          content, summary: '', excerpt: '', category: '', plan_required: massPlano,
          content_type: massTipo, status: 'draft', origin: 'ia', updated_at: new Date().toISOString(),
        })
        if (error) { fail++; continue }
        ok++
        // Entrada no calendário editorial (best-effort)
        supabase.from('editorial_calendar').insert({
          article_id: (data as { id?: string } | null)?.id ?? null, title: temas[i],
          content_type: massTipo, plan_required: massPlano, status: 'gerado_ia', origin: 'ia',
          scheduled_date: date.toISOString().slice(0, 10),
        }).then(() => {}, () => {})
      } catch { fail++ }
    }
    setMassBusy(false); setMassProg('')
    flash(`Pacote gerado: ${ok} rascunho(s)${fail ? `, ${fail} falha(s)` : ''}. Todos como rascunho para revisão.`, fail > 0 && ok === 0)
    setMassTemas('')
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {toast && <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Fábrica IA</h1>
          <p className="text-sm text-ink-soft mt-1">Gere conteúdo com IA. Tudo entra como <strong>rascunho</strong> — revisão humana antes de publicar.</p>
        </div>
        <div className="flex gap-1 bg-paper-soft border border-line rounded-xl p-1">
          <button onClick={() => setMode('single')} className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${mode === 'single' ? 'bg-white shadow-sm text-forest-900' : 'text-ink-soft'}`}><FileText className="w-4 h-4" /> Único</button>
          <button onClick={() => setMode('mass')} className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg ${mode === 'mass' ? 'bg-white shadow-sm text-forest-900' : 'text-ink-soft'}`}><Layers className="w-4 h-4" /> Em massa</button>
        </div>
      </div>

      <div className="border border-[#eeb7a7] bg-[#fff5f1] text-[#783426] rounded-xl px-4 py-2.5 text-sm mb-5">
        A IA gera rascunhos. Nada é publicado automaticamente — você revisa e publica no editor.
      </div>

      {mode === 'single' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-line rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Briefing</h2>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Template (opcional)</label>
              <select value={tpl} onChange={e => setTpl(e.target.value)} className={inputCls}>
                <option value="">— Prompt padrão —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label className="block text-xs text-stone-500 mb-1">Tema *</label><input value={tema} onChange={e => setTema(e.target.value)} placeholder="Ex: quando a ansiedade aperta no trabalho" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs text-stone-500 mb-1">Categoria</label><input value={categoria} onChange={e => setCategoria(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-xs text-stone-500 mb-1">Palavra-chave</label><input value={keyword} onChange={e => setKeyword(e.target.value)} className={inputCls} /></div>
              <div><label className="block text-xs text-stone-500 mb-1">Tipo</label><select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="block text-xs text-stone-500 mb-1">Plano</label><select value={plano} onChange={e => setPlano(e.target.value)} className={inputCls}>{PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><label className="block text-xs text-stone-500 mb-1">Tom</label><select value={tom} onChange={e => setTom(e.target.value as AITone)} className={inputCls}>{TONES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="block text-xs text-stone-500 mb-1">Tamanho</label><select value={tamanho} onChange={e => setTamanho(e.target.value as AISize)} className={inputCls}>{SIZES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="block text-xs text-stone-500 mb-1">Público-alvo</label><input value={publico} onChange={e => setPublico(e.target.value)} className={inputCls} /></div>
            <button onClick={gerar} disabled={gerando} className="w-full inline-flex items-center justify-center gap-2 bg-forest-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
              {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Gerar rascunho
            </button>
          </div>

          <div className="bg-white border border-line rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Resultado</h2>
            <div><label className="block text-xs text-stone-500 mb-1">Título</label><input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Título do conteúdo" className={inputCls} /></div>
            <textarea value={resultado} onChange={e => setResultado(e.target.value)} rows={14} placeholder="O conteúdo gerado aparece aqui — edite à vontade antes de salvar." className={`${inputCls} font-mono leading-relaxed`} />
            <button onClick={salvarRascunho} disabled={salvando || !resultado.trim()} className="w-full inline-flex items-center justify-center gap-2 border border-line bg-white text-forest-800 px-4 py-2.5 rounded-xl text-sm font-medium hover:border-forest-300 disabled:opacity-50">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar como rascunho
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-2xl p-5 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">Pacote em massa</h2>
          <p className="text-xs text-ink-soft">Um tema por linha (até 12). Cada tema vira um rascunho + uma entrada no Calendário Editorial (datas sequenciais).</p>
          <textarea value={massTemas} onChange={e => setMassTemas(e.target.value)} rows={8} placeholder={'ansiedade no trabalho\nautoestima e comparação\nsono e rotina\nlimites nas relações'} className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs text-stone-500 mb-1">Tipo</label><select value={massTipo} onChange={e => setMassTipo(e.target.value)} className={inputCls}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="block text-xs text-stone-500 mb-1">Plano</label><select value={massPlano} onChange={e => setMassPlano(e.target.value)} className={inputCls}>{PLANS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          </div>
          {massBusy && <p className="text-xs text-forest-700 inline-flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {massProg}</p>}
          <button onClick={gerarMassa} disabled={massBusy} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">
            {massBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Gerar pacote (rascunhos)
          </button>
        </div>
      )}
    </div>
  )
}
