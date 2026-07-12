import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, RefreshCw, Database, CreditCard, Sparkles, Mail, Globe, CheckCircle2, AlertTriangle, XCircle,
} from 'lucide-react'
import {
  HealthCheckResult, CheckStatus,
  checkSupabaseConnection, checkAdminSession, checkPayments, checkAI, checkAIFallback,
  checkTransactionalEmail, checkSitePublic,
} from '../../lib/systemHealth'

// Painel de Integrações — status AO VIVO (não texto fixo). Cada cartão roda as
// checagens reais da lib systemHealth e mostra OK / Atenção / Erro + detalhe.

interface Integration {
  key: string
  name: string
  desc: string
  Icon: typeof Database
  run: () => Promise<HealthCheckResult[]>
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'supabase', name: 'Supabase', desc: 'Banco de dados e autenticação', Icon: Database,
    run: () => Promise.all([checkSupabaseConnection(), checkAdminSession()]),
  },
  {
    key: 'stripe', name: 'Stripe · Pagamentos', desc: 'Checkout, webhook e gestão de assinatura', Icon: CreditCard,
    run: () => Promise.all([checkPayments()]),
  },
  {
    key: 'ai', name: 'IA', desc: 'Provedor de geração e fallback local', Icon: Sparkles,
    run: () => Promise.all([checkAI(), checkAIFallback()]),
  },
  {
    key: 'email', name: 'E-mail transacional', desc: 'Boas-vindas, avisos e recuperação de senha', Icon: Mail,
    run: () => Promise.all([checkTransactionalEmail()]),
  },
  {
    key: 'hosting', name: 'Site · Hospedagem', desc: 'Frontend publicado (Vercel)', Icon: Globe,
    run: () => Promise.all([checkSitePublic()]),
  },
]

// error > warning > (running) > ok/not_tested
function rollup(results: HealthCheckResult[]): CheckStatus {
  if (results.length === 0) return 'not_tested'
  if (results.some(r => r.status === 'error')) return 'error'
  if (results.some(r => r.status === 'warning')) return 'warning'
  if (results.every(r => r.status === 'ok')) return 'ok'
  return 'not_tested'
}

const STATUS_META: Record<CheckStatus, { label: string; badge: string; Icon: typeof CheckCircle2; dot: string }> = {
  ok:         { label: 'Operacional', badge: 'bg-mint text-forest-700 border-forest-200',  Icon: CheckCircle2,  dot: 'bg-forest-600' },
  warning:    { label: 'Atenção',     badge: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle, dot: 'bg-amber-400' },
  error:      { label: 'Com falha',   badge: 'bg-red-50 text-red-600 border-red-200',       Icon: XCircle,       dot: 'bg-red-500' },
  not_tested: { label: 'Não testado', badge: 'bg-stone-50 text-stone-400 border-line',      Icon: AlertTriangle, dot: 'bg-stone-300' },
  running:    { label: 'Testando',    badge: 'bg-blue-50 text-blue-600 border-blue-200',    Icon: Loader2,       dot: 'bg-blue-400 animate-pulse' },
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca'
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `há ${diff}s`
  if (diff < 3600) return `há ${Math.round(diff / 60)}min`
  return `há ${Math.round(diff / 3600)}h`
}

export default function AdminIntegrations() {
  const [byKey, setByKey] = useState<Record<string, HealthCheckResult[]>>({})
  const [running, setRunning] = useState<Set<string>>(new Set())
  const [lastAt, setLastAt] = useState<string | null>(null)

  const runOne = useCallback(async (integ: Integration) => {
    setRunning(prev => new Set([...prev, integ.key]))
    try {
      const res = await integ.run()
      setByKey(prev => ({ ...prev, [integ.key]: res }))
      setLastAt(new Date().toISOString())
    } catch (e) {
      setByKey(prev => ({ ...prev, [integ.key]: [{ checkKey: integ.key, checkName: integ.name, category: integ.key, status: 'error', errorMessage: String(e) }] }))
    }
    setRunning(prev => { const n = new Set(prev); n.delete(integ.key); return n })
  }, [])

  const runAll = useCallback(() => { INTEGRATIONS.forEach(runOne) }, [runOne])

  useEffect(() => { runAll() }, [runAll])

  const overall = rollup(Object.values(byKey).flat())
  const anyRunning = running.size > 0
  const OverallIcon = STATUS_META[overall].Icon

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl text-forest-900">Integrações</h2>
          <p className="text-sm text-ink-soft mt-0.5">
            Status ao vivo dos serviços que o app usa · último teste {timeAgo(lastAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${STATUS_META[overall].badge}`}>
            <OverallIcon className={`w-4 h-4 ${overall === 'running' ? 'animate-spin' : ''}`} />
            {overall === 'ok' ? 'Tudo operacional' : overall === 'error' ? 'Há falha em integração' : overall === 'warning' ? 'Atenção em integração' : 'Aguardando teste'}
          </span>
          <button
            onClick={runAll}
            disabled={anyRunning}
            className="flex items-center gap-1.5 text-sm bg-forest-900 text-white px-3 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50"
          >
            {anyRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {anyRunning ? 'Testando...' : 'Testar tudo'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map(integ => {
          const results = byKey[integ.key] ?? []
          const isRunning = running.has(integ.key)
          const status: CheckStatus = isRunning && results.length === 0 ? 'running' : rollup(results)
          const meta = STATUS_META[status]
          const Icon = integ.Icon
          return (
            <div key={integ.key} className="bg-white border border-line rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-700 flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-forest-900">{integ.name}</p>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${meta.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft mt-0.5">{integ.desc}</p>

                  {/* Sub-checagens */}
                  <div className="mt-3 space-y-1.5">
                    {results.length === 0 && isRunning && (
                      <p className="text-xs text-stone-400 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Testando…</p>
                    )}
                    {results.map(r => {
                      const rm = STATUS_META[r.status]
                      return (
                        <div key={r.checkKey} className="text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rm.dot}`} />
                            <span className="text-stone-600 flex-1 min-w-0 truncate">{r.checkName}</span>
                            {r.responseTimeMs != null && <span className="text-stone-400">{r.responseTimeMs}ms</span>}
                          </div>
                          {r.errorMessage && <p className="text-[11px] text-red-500 pl-3.5 mt-0.5 leading-snug">{r.errorMessage}</p>}
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => runOne(integ)}
                    disabled={isRunning}
                    className="mt-3 text-xs text-forest-700 hover:text-forest-900 border border-forest-200 px-2.5 py-1 rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Testar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-stone-400 mt-5 leading-relaxed">
        As checagens são não invasivas: não criam cobranças, não enviam e-mails e não alteram dados —
        apenas verificam se cada serviço responde. Para reparos de estrutura do banco, use a aba
        <strong className="text-stone-500"> Saúde do sistema</strong>.
      </p>
    </div>
  )
}
