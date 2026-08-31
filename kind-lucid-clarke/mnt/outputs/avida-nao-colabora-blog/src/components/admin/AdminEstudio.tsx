import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Megaphone, Sparkles, CalendarDays, Grid3x3, Bookmark, Users2,
  BarChart3, ArrowRight, ArrowLeft, Save, Info, Loader2, Wand2, Download, Check, AlertTriangle,
} from 'lucide-react'
import { LogoIcon } from '../Logo'
import type { EstudioBrief } from '../../lib/estudioPrompts'
import { generateCaptions, generateImagePrompt, estudioAiMessage, type CaptionResult } from '../../lib/estudioAi'
import { FORMAT_SPECS } from '../../lib/estudioFormats'
import { snapshot, downloadAsset, releaseAssets, type RenderedAsset } from '../../lib/estudioRender'
import FormatTemplate from './estudio/FormatTemplate'

// ─────────────────────────────────────────────────────────────────────────────
// Estúdio de Conteúdo — área de marketing do admin (mockup estudio-conteudo.html).
//
// FASE 1a (esta): registra a área, o shell de abas e o assistente "Nova
// publicação" com rascunho local. A geração de IA, o motor de render (template
// → PNG no formato exato) e o pacote de exportação chegam nas fases seguintes,
// sem tocar em Stripe, planos, entitlements, Diário, automações ou migrations.
//
// Sem API do Instagram: a publicação continua sendo manual (app ou Meta
// Business Suite). O texto livre aqui é do marketing — nunca vem do Diário.
// ─────────────────────────────────────────────────────────────────────────────

type TabId = 'novo' | 'calendario' | 'grade' | 'destaques' | 'inspiracao' | 'comunidade' | 'desempenho'

const TABS: { id: TabId; label: string; icon: typeof Megaphone }[] = [
  { id: 'novo', label: 'Nova publicação', icon: Sparkles },
  { id: 'calendario', label: 'Calendário', icon: CalendarDays },
  { id: 'grade', label: 'Grade', icon: Grid3x3 },
  { id: 'destaques', label: 'Destaques', icon: Bookmark },
  { id: 'inspiracao', label: 'Inspiração', icon: Users2 },
  { id: 'comunidade', label: 'Comunidade', icon: Users2 },
  { id: 'desempenho', label: 'Desempenho', icon: BarChart3 },
]

const TAB_KEY = 'admin-estudio-tab'
const DRAFT_KEY = 'admin-estudio-rascunho'

const GOALS = [
  { id: 'salvar', label: '💾 Fazer salvar' },
  { id: 'compartilhar', label: '📩 Fazer compartilhar' },
  { id: 'comentar', label: '💬 Gerar comentário' },
  { id: 'blog', label: '🔗 Levar ao blog' },
  { id: 'alcance', label: '👋 Alcançar gente nova' },
] as const

const FORMATS = [
  { id: 'feed-45', label: 'Feed · retrato', spec: '1080 × 1350 · 4:5' },
  { id: 'feed-11', label: 'Feed · quadrado', spec: '1080 × 1080 · 1:1' },
  { id: 'carrossel', label: 'Carrossel', spec: '1080 × 1350 · até 20 slides' },
  { id: 'story', label: 'Story', spec: '1080 × 1920 · 9:16' },
  { id: 'reel-capa', label: 'Reel · capa + roteiro', spec: '1080 × 1920 · 9:16' },
  { id: 'quiz', label: 'Quiz "mito ou verdade"', spec: 'carrossel · 2 slides' },
] as const

interface Draft {
  ideia: string
  objetivos: string[]
  estilo: 'template' | 'ia' | 'hibrido'
  prompt: string
  titulo: string
  formatos: string[]
  legenda: string
  hashtags: string
  primeiroComentario: string
}

const EMPTY_DRAFT: Draft = {
  ideia: '',
  objetivos: [],
  estilo: 'template',
  prompt: '',
  titulo: '',
  formatos: ['feed-45', 'carrossel', 'story', 'reel-capa'],
  legenda: '',
  hashtags: '',
  primeiroComentario: '',
}

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) }
  } catch { /* noop */ }
  return EMPTY_DRAFT
}

const STEPS = ['Ideia', 'Visual', 'Formatos', 'Textos', 'Pacote'] as const

function toBrief(d: Draft): EstudioBrief {
  return { ideia: d.ideia.trim(), objetivos: d.objetivos, estilo: d.estilo }
}

// ─── shell ───────────────────────────────────────────────────────────────────

export default function AdminEstudio() {
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      if (saved && TABS.some(t => t.id === saved)) return saved as TabId
    } catch { /* noop */ }
    return 'novo'
  })

  useEffect(() => {
    try { localStorage.setItem(TAB_KEY, tab) } catch { /* noop */ }
  }, [tab])

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-3xl text-forest-900 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-forest-600" /> Estúdio de Conteúdo
          </h1>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">
            A IA ajuda a criar posts, carrosséis, stories, reels e destaques para o Instagram, cada formato no tamanho
            exato. A publicação é sua — manual pelo app ou agendada no Meta Business Suite.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-line mb-6">
        {TABS.map(t => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                on ? 'border-forest-600 text-forest-900' : 'border-transparent text-ink-soft hover:text-forest-800'
              }`}
              aria-current={on ? 'page' : undefined}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'novo' ? <NovaPublicacao /> : <EmBreve tab={tab} />}
    </div>
  )
}

// ─── aba: Nova publicação (assistente de 5 passos) ───────────────────────────

function NovaPublicacao() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(loadDraft)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  // Artes renderizadas (blobs) — vivem só na sessão; não serializam no rascunho.
  const [assets, setAssets] = useState<RenderedAsset[]>([])
  useEffect(() => () => releaseAssets(assets), [assets])

  const patch = useCallback((p: Partial<Draft>) => setDraft(d => ({ ...d, ...p })), [])

  const save = useCallback(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch { /* noop */ }
  }, [draft])

  // Autosave leve — o rascunho não se perde ao trocar de aba ou recarregar.
  useEffect(() => {
    const id = setTimeout(save, 600)
    return () => clearTimeout(id)
  }, [draft, save])

  const toggle = (key: 'objetivos' | 'formatos', value: string) =>
    patch({ [key]: draft[key].includes(value) ? draft[key].filter(v => v !== value) : [...draft[key], value] } as Partial<Draft>)

  const canAdvance = useMemo(() => {
    if (step === 0) return draft.ideia.trim().length >= 8 && draft.objetivos.length > 0
    if (step === 2) return draft.formatos.length > 0
    return true
  }, [step, draft])

  return (
    <div className="space-y-5">
      {/* stepper */}
      <ol className="flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'on' : 'todo'
          return (
            <li key={label}>
              <button
                onClick={() => i <= step && setStep(i)}
                disabled={i > step}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  state === 'on' ? 'border-forest-400 text-forest-900 bg-mint/40'
                  : state === 'done' ? 'border-line text-forest-700 hover:border-forest-300'
                  : 'border-line text-stone-400'
                }`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${
                  state === 'todo' ? 'bg-stone-100 text-stone-400' : 'bg-forest-700 text-white'
                }`}>{state === 'done' ? '✓' : i + 1}</span>
                {label}
              </button>
            </li>
          )
        })}
      </ol>

      <div className="rounded-2xl border border-line bg-white p-5">
        {step === 0 && <StepIdeia draft={draft} patch={patch} toggle={toggle} />}
        {step === 1 && <StepVisual draft={draft} patch={patch} />}
        {step === 2 && <StepFormatos draft={draft} toggle={toggle} assets={assets} setAssets={setAssets} />}
        {step === 3 && <StepTextos draft={draft} patch={patch} />}
        {step === 4 && <StepPacote draft={draft} assets={assets} />}
      </div>

      {/* navegação */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 hover:border-forest-300 disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => canAdvance && setStep(s => s + 1)}
            disabled={!canAdvance}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2 text-sm text-forest-800 hover:border-forest-300"
        >
          <Save className="h-4 w-4" /> Salvar rascunho
        </button>
        {savedAt && <span className="text-xs text-stone-400">rascunho salvo às {savedAt}</span>}
      </div>
    </div>
  )
}

// ─── passos ─────────────────────────────────────────────────────────────────

function Field({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{children}</span>
}

function StepIdeia({
  draft, patch, toggle,
}: {
  draft: Draft
  patch: (p: Partial<Draft>) => void
  toggle: (k: 'objetivos' | 'formatos', v: string) => void
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div>
        <Field>Sua ideia</Field>
        <textarea
          value={draft.ideia}
          onChange={e => patch({ ideia: e.target.value })}
          rows={4}
          placeholder="Ex.: post sobre não precisar dar conta de tudo ao mesmo tempo, tom acolhedor, ligado ao artigo “Quando descansar vira culpa”."
          className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
        />
        <Field>Objetivo principal</Field>
        <div className="flex flex-wrap gap-1.5">
          {GOALS.map(g => {
            const on = draft.objetivos.includes(g.id)
            return (
              <button
                key={g.id}
                onClick={() => toggle('objetivos', g.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  on ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
                }`}
              >
                {g.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="rounded-xl bg-mint/50 p-4">
        <h3 className="font-serif text-base text-forest-900">Por que pedir o objetivo</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          O algoritmo hoje premia <b>salvamentos e envios em DM</b>, não curtidas. O objetivo muda o formato que a IA
          recomenda, a estrutura da legenda e o CTA.
        </p>
      </div>
    </div>
  )
}

function StepVisual({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const opts: { id: Draft['estilo']; label: string; hint: string }[] = [
    { id: 'template', label: 'Template da marca', hint: 'Playfair + paleta do blog. Previsível e barato — recomendado.' },
    { id: 'ia', label: 'IA generativa de imagem', hint: 'Flexível, custa por imagem, às vezes com “cara de IA”.' },
    { id: 'hibrido', label: 'Híbrido', hint: 'Fundo gerado por IA + tipografia da marca por cima.' },
  ]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [racional, setRacional] = useState('')
  const podeGerar = draft.ideia.trim().length >= 8

  async function sugerir() {
    setBusy(true); setErr(''); setRacional('')
    try {
      const r = await generateImagePrompt(toBrief(draft))
      patch({ prompt: r.prompt, ...(r.tituloSugerido && !draft.titulo ? { titulo: r.tituloSugerido } : {}) })
      setRacional([r.racional, r.tituloSugerido && `Título sugerido: “${r.tituloSugerido}”`].filter(Boolean).join(' · '))
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Field>Estilo visual</Field>
        <div className="grid gap-2 sm:grid-cols-3">
          {opts.map(o => {
            const on = draft.estilo === o.id
            return (
              <button
                key={o.id}
                onClick={() => patch({ estilo: o.id })}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  on ? 'border-forest-600 ring-1 ring-forest-200' : 'border-line hover:border-forest-300'
                }`}
              >
                <span className="block text-sm font-medium text-forest-900">{o.label}</span>
                <span className="mt-1 block text-xs text-ink-soft">{o.hint}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Field>Prompt de imagem (editável)</Field>
          <button
            onClick={sugerir}
            disabled={busy || !podeGerar}
            title={podeGerar ? undefined : 'Descreva a ideia no passo anterior'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-2.5 py-1 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {draft.prompt ? 'Refazer com a IA' : 'Sugerir com a IA'}
          </button>
        </div>
        <textarea
          value={draft.prompt}
          onChange={e => patch({ prompt: e.target.value })}
          rows={3}
          placeholder="Descreva a imagem, ou peça uma sugestão à IA a partir da sua ideia."
          className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
        />
        {racional && <p className="mt-1.5 text-xs text-ink-soft">{racional}</p>}
        {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
      </div>
      <NextPhaseNote>
        A geração da <b>prévia da imagem</b> (motor de template → PNG no formato exato) entra na <b>Fase 1d</b>. Aqui a IA
        já ajuda a escrever e ajustar o prompt.
      </NextPhaseNote>
    </div>
  )
}

const FMT_KICKER: Record<string, string> = {
  'feed-45': 'A vida não colabora', 'feed-11': 'A vida não colabora',
  carrossel: 'Carrossel', story: 'No story de hoje', 'reel-capa': 'Novo reel', quiz: 'Mito ou verdade',
}

function StepFormatos({
  draft, toggle, assets, setAssets,
}: {
  draft: Draft
  toggle: (k: 'objetivos' | 'formatos', v: string) => void
  assets: RenderedAsset[]
  setAssets: (a: RenderedAsset[]) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const selected = draft.formatos.filter(id => FORMAT_SPECS[id])
  const titulo = draft.titulo || draft.ideia.slice(0, 60)

  async function gerar() {
    if (!stageRef.current) return
    setBusy(true); setErr('')
    releaseAssets(assets)
    const out: RenderedAsset[] = []
    try {
      for (const id of selected) {
        const node = stageRef.current.querySelector<HTMLElement>(`[data-fmt="${id}"]`)
        if (!node) continue
        out.push(await snapshot(node, FORMAT_SPECS[id], `${id}-${FORMAT_SPECS[id].width}x${FORMAT_SPECS[id].height}.png`))
      }
      setAssets(out)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao gerar as artes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Field>O que gerar desta ideia</Field>
      <div className="grid gap-2 sm:grid-cols-3">
        {FORMATS.map(f => {
          const on = draft.formatos.includes(f.id)
          return (
            <button
              key={f.id}
              onClick={() => toggle('formatos', f.id)}
              className={`rounded-xl border p-3 text-left transition-colors ${
                on ? 'border-forest-600 ring-1 ring-forest-200' : 'border-line hover:border-forest-300'
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium text-forest-900">
                {f.label}
                <span className={`grid h-4 w-4 place-items-center rounded border text-[10px] ${on ? 'border-forest-600 bg-forest-600 text-white' : 'border-line text-transparent'}`}>✓</span>
              </span>
              <span className="mt-1 block font-mono text-[10px] text-ink-soft">{f.spec}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={gerar}
          disabled={busy || selected.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Gerar {selected.length} {selected.length === 1 ? 'arte' : 'artes'}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>

      {assets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {assets.map(a => (
            <figure key={a.filename} className="overflow-hidden rounded-xl border border-line bg-white">
              <img src={a.url} alt={a.filename} className="w-full" style={{ aspectRatio: `${a.width}/${a.height}` }} />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="font-mono text-ink-soft">{a.width}×{a.height}</span>
                {a.check.ok ? (
                  <span className="inline-flex items-center gap-1 text-forest-700"><Check className="h-3.5 w-3.5" /> formato ok</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-600" title={a.check.problems.join('; ')}><AlertTriangle className="h-3.5 w-3.5" /> revisar</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <NextPhaseNote>
        Estilo <b>template da marca</b>. Carrossel e quiz saem por ora só com a capa — os slides internos e a IA generativa
        de imagem entram na <b>Fase 1e</b>. O pacote .zip também.
      </NextPhaseNote>

      {/* palco de render fora da tela — dimensão real, capturado pelo html2canvas */}
      <div ref={stageRef} aria-hidden style={{ position: 'fixed', left: -100000, top: 0, opacity: 0, pointerEvents: 'none' }}>
        {selected.map(id => (
          <div key={id} data-fmt={id}>
            <FormatTemplate
              spec={FORMAT_SPECS[id]}
              content={{ titulo, kicker: FMT_KICKER[id], corpo: id.startsWith('feed') ? undefined : draft.legenda.split('\n')[0] || undefined }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function StepTextos({ draft, patch }: { draft: Draft; patch: (p: Partial<Draft>) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [res, setRes] = useState<CaptionResult | null>(null)
  const [pick, setPick] = useState(0)
  const podeGerar = draft.ideia.trim().length >= 8

  async function gerar() {
    setBusy(true); setErr('')
    try {
      const r = await generateCaptions(toBrief(draft))
      setRes(r); setPick(0)
      patch({ legenda: r.legendas[0].texto, hashtags: r.hashtags, primeiroComentario: r.primeiroComentario })
    } catch (e) {
      setErr(estudioAiMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function usar(i: number) {
    if (!res) return
    setPick(i)
    patch({ legenda: res.legendas[i].texto })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <button
          onClick={gerar}
          disabled={busy || !podeGerar}
          className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-mint/40 px-3 py-1.5 text-xs font-medium text-forest-800 hover:bg-mint disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {res ? 'Gerar de novo' : 'Gerar 3 legendas + hashtags'}
        </button>
        {err && <p className="text-xs text-red-600">{err}</p>}

        {res && res.legendas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {res.legendas.map((l, i) => (
              <button
                key={i}
                onClick={() => usar(i)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  pick === i ? 'border-forest-900 bg-forest-900 text-white' : 'border-line bg-white text-ink-soft hover:border-forest-300'
                }`}
              >
                {l.rotulo || `Variação ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        <div>
          <Field>Legenda</Field>
          <textarea
            value={draft.legenda}
            onChange={e => patch({ legenda: e.target.value })}
            rows={6}
            placeholder="Escreva a legenda, ou gere 3 variações com a IA e escolha uma."
            className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
          <span className="text-xs text-stone-400">{draft.legenda.length} / 2.200 caracteres</span>
        </div>
        <div>
          <Field>Primeiro comentário — hashtags</Field>
          <textarea
            value={draft.hashtags}
            onChange={e => patch({ hashtags: e.target.value })}
            rows={2}
            placeholder="#saudeemocional #autocuidado …  (a IA sugere ~10 de nicho médio)"
            className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
          />
        </div>
        {draft.primeiroComentario && (
          <div>
            <Field>Comentário com o CTA para o blog</Field>
            <textarea
              value={draft.primeiroComentario}
              onChange={e => patch({ primeiroComentario: e.target.value })}
              rows={2}
              className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
          </div>
        )}
      </div>
      <div className="rounded-xl bg-mint/50 p-4">
        <h3 className="font-serif text-base text-forest-900">Regra fixa</h3>
        <p className="mt-2 text-xs leading-relaxed text-ink">
          O texto do post é do marketing. <b>Nada aqui vem do Diário dos usuários</b> — a IA usa só a sua ideia, artigos
          publicados e temas das categorias. A geração roda server-side (chaves só no Supabase).
        </p>
      </div>
    </div>
  )
}

function StepPacote({ draft, assets }: { draft: Draft; assets: RenderedAsset[] }) {
  const fmtLabels = FORMATS.filter(f => draft.formatos.includes(f.id)).map(f => f.label)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="block h-5 w-5 text-forest-700"><LogoIcon className="h-full w-full" /></span>
        <h3 className="font-serif text-lg text-forest-900">Resumo do rascunho</h3>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Ideia</dt><dd className="mt-0.5 text-ink">{draft.ideia || '—'}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Objetivos</dt><dd className="mt-0.5 text-ink">{draft.objetivos.length ? draft.objetivos.join(', ') : '—'}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Estilo visual</dt><dd className="mt-0.5 text-ink">{draft.estilo}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-wide text-ink-soft">Formatos</dt><dd className="mt-0.5 text-ink">{fmtLabels.length ? fmtLabels.join(', ') : '—'}</dd></div>
      </dl>

      <div>
        <Field>Artes geradas</Field>
        {assets.length === 0 ? (
          <p className="text-xs text-ink-soft">Nenhuma arte gerada ainda — volte ao passo <b>Formatos</b> e clique em “Gerar artes”.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-xl border border-line">
            {assets.map(a => (
              <li key={a.filename} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${a.check.ok ? 'bg-forest-500' : 'bg-amber-400'}`} />
                <span className="flex-1 truncate font-mono text-ink-soft">{a.filename}</span>
                <span className="text-stone-400">{(a.bytes / 1024).toFixed(0)} KB</span>
                <button
                  onClick={() => downloadAsset(a)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2 py-1 font-medium text-forest-800 hover:border-forest-300"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <NextPhaseNote>
        O <b>pacote .zip</b> (artes + textos + instruções de sticker), o agendamento no Business Suite e a
        <b> aprovação humana</b> antes de marcar como pronto para publicar entram na <b>Fase 1e</b>. Publicar via API do
        Instagram e automatizar interação continuam fora de escopo.
      </NextPhaseNote>
    </div>
  )
}

// ─── auxiliares ─────────────────────────────────────────────────────────────

function NextPhaseNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 rounded-xl border-l-2 border-forest-400 bg-stone-50 px-4 py-3 text-xs leading-relaxed text-ink-soft">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-500" />
      <span>{children}</span>
    </p>
  )
}

function EmBreve({ tab }: { tab: TabId }) {
  const meta: Record<Exclude<TabId, 'novo'>, { fase: string; desc: string }> = {
    calendario: { fase: 'Fase 2', desc: 'Calendário editorial ligado às categorias e ao analytics por slug do blog. A IA propõe o plano da semana; você aceita, troca ou remove.' },
    grade: { fase: 'Fase 2', desc: 'Prévia em mosaico 3×3 das próximas publicações, para o feed manter coesão visual antes de postar.' },
    destaques: { fase: 'Fase 4', desc: 'Jogo de capas de destaque on-brand (uma por categoria) e organização de quais frames de story entram em cada destaque.' },
    inspiracao: { fase: 'Fase 4', desc: 'Cadastro de perfis de referência. Você cola algumas legendas recentes deles 1×/mês e a IA extrai o padrão — sem raspar dados.' },
    comunidade: { fase: 'Fase 4', desc: 'Rotina diária de 15 minutos: a IA sugere onde e o que comentar, você faz na mão. A ferramenta nunca curte ou comenta por você.' },
    desempenho: { fase: 'Fase 2', desc: 'Registro manual leve de métricas (alcance, salvos, compartilhamentos, cliques, cadastros) com leitura da IA sobre o que converte.' },
  }
  const m = meta[tab as Exclude<TabId, 'novo'>]
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-14 text-center">
      <LogoIcon className="mx-auto h-8 w-8 text-forest-300" />
      <p className="mt-3 text-sm font-medium text-forest-900">{m.fase} — em construção</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-ink-soft">{m.desc}</p>
    </div>
  )
}
