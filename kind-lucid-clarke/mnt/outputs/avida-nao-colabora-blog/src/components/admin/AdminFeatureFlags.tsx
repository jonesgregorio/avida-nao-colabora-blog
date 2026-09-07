import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminAudit'
import { ToggleRight, Plus, Loader2, ShieldAlert, RefreshCw } from 'lucide-react'

interface Flag {
  key: string
  label: string
  description: string | null
  mode: 'off' | 'admins' | 'beta' | 'percentage' | 'on'
  percentage: number
  plans: string[]
  user_ids: string[]
  environments: string[]
  is_protected: boolean
  updated_at: string
}

const MODES: { v: Flag['mode']; l: string; hint: string }[] = [
  { v: 'off', l: 'Desativado', hint: 'ninguém' },
  { v: 'admins', l: 'Só administradores', hint: 'apenas quem tem acesso ao painel' },
  { v: 'beta', l: 'Beta', hint: 'administradores + a lista de usuários abaixo' },
  { v: 'percentage', l: 'Percentual', hint: 'uma fatia fixa dos usuários' },
  { v: 'on', l: 'Todos', hint: 'todos os usuários (respeitando planos)' },
]
const PLANS = ['free', 'essential', 'plus'] as const
const ENVS = ['production', 'preview'] as const
const MODE_CLS: Record<Flag['mode'], string> = {
  off: 'bg-stone-100 text-stone-500', admins: 'bg-blue-100 text-blue-700',
  beta: 'bg-amber-100 text-amber-700', percentage: 'bg-violet-100 text-violet-700', on: 'bg-mint text-forest-800',
}
const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

export default function AdminFeatureFlags() {
  const [flags, setFlags] = useState<Flag[]>([])
  const [loading, setLoading] = useState(true)
  const [notAvailable, setNotAvailable] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [nk, setNk] = useState({ key: '', label: '', description: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('feature_flags').select('*').order('key')
    if (error) {
      if (/feature_flags|does not exist|schema cache/i.test(error.message)) setNotAvailable(true)
      setFlags([])
    } else {
      setFlags((data ?? []) as Flag[])
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function apply(key: string, patch: Record<string, unknown>, force = false) {
    setBusy(key); setMsg(null)
    const { data, error } = await supabase.rpc('admin_set_feature_flag', { p_key: key, p_force: force, ...patch })
    setBusy(null)
    if (error) {
      // Guarda-vidas do backend: flag protegida indo para off/admins sem confirmação.
      if (/protegida/i.test(error.message)) {
        if (window.confirm(`${error.message}\n\nEsta funcionalidade pode controlar login, cobrança ou integridade de dados. Digitar OK abaixo confirma.`)
          && window.prompt('Digite DESLIGAR para confirmar:') === 'DESLIGAR') {
          return apply(key, patch, true)
        }
        setMsg({ ok: false, text: 'Alteração cancelada — flag protegida.' })
        return
      }
      setMsg({ ok: false, text: 'Erro: ' + error.message })
      return
    }
    void logAdminAction('config', 'feature_flag', key, { ...patch, forced: force })
    setMsg({ ok: true, text: `Flag "${key}" atualizada.` })
    const r = data as { mode?: string } | null
    setFlags(fs => fs.map(f => f.key === key ? { ...f, ...(patch as Partial<Flag>), mode: (r?.mode as Flag['mode']) ?? f.mode } : f))
  }

  async function createFlag() {
    if (!/^[a-z][a-z0-9_]+$/.test(nk.key)) { setMsg({ ok: false, text: 'A chave usa só letras minúsculas, números e _ (ex.: novo_relatorio).' }); return }
    await apply(nk.key, { p_label: nk.label || nk.key, p_description: nk.description || null, p_mode: 'off' })
    setShowNew(false); setNk({ key: '', label: '', description: '' })
    void load()
  }

  const toggleArr = (f: Flag, field: 'plans' | 'environments', v: string) => {
    const cur = new Set(f[field]); if (cur.has(v)) cur.delete(v); else cur.add(v)
    void apply(f.key, field === 'plans' ? { p_plans: [...cur] } : { p_environments: [...cur] })
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><ToggleRight className="w-5 h-5 text-forest-600" /> Funcionalidades</h1>
          <p className="text-sm text-ink-soft mt-1">Ligar e desligar recursos por modo, plano, percentual, ambiente ou lista de usuários.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-lg text-sm hover:border-forest-300">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button onClick={() => setShowNew(v => !v)} className="inline-flex items-center gap-2 bg-forest-900 text-white px-3 py-2 rounded-lg text-sm hover:bg-forest-800">
            <Plus className="w-4 h-4" /> Nova flag
          </button>
        </div>
      </div>

      {notAvailable && (
        <div className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-800 px-3.5 py-2.5 rounded-xl">
          O controle de funcionalidades fica disponível após o deploy desta etapa.
        </div>
      )}
      {msg && <div className={`mb-4 text-sm px-3.5 py-2.5 rounded-xl border ${msg.ok ? 'bg-mint/50 text-forest-800 border-forest-100' : 'bg-red-50 text-red-700 border-red-200'}`}>{msg.text}</div>}

      {showNew && (
        <div className="bg-white border border-line rounded-xl p-4 mb-5 space-y-3">
          <input value={nk.key} onChange={e => setNk(s => ({ ...s, key: e.target.value.toLowerCase() }))} placeholder="chave (ex.: novo_relatorio)" className={inputCls} />
          <input value={nk.label} onChange={e => setNk(s => ({ ...s, label: e.target.value }))} placeholder="Nome amigável" className={inputCls} />
          <input value={nk.description} onChange={e => setNk(s => ({ ...s, description: e.target.value }))} placeholder="Descrição (opcional)" className={inputCls} />
          <button onClick={() => void createFlag()} className="text-sm bg-forest-700 text-white rounded-lg px-3 py-2 hover:bg-forest-800">Criar (começa desativada)</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</p>
      ) : flags.length === 0 ? (
        <p className="text-sm text-ink-soft">Nenhuma funcionalidade cadastrada.</p>
      ) : (
        <div className="space-y-3">
          {flags.map(f => (
            <div key={f.key} className="bg-white border border-line rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-forest-900">{f.label}</p>
                    <code className="text-[11px] text-stone-400">{f.key}</code>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${MODE_CLS[f.mode]}`}>{MODES.find(m => m.v === f.mode)?.l}</span>
                    {f.is_protected && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 inline-flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Protegida
                      </span>
                    )}
                  </div>
                  {f.description && <p className="text-xs text-stone-500 mt-0.5">{f.description}</p>}
                </div>
                {busy === f.key && <Loader2 className="w-4 h-4 animate-spin text-stone-400 flex-shrink-0" />}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={f.mode}
                  onChange={e => void apply(f.key, { p_mode: e.target.value })}
                  className="text-xs border border-line rounded-lg px-2 py-1.5 bg-white"
                >
                  {MODES.map(m => <option key={m.v} value={m.v}>{m.l} — {m.hint}</option>)}
                </select>

                {f.mode === 'percentage' && (
                  <label className="text-xs text-stone-500 flex items-center gap-1.5">
                    <input
                      type="number" min={0} max={100} defaultValue={f.percentage}
                      onBlur={e => { const p = Number(e.target.value); if (p !== f.percentage) void apply(f.key, { p_percentage: p }) }}
                      className="w-16 px-2 py-1 border border-line rounded"
                    />
                    % dos usuários
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-4 mt-3 text-xs">
                <div>
                  <span className="text-stone-400">Planos: </span>
                  {PLANS.map(p => (
                    <button key={p} onClick={() => toggleArr(f, 'plans', p)}
                      className={`ml-1 px-1.5 py-0.5 rounded ${f.plans.includes(p) ? 'bg-forest-600 text-white' : 'bg-stone-100 text-stone-500'}`}>{p}</button>
                  ))}
                  {f.plans.length === 0 && <span className="text-stone-300 ml-1">(todos)</span>}
                </div>
                <div>
                  <span className="text-stone-400">Ambiente: </span>
                  {ENVS.map(e => (
                    <button key={e} onClick={() => toggleArr(f, 'environments', e)}
                      className={`ml-1 px-1.5 py-0.5 rounded ${f.environments.includes(e) ? 'bg-forest-600 text-white' : 'bg-stone-100 text-stone-500'}`}>{e}</button>
                  ))}
                  {f.environments.length === 0 && <span className="text-stone-300 ml-1">(todos)</span>}
                </div>
              </div>

              {(f.mode === 'beta' || f.user_ids.length > 0) && (
                <div className="mt-3">
                  <label className="text-xs text-stone-400">Usuários liberados (UUIDs, um por linha)</label>
                  <textarea
                    defaultValue={f.user_ids.join('\n')} rows={2}
                    onBlur={e => {
                      const ids = e.target.value.split(/\s+/).map(s => s.trim()).filter(Boolean)
                      if (ids.join(',') !== f.user_ids.join(',')) void apply(f.key, { p_user_ids: ids })
                    }}
                    className="w-full mt-1 px-2 py-1.5 border border-line rounded-lg text-xs font-mono"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-stone-400 mt-5">
        Chaves que tocam login, cobrança, webhooks ou integridade de dados nascem <strong>Protegidas</strong>: desligá-las exige confirmação dupla. Toda alteração fica na Auditoria.
      </p>
    </div>
  )
}
