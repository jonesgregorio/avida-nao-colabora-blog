import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, Check, RefreshCw, ExternalLink, KeyRound, Cpu } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Configuração de IA no Admin:
//  - modelo do Gemini/Groq (override no banco, sem deploy)
//  - painel de status das chaves (SET / faltando) — nunca mostra o valor
// Backend: Edge Function admin-config-status + RPC admin_set_ai_models.

interface Status {
  secrets: Record<string, boolean>
  models: {
    gemini: string; groq: string
    geminiSource: 'db' | 'env' | 'default'
    groqSource: 'db' | 'env' | 'default'
    geminiDefault: string; groqDefault: string
  }
}

const SOURCE_LABEL: Record<string, string> = { db: 'definido no Admin', env: 'secret do Supabase', default: 'padrão do código' }

// Chaves agrupadas por função + o que fazer se faltar.
const GROUPS: { title: string; keys: { k: string; need: 'req' | 'opt'; note?: string }[] }[] = [
  {
    title: 'IA — texto e imagem',
    keys: [
      { k: 'GEMINI_API_KEY', need: 'req' },
      { k: 'GROQ_API_KEY', need: 'req', note: 'failover quando o Gemini falha' },
      { k: 'OPENAI_API_KEY', need: 'opt', note: '3º provedor. Sem ele, se Gemini e Groq falharem juntos a geração cai num template.' },
    ],
  },
  {
    title: 'Mídia',
    keys: [
      { k: 'YOUTUBE_API_KEY', need: 'req', note: 'vídeo de referência real nos artigos' },
      { k: 'PEXELS_API_KEY', need: 'req', note: 'capa de artigo relacionada ao tema' },
      { k: 'GEMINI_IMAGE_MODEL', need: 'opt', note: 'só se quiser fixar o modelo de imagem do Estúdio' },
    ],
  },
  {
    title: 'E-mail',
    keys: [
      { k: 'RESEND_API_KEY', need: 'req' },
      { k: 'EMAIL_FROM', need: 'req' },
      { k: 'RESEND_WEBHOOK_SECRET', need: 'opt', note: 'saber quando um e-mail volta (bounce)' },
    ],
  },
  {
    title: 'Segurança e infra',
    keys: [
      { k: 'TURNSTILE_SECRET_KEY', need: 'opt', note: 'captcha do formulário de contato. Sem ele qualquer envio é aceito.' },
      { k: 'CRON_SECRET', need: 'req' },
      { k: 'SITE_URL', need: 'req' },
      { k: 'ADMIN_ALERT_EMAIL', need: 'opt', note: 'aviso quando um usuário troca/cancela plano' },
    ],
  },
  {
    title: 'Stripe',
    keys: [
      { k: 'STRIPE_SECRET_KEY', need: 'req' },
      { k: 'STRIPE_WEBHOOK_SECRET', need: 'req' },
      { k: 'STRIPE_PRICE_ESSENTIAL', need: 'req' },
      { k: 'STRIPE_PRICE_PLUS_3990', need: 'req' },
    ],
  },
]

const SECRETS_URL = 'https://supabase.com/dashboard/project/lejvvhzluggyxlfwfoxl/functions/secrets'

export default function AdminAIConfig() {
  const [status, setStatus] = useState<Status | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [gemini, setGemini] = useState('')
  const [groq, setGroq] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setErr('')
    const { data, error } = await supabase.functions.invoke('admin-config-status')
    setLoading(false)
    if (error || (data as { error?: string })?.error) {
      setErr((data as { error?: string })?.error || error?.message || 'Falha ao carregar')
      return
    }
    const s = data as Status
    setStatus(s)
    setGemini(s.models.geminiSource === 'db' ? s.models.gemini : '')
    setGroq(s.models.groqSource === 'db' ? s.models.groq : '')
  }, [])
  useEffect(() => { void load() }, [load])

  async function saveModels() {
    setSaving(true); setErr(''); setSaved(false)
    const { error } = await supabase.rpc('admin_set_ai_models', { p_gemini: gemini.trim() || null, p_groq: groq.trim() || null })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 2500)
    await load()
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-forest-500" /></div>
  if (!status) return <p className="text-sm text-red-600">{err || 'Sem dados.'}</p>

  return (
    <div className="space-y-6">
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Modelos */}
      <section className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-forest-700" />
          <h3 className="font-medium text-forest-900">Modelo de IA</h3>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Deixe em branco para usar o padrão. Preencha quando um modelo for aposentado (ex.: o Google retirou o <code>gemini-2.5-flash</code>) — vale na hora, sem deploy.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-ink-soft">
            Gemini <span className="text-stone-400">(padrão: {status.models.geminiDefault})</span>
            <input
              value={gemini}
              onChange={e => setGemini(e.target.value)}
              placeholder={status.models.gemini}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
            <span className="mt-0.5 block text-[11px] text-stone-400">em uso: <code>{status.models.gemini}</code> ({SOURCE_LABEL[status.models.geminiSource]})</span>
          </label>
          <label className="text-xs text-ink-soft">
            Groq <span className="text-stone-400">(padrão: {status.models.groqDefault})</span>
            <input
              value={groq}
              onChange={e => setGroq(e.target.value)}
              placeholder={status.models.groq}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-forest-300"
            />
            <span className="mt-0.5 block text-[11px] text-stone-400">em uso: <code>{status.models.groq}</code> ({SOURCE_LABEL[status.models.groqSource]})</span>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={saveModels} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-forest-900 px-4 py-2 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} salvar modelos
          </button>
          {saved && <span className="inline-flex items-center gap-1 text-xs font-medium text-forest-700"><Check className="h-3.5 w-3.5" /> salvo</span>}
        </div>
      </section>

      {/* Chaves */}
      <section className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-forest-700" />
            <h3 className="font-medium text-forest-900">Chaves configuradas</h3>
          </div>
          <button onClick={load} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-forest-800"><RefreshCw className="h-3.5 w-3.5" /> atualizar</button>
        </div>
        <p className="mt-1 text-xs text-ink-soft">
          Por segurança o valor da chave nunca aparece aqui — só se está definida. Para adicionar ou trocar,{' '}
          <a href={SECRETS_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-forest-700 underline underline-offset-2">
            Secrets do Supabase <ExternalLink className="h-3 w-3" />
          </a>.
        </p>

        <div className="mt-3 space-y-4">
          {GROUPS.map(g => (
            <div key={g.title}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{g.title}</p>
              <ul className="mt-1.5 space-y-1">
                {g.keys.map(({ k, need, note }) => {
                  const set = status.secrets[k]
                  return (
                    <li key={k} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
                      <span className={`inline-flex items-center gap-1 font-medium ${set ? 'text-forest-700' : need === 'req' ? 'text-red-600' : 'text-amber-600'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${set ? 'bg-forest-500' : need === 'req' ? 'bg-red-500' : 'bg-amber-400'}`} />
                        {set ? 'definida' : need === 'req' ? 'FALTANDO' : 'opcional'}
                      </span>
                      <code className="text-ink">{k}</code>
                      {note && <span className="text-stone-400">— {note}</span>}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
