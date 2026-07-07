import { useEffect, useState, useRef } from 'react'
import {
  Activity, CheckCircle, RefreshCw,
  Loader2, Play, Zap, Database, Sparkles, CreditCard, Bell,
  Shield, ChevronDown, ChevronUp, FileText,
  AlertCircle, Wrench,
} from 'lucide-react'
import {
  HealthCheckResult, SystemIncident, HealthReport, CheckStatus,
  runQuickHealthCheck, runIntermediateHealthCheck, runFullDiagnostic,
  runSingleCheck, saveHealthCheckResults, createHealthReport,
  detectOrUpdateIncident, resolveIncident, ignoreIncident,
  loadIncidents, loadReports, loadLatestChecks,
  autofixCheck, autofixAllChecks, resolveIncidentsByCheckKey, isAutofixable,
} from '../../lib/systemHealth'
import { getActiveProvider, availableProviders, persistActiveProvider, PROVIDER_LABELS, loadActiveProviderFromDB, testProvider, type AIProvider } from '../../lib/aiContent'
import AdminStripeSetup from './AdminStripeSetup'

// ── Tipos ──────────────────────────────────────────────────────────────────────

type HealthTab = 'overview' | 'auto' | 'diagnostic' | 'reports' | 'incidents' | 'settings'

interface MonitorSettings {
  autoEnabled: boolean
  quickIntervalSec: number
  intermediateIntervalSec: number
  testAI: boolean
  testPayments: boolean
  createIncidents: boolean
  maxAIResponseMs: number
  maxDBResponseMs: number
}

const DEFAULT_SETTINGS: MonitorSettings = {
  autoEnabled: true,
  quickIntervalSec: 30,
  intermediateIntervalSec: 300,
  testAI: true,
  testPayments: true,
  createIncidents: true,
  maxAIResponseMs: 8000,
  maxDBResponseMs: 3000,
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<CheckStatus, string> = {
  ok:         'text-forest-700 bg-mint border-forest-200',
  warning:    'text-amber-600 bg-amber-50 border-amber-200',
  error:      'text-red-600 bg-red-50 border-red-200',
  not_tested: 'text-stone-400 bg-stone-50 border-line',
  running:    'text-blue-600 bg-blue-50 border-blue-200',
}

const STATUS_DOT: Record<CheckStatus, string> = {
  ok:         'bg-forest-600',
  warning:    'bg-amber-400',
  error:      'bg-red-500',
  not_tested: 'bg-stone-300',
  running:    'bg-blue-400 animate-pulse',
}

const STATUS_LABEL: Record<CheckStatus, string> = {
  ok:         'Funcionando',
  warning:    'Atenção',
  error:      'Erro',
  not_tested: 'Não testado',
  running:    'Em teste',
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     'text-stone-500 bg-stone-100',
  low:      'text-blue-600 bg-blue-50',
  medium:   'text-amber-600 bg-amber-50',
  high:     'text-orange-600 bg-orange-50',
  critical: 'text-red-600 bg-red-50',
}

const CATEGORY_ICON: Record<string, typeof Database> = {
  database:        Database,
  auth:            Shield,
  site:            Activity,
  ai:              Sparkles,
  payments:        CreditCard,
  notifications:   Bell,
  personalization: Sparkles,
  diary:           FileText,
  questionnaires:  FileText,
  content:         FileText,
  clinical:        Activity,
  support:         AlertCircle,
  security:        Shield,
}

// Orientações para checks que NÃO se corrigem por schema (externos/config).
// Exibidas quando o botão tenta recuperar mas o problema persiste.
const REMEDIATION_HINTS: Record<string, string> = {
  ai_provider: 'IA externa (Pollinations) instável/limitada. O app segue via fallback local. Tente novamente em instantes.',
  ai: 'IA externa instável/limitada. Fallback local ativo — geração do app não para.',
  ai_fallback: 'Fallback local com problema — verifique src/lib de conteúdo IA.',
  payments: 'Checkout é server-side. Confirme se a Edge Function create-checkout está implantada e os secrets Stripe (STRIPE_SECRET_KEY, STRIPE_PRICE_*) configurados no Supabase.',
  site_public: 'Instabilidade de rede/hospedagem. Tente novamente; se persistir, verifique o deploy (Vercel).',
  site: 'Instabilidade de rede/hospedagem.',
  admin_session: 'Sessão expirada. Saia e entre novamente para renovar o token.',
  auth: 'Sessão expirada — refaça login.',
  rls_personalization: 'RLS de personalização bloqueando. Rode o auto-reparo das tabelas de personalização ou revise as policies.',
}

function StatusBadge({ status }: { status: CheckStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {STATUS_LABEL[status]}
    </span>
  )
}

function timeAgo(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `há ${diff}s`
  if (diff < 3600) return `há ${Math.round(diff / 60)}min`
  return `há ${Math.round(diff / 3600)}h`
}

function overallStatus(results: HealthCheckResult[]): CheckStatus {
  if (results.length === 0) return 'not_tested'
  if (results.some(r => r.status === 'error')) return 'error'
  if (results.some(r => r.status === 'warning')) return 'warning'
  if (results.every(r => r.status === 'ok')) return 'ok'
  return 'not_tested'
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminSystemHealth() {
  const [activeTab, setActiveTab] = useState<HealthTab>('overview')
  const [results, setResults] = useState<HealthCheckResult[]>([])
  const [incidents, setIncidents] = useState<SystemIncident[]>([])
  const [reports, setReports] = useState<HealthReport[]>([])
  const [settings, setSettings] = useState<MonitorSettings>(DEFAULT_SETTINGS)
  const [runningKeys, setRunningKeys] = useState<Set<string>>(new Set())
  const [fixingKeys, setFixingKeys] = useState<Set<string>>(new Set())
  const [isFixingAll, setIsFixingAll] = useState(false)
  const [isRunningFull, setIsRunningFull] = useState(false)
  const [isRunningQuick, setIsRunningQuick] = useState(false)
  const [lastQuickAt, setLastQuickAt] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [incidentFilter, setIncidentFilter] = useState('open')
  const intervalQuickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intervalMedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRunningRef = useRef(false)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 4000)
  }

  function mergeResults(newOnes: HealthCheckResult[]) {
    setResults(prev => {
      const map = new Map(prev.map(r => [r.checkKey, r]))
      newOnes.forEach(r => map.set(r.checkKey, r))
      return [...map.values()]
    })
  }

  async function doQuickCheck() {
    if (isRunningRef.current) return
    isRunningRef.current = true
    setIsRunningQuick(true)
    try {
      const res = await runQuickHealthCheck()
      mergeResults(res)
      setLastQuickAt(new Date().toISOString())
      await saveHealthCheckResults(res)
      if (settings.createIncidents) {
        for (const r of res.filter(r => r.status === 'error' || r.status === 'warning')) {
          await detectOrUpdateIncident(r)
        }
      }
    } catch (e) {
      showToast('Erro no teste rápido: ' + String(e), true)
    }
    isRunningRef.current = false
    setIsRunningQuick(false)
  }

  async function doIntermediateCheck() {
    if (isRunningRef.current) return
    isRunningRef.current = true
    try {
      const res = await runIntermediateHealthCheck()
      mergeResults(res)
      await saveHealthCheckResults(res)
      if (settings.createIncidents) {
        for (const r of res.filter(r => r.status === 'error' || r.status === 'warning')) {
          await detectOrUpdateIncident(r)
        }
      }
    } catch { /* silencioso */ }
    isRunningRef.current = false
  }

  async function doFullDiagnostic() {
    if (isRunningFull) return
    setIsRunningFull(true)
    isRunningRef.current = true
    try {
      const res = await runFullDiagnostic()
      mergeResults(res)
      setLastQuickAt(new Date().toISOString())
      await saveHealthCheckResults(res)
      await createHealthReport(res, 'full')
      if (settings.createIncidents) {
        for (const r of res.filter(r => r.status === 'error' || r.status === 'warning')) {
          await detectOrUpdateIncident(r)
        }
      }
      await loadIncidents().then(setIncidents)
      await loadReports().then(setReports)
      showToast(`Diagnóstico completo: ${res.filter(r => r.status === 'ok').length} OK, ${res.filter(r => r.status === 'error').length} erros.`)
    } catch (e) {
      showToast('Erro no diagnóstico: ' + String(e), true)
    }
    isRunningRef.current = false
    setIsRunningFull(false)
  }

  async function doSingleCheck(checkKey: string) {
    setRunningKeys(prev => new Set([...prev, checkKey]))
    try {
      const res = await runSingleCheck(checkKey)
      if (res) {
        mergeResults([res])
        await saveHealthCheckResults([res])
        if (settings.createIncidents && (res.status === 'error' || res.status === 'warning')) {
          await detectOrUpdateIncident(res)
        }
        showToast(`${res.checkName}: ${STATUS_LABEL[res.status]}`)
      }
    } catch (e) {
      showToast('Erro: ' + String(e), true)
    }
    setRunningKeys(prev => { const n = new Set(prev); n.delete(checkKey); return n })
  }

  // Correção com 1 clique. Schema → RPC real no servidor. Externos/config →
  // tenta recuperar com novas tentativas e orienta a correção.
  async function handleAutofix(checkKey: string) {
    if (fixingKeys.has(checkKey)) return
    setFixingKeys(prev => new Set([...prev, checkKey]))
    try {
      if (checkKey === 'ai_provider') {
        // Testa as outras IAs em ORDEM CÍCLICA (começando depois da ativa) e
        // ativa a PRIMEIRA que responder. Antes ia só para alts[0], então
        // oscilava Pollinations↔Gemini e nunca chegava no Groq.
        const active = getActiveProvider()
        const all = availableProviders()
        const start = all.indexOf(active)
        const others: AIProvider[] = start >= 0
          ? [...all.slice(start + 1), ...all.slice(0, start)]
          : all
        if (others.length === 0) {
          showToast('Nenhuma IA alternativa configurada. Adicione VITE_GEMINI_API_KEY ou VITE_GROQ_API_KEY no deploy.', true)
        } else {
          let working: AIProvider | null = null
          for (const p of others) {
            const t = await testProvider(p)
            if (t.ok) { working = p; break }
          }
          const chosen = working ?? others[0]
          await persistActiveProvider(chosen)
          const res = await runSingleCheck('ai_provider')
          if (res) { mergeResults([res]); await saveHealthCheckResults([res]) }
          if (working) {
            await resolveIncidentsByCheckKey('ai_provider')
            await loadIncidents().then(setIncidents)
            showToast(`IA ativa trocada para ${PROVIDER_LABELS[working]} (respondendo).`)
          } else {
            showToast(`Todas as IAs estão limitadas no momento. Ativei ${PROVIDER_LABELS[chosen]}; na geração real o failover tenta as outras automaticamente.`, true)
          }
        }
      } else if (isAutofixable(checkKey)) {
        const fix = await autofixCheck(checkKey)
        if (!fix.success) {
          showToast(fix.fixable ? `Falha no reparo: ${fix.message}` : fix.message, true)
        } else {
          // Reexecuta o teste para confirmar que o erro foi corrigido de fato
          const res = await runSingleCheck(checkKey)
          if (res) {
            mergeResults([res])
            await saveHealthCheckResults([res])
            if (res.status === 'ok' || res.status === 'warning') {
              await resolveIncidentsByCheckKey(checkKey)
              await loadIncidents().then(setIncidents)
              showToast(`Corrigido: ${fix.message}`)
            } else {
              showToast(`Reparo aplicado, mas o teste ainda falha: ${res.errorMessage ?? ''}`, true)
            }
          } else {
            showToast(fix.message)
          }
        }
      } else {
        // Check externo/config: tenta recuperar com até 3 novas tentativas
        let last: HealthCheckResult | null = null
        let recovered = false
        for (let i = 0; i < 3 && !recovered; i++) {
          if (i > 0) await new Promise(r => setTimeout(r, 1500))
          last = await runSingleCheck(checkKey)
          if (last) {
            mergeResults([last])
            if (last.status === 'ok') recovered = true
          }
        }
        if (last) await saveHealthCheckResults([last])
        if (recovered) {
          await resolveIncidentsByCheckKey(checkKey)
          await loadIncidents().then(setIncidents)
          showToast('Recuperado após nova tentativa.')
        } else {
          const hint = REMEDIATION_HINTS[checkKey] ?? REMEDIATION_HINTS[last?.category ?? ''] ?? 'Causa externa ou de configuração — verifique manualmente.'
          const stillWarn = last?.status === 'warning'
          showToast(`${stillWarn ? 'Segue em alerta (degradado): ' : 'Não resolvido automaticamente: '}${hint}`, !stillWarn)
        }
      }
    } catch (e) {
      showToast('Erro ao corrigir: ' + String(e), true)
    }
    setFixingKeys(prev => { const n = new Set(prev); n.delete(checkKey); return n })
  }

  async function handleAutofixAll() {
    if (isFixingAll) return
    setIsFixingAll(true)
    try {
      const res = await autofixAllChecks()
      if (!res.success) {
        showToast('Falha no auto-reparo geral: ' + (res.results[0]?.message ?? ''), true)
      } else {
        // Reexecuta os testes para refletir o resultado real após o reparo
        await doQuickCheck()
        await doIntermediateCheck()
        await loadIncidents().then(setIncidents)
        showToast(`Auto-reparo aplicado em ${res.fixed_count} áreas do banco.`)
      }
    } catch (e) {
      showToast('Erro no auto-reparo geral: ' + String(e), true)
    }
    setIsFixingAll(false)
  }

  async function doAICheck() {
    await doSingleCheck('ai_provider')
    await doSingleCheck('ai_fallback')
  }

  async function doPaymentsCheck() {
    await doSingleCheck('payments')
  }

  async function handleResolveIncident(id: string) {
    await resolveIncident(id)
    await loadIncidents().then(setIncidents)
    showToast('Incidente marcado como resolvido.')
  }

  async function handleIgnoreIncident(id: string) {
    await ignoreIncident(id)
    await loadIncidents().then(setIncidents)
    showToast('Incidente ignorado.')
  }

  // Carregar dados iniciais
  useEffect(() => {
    void (async () => {
      await loadActiveProviderFromDB()
      await Promise.all([
        loadLatestChecks().then(mergeResults),
        loadIncidents().then(setIncidents),
        loadReports().then(setReports),
      ])
      doQuickCheck()
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Intervalos automáticos
  useEffect(() => {
    if (!settings.autoEnabled) return
    intervalQuickRef.current = setInterval(() => { void doQuickCheck() }, settings.quickIntervalSec * 1000)
    intervalMedRef.current = setInterval(() => { void doIntermediateCheck() }, settings.intermediateIntervalSec * 1000)
    return () => {
      if (intervalQuickRef.current) clearInterval(intervalQuickRef.current)
      if (intervalMedRef.current) clearInterval(intervalMedRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoEnabled, settings.quickIntervalSec, settings.intermediateIntervalSec])

  const overall = overallStatus(results)
  const errorCount = results.filter(r => r.status === 'error').length
  const warnCount = results.filter(r => r.status === 'warning').length
  const fixableErrorCount = results.filter(r => r.status === 'error' && isAutofixable(r.checkKey)).length
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating')

  const TABS: { id: HealthTab; label: string }[] = [
    { id: 'overview',    label: 'Visão geral' },
    { id: 'auto',        label: 'Testes automáticos' },
    { id: 'diagnostic',  label: 'Diagnóstico completo' },
    { id: 'reports',     label: 'Relatórios' },
    { id: 'incidents',   label: `Histórico de erros${openIncidents.length > 0 ? ` (${openIncidents.length})` : ''}` },
    { id: 'settings',    label: 'Configurações' },
  ]

  return (
    <div>
      {/* Setup + autoteste do Stripe (server-side; a chave fica nas Edge Functions) */}
      <AdminStripeSetup />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-forest-900'}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-serif text-2xl text-forest-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-forest-700" /> Monitoramento do Sistema
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Saúde e diagnóstico das funcionalidades · {settings.autoEnabled ? `Auto a cada ${settings.quickIntervalSec}s` : 'Manual'}
            {lastQuickAt && ` · último teste ${timeAgo(lastQuickAt)}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {fixableErrorCount > 0 && (
            <button onClick={handleAutofixAll} disabled={isFixingAll} className="flex items-center gap-1.5 text-sm bg-amber-500 text-white px-3 py-2 rounded-lg hover:bg-amber-600 disabled:opacity-50 shadow-sm">
              {isFixingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              {isFixingAll ? 'Corrigindo...' : `Corrigir ${fixableErrorCount} erro${fixableErrorCount !== 1 ? 's' : ''} com 1 clique`}
            </button>
          )}
          <button onClick={doAICheck} disabled={runningKeys.has('ai_provider')} className="flex items-center gap-1.5 text-sm border border-line text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> Testar IA
          </button>
          <button onClick={doQuickCheck} disabled={isRunningQuick} className="flex items-center gap-1.5 text-sm border border-line text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50 disabled:opacity-50">
            {isRunningQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Testar agora
          </button>
          <button onClick={doFullDiagnostic} disabled={isRunningFull} className="flex items-center gap-1.5 text-sm bg-forest-700 text-white px-3 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
            {isRunningFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunningFull ? 'Diagnosticando...' : 'Diagnóstico completo'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b border-line mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`text-sm px-4 py-2.5 border-b-2 transition-colors font-medium whitespace-nowrap ${activeTab === t.id ? 'border-forest-700 text-forest-800' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Visão geral ── */}
      {activeTab === 'overview' && (
        <OverviewTab
          results={results} overall={overall} errorCount={errorCount} warnCount={warnCount}
          openIncidents={openIncidents.length} lastQuickAt={lastQuickAt}
          runningKeys={runningKeys} onSingleCheck={doSingleCheck} expanded={expanded} setExpanded={setExpanded}
          onAutofix={handleAutofix} fixingKeys={fixingKeys}
        />
      )}

      {/* ── Testes automáticos ── */}
      {activeTab === 'auto' && (
        <AutoTab results={results} isRunningQuick={isRunningQuick} onQuickCheck={doQuickCheck} lastAt={lastQuickAt} />
      )}

      {/* ── Diagnóstico completo ── */}
      {activeTab === 'diagnostic' && (
        <DiagnosticTab results={results} isRunning={isRunningFull} onRun={doFullDiagnostic} onAI={doAICheck} onPayments={doPaymentsCheck} runningKeys={runningKeys} onSingleCheck={doSingleCheck} />
      )}

      {/* ── Relatórios ── */}
      {activeTab === 'reports' && (
        <ReportsTab reports={reports} onRefresh={() => loadReports().then(setReports)} />
      )}

      {/* ── Histórico de erros ── */}
      {activeTab === 'incidents' && (
        <IncidentsTab incidents={incidents} filter={incidentFilter} setFilter={setIncidentFilter} onResolve={handleResolveIncident} onIgnore={handleIgnoreIncident} onRetest={doSingleCheck} onRefresh={() => loadIncidents().then(setIncidents)} onAutofix={handleAutofix} fixingKeys={fixingKeys} />
      )}

      {/* ── Configurações ── */}
      {activeTab === 'settings' && (
        <SettingsTab settings={settings} onChange={setSettings} />
      )}
    </div>
  )
}

// ── Aba Visão Geral ───────────────────────────────────────────────────────────

function OverviewTab({ results, overall, errorCount, warnCount, openIncidents, lastQuickAt, runningKeys, onSingleCheck, expanded, setExpanded, onAutofix, fixingKeys }: {
  results: HealthCheckResult[]
  overall: CheckStatus
  errorCount: number
  warnCount: number
  openIncidents: number
  lastQuickAt: string | null
  runningKeys: Set<string>
  onSingleCheck: (key: string) => void
  expanded: string | null
  setExpanded: (k: string | null) => void
  onAutofix: (key: string) => void
  fixingKeys: Set<string>
}) {
  const aiResult = results.find(r => r.checkKey === 'ai_provider')
  const payResult = results.find(r => r.checkKey === 'payments')
  const dbResult = results.find(r => r.checkKey === 'supabase_conn')
  const notifResult = results.find(r => r.checkKey === 'db_notifications')

  const summaryCards = [
    { label: 'Status geral', value: STATUS_LABEL[overall], color: STATUS_DOT[overall], bg: overall === 'ok' ? 'bg-mint' : overall === 'error' ? 'bg-red-50' : 'bg-amber-50' },
    { label: 'Último teste', value: lastQuickAt ? timeAgo(lastQuickAt) : 'nunca', color: 'bg-stone-300', bg: 'bg-stone-50' },
    { label: 'Erros críticos', value: String(errorCount), color: errorCount > 0 ? 'bg-red-500' : 'bg-forest-600', bg: errorCount > 0 ? 'bg-red-50' : 'bg-mint' },
    { label: 'Alertas', value: String(warnCount), color: warnCount > 0 ? 'bg-amber-400' : 'bg-forest-600', bg: warnCount > 0 ? 'bg-amber-50' : 'bg-mint' },
    { label: 'IA', value: aiResult ? STATUS_LABEL[aiResult.status] : '—', color: aiResult ? STATUS_DOT[aiResult.status] : 'bg-stone-300', bg: 'bg-stone-50' },
    { label: 'Pagamentos', value: payResult ? STATUS_LABEL[payResult.status] : '—', color: payResult ? STATUS_DOT[payResult.status] : 'bg-stone-300', bg: 'bg-stone-50' },
    { label: 'Banco de dados', value: dbResult ? STATUS_LABEL[dbResult.status] : '—', color: dbResult ? STATUS_DOT[dbResult.status] : 'bg-stone-300', bg: 'bg-stone-50' },
    { label: 'Notificações', value: notifResult ? STATUS_LABEL[notifResult.status] : '—', color: notifResult ? STATUS_DOT[notifResult.status] : 'bg-stone-300', bg: 'bg-stone-50' },
    { label: 'Incidentes abertos', value: String(openIncidents), color: openIncidents > 0 ? 'bg-red-500' : 'bg-forest-600', bg: openIncidents > 0 ? 'bg-red-50' : 'bg-mint' },
  ]

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {summaryCards.map(c => (
          <div key={c.label} className={`${c.bg} rounded-xl p-3 text-center`}>
            <div className={`w-2 h-2 rounded-full ${c.color} mx-auto mb-1`} />
            <p className="text-xs font-bold text-forest-900 truncate">{c.value}</p>
            <p className="text-[10px] text-stone-500 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tabela de funcionalidades */}
      <div className="bg-white rounded-xl border border-line overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h2 className="font-semibold text-forest-900 text-sm">Funcionalidades</h2>
          <span className="text-xs text-stone-400">{results.length} verificações</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-stone-50">
                {['Área', 'Status', 'Última verificação', 'Tempo resp.', 'Ação'].map(h => (
                  <th key={h} className="py-2.5 px-4 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-stone-400 text-sm">Nenhum teste executado ainda.</td></tr>
              )}
              {results.map(r => {
                const Icon = CATEGORY_ICON[r.category] ?? Activity
                const isExpanded = expanded === r.checkKey
                return (
                  <>
                    <tr key={r.checkKey} className="border-b border-line hover:bg-stone-50/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                          <span className="text-sm text-stone-700 font-medium">{r.checkName}</span>
                        </div>
                        {r.errorMessage && <p className="text-xs text-red-500 mt-0.5 pl-5 truncate max-w-xs">{r.errorMessage}</p>}
                      </td>
                      <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
                      <td className="py-3 px-4 text-xs text-stone-500 whitespace-nowrap">agora</td>
                      <td className="py-3 px-4 text-xs text-stone-500 whitespace-nowrap">
                        {r.responseTimeMs != null ? `${r.responseTimeMs}ms` : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {(r.status === 'error' || r.status === 'warning') && (
                            <button
                              onClick={() => onAutofix(r.checkKey)}
                              disabled={fixingKeys.has(r.checkKey)}
                              title={isAutofixable(r.checkKey) ? 'Corrige o problema criando/ajustando o schema no banco' : 'Tenta recuperar o serviço e mostra a orientação de correção'}
                              className="flex items-center gap-1 text-xs text-white bg-amber-500 hover:bg-amber-600 px-2 py-1 rounded-lg disabled:opacity-50 whitespace-nowrap"
                            >
                              {fixingKeys.has(r.checkKey) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                              {isAutofixable(r.checkKey) ? 'Corrigir' : 'Tentar corrigir'}
                            </button>
                          )}
                          <button onClick={() => onSingleCheck(r.checkKey)} className="text-xs text-forest-700 hover:text-forest-800 border border-forest-200 px-2 py-1 rounded-lg">
                            {runningKeys.has(r.checkKey) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Testar'}
                          </button>
                          {(r.details || r.errorMessage) && (
                            <button onClick={() => setExpanded(isExpanded ? null : r.checkKey)} className="text-xs text-stone-400 hover:text-stone-600 px-1">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={r.checkKey + '-detail'} className="border-b border-line bg-stone-50">
                        <td colSpan={5} className="px-4 pb-3 pt-1">
                          <div className="bg-white rounded-lg border border-line p-3 text-xs text-stone-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {r.errorMessage && <p className="text-red-500 mb-1">Erro: {r.errorMessage}</p>}
                            {r.details && JSON.stringify(r.details, null, 2)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Aba Testes Automáticos ────────────────────────────────────────────────────

function AutoTab({ results, isRunningQuick, onQuickCheck, lastAt }: {
  results: HealthCheckResult[]
  isRunningQuick: boolean
  onQuickCheck: () => void
  lastAt: string | null
}) {
  const quickKeys = ['site_public', 'admin_session', 'supabase_conn', 'db_notifications', 'db_pers_tasks', 'db_pers_deliveries', 'db_diary', 'db_articles', 'payments']
  const quickResults = results.filter(r => quickKeys.includes(r.checkKey))
  const interKeys = ['db_questionnaires', 'db_trails', 'db_guidance', 'db_sessions', 'db_reports', 'db_support', 'db_saved', 'rls_personalization', 'drafts_dryrun', 'ai_fallback']
  const interResults = results.filter(r => interKeys.includes(r.checkKey))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onQuickCheck} disabled={isRunningQuick} className="flex items-center gap-2 text-sm bg-forest-900 text-white px-4 py-2 rounded-lg hover:bg-forest-900 disabled:opacity-50">
          {isRunningQuick ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Rodar teste rápido agora
        </button>
        {lastAt && <span className="text-xs text-stone-400">Último: {timeAgo(lastAt)}</span>}
      </div>

      <CheckGroup title="Teste rápido (a cada 30s)" subtitle="Leve, não invasivo, sem IA ou pagamentos reais" results={quickResults} />
      <CheckGroup title="Teste intermediário (a cada 5min)" subtitle="Verifica fluxos mais profundos, tabelas clínicas e RLS" results={interResults} />
    </div>
  )
}

function CheckGroup({ title, subtitle, results }: { title: string; subtitle: string; results: HealthCheckResult[] }) {
  return (
    <div className="bg-white rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line bg-stone-50">
        <h3 className="text-sm font-semibold text-forest-900">{title}</h3>
        <p className="text-xs text-stone-400">{subtitle}</p>
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {results.length === 0 && <p className="text-xs text-stone-400 py-4 col-span-3 text-center">Nenhum teste deste grupo executado ainda.</p>}
        {results.map(r => (
          <div key={r.checkKey} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${STATUS_COLOR[r.status]}`}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[r.status]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.checkName}</p>
              {r.responseTimeMs != null && <p className="text-[10px] opacity-70">{r.responseTimeMs}ms</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Aba Diagnóstico ───────────────────────────────────────────────────────────

function DiagnosticTab({ results, isRunning, onRun, onAI, onPayments, runningKeys, onSingleCheck }: {
  results: HealthCheckResult[]
  isRunning: boolean
  onRun: () => void
  onAI: () => void
  onPayments: () => void
  runningKeys: Set<string>
  onSingleCheck: (key: string) => void
}) {
  const categories = [...new Set(results.map(r => r.category))]

  return (
    <div className="space-y-5">
      <div className="bg-stone-50 border border-line rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-forest-900">Diagnóstico completo</p>
        <p className="text-sm text-stone-500">Executa todos os testes, incluindo IA e verificações de segurança. Pode levar até 60 segundos.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={onRun} disabled={isRunning} className="flex items-center gap-2 bg-forest-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-forest-800 disabled:opacity-50">
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Diagnosticando...' : 'Rodar diagnóstico completo agora'}
          </button>
          <button onClick={onAI} disabled={runningKeys.has('ai_provider')} className="flex items-center gap-2 border border-line text-stone-600 text-sm px-3 py-2 rounded-lg hover:bg-stone-100 disabled:opacity-50">
            <Sparkles className="w-4 h-4" /> Testar IA
          </button>
          <button onClick={onPayments} disabled={runningKeys.has('payments')} className="flex items-center gap-2 border border-line text-stone-600 text-sm px-3 py-2 rounded-lg hover:bg-stone-100 disabled:opacity-50">
            <CreditCard className="w-4 h-4" /> Testar Pagamentos Sandbox
          </button>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">Sem cobranças reais · Sem notificações para usuários · Sem criação de dados em produção</p>
      </div>

      {results.length > 0 && categories.map(cat => {
        const catResults = results.filter(r => r.category === cat)
        const Icon = CATEGORY_ICON[cat] ?? Activity
        return (
          <div key={cat} className="bg-white rounded-xl border border-line overflow-hidden">
            <div className="px-4 py-2.5 border-b border-line bg-stone-50 flex items-center gap-2">
              <Icon className="w-4 h-4 text-stone-400" />
              <h3 className="text-sm font-semibold text-stone-700 capitalize">{cat}</h3>
              <span className="text-xs text-stone-400 ml-auto">{catResults.length} itens</span>
            </div>
            <div className="divide-y divide-stone-100">
              {catResults.map(r => (
                <div key={r.checkKey} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50/50">
                  <StatusBadge status={r.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700">{r.checkName}</p>
                    {r.errorMessage && <p className="text-xs text-red-500 truncate">{r.errorMessage}</p>}
                  </div>
                  {r.responseTimeMs != null && <span className="text-xs text-stone-400 whitespace-nowrap">{r.responseTimeMs}ms</span>}
                  <button onClick={() => onSingleCheck(r.checkKey)} className="text-xs text-stone-400 hover:text-forest-700 whitespace-nowrap">
                    {runningKeys.has(r.checkKey) ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Retestar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Aba Relatórios ────────────────────────────────────────────────────────────

function ReportsTab({ reports, onRefresh }: { reports: HealthReport[]; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">{reports.length} relatório{reports.length !== 1 ? 's' : ''}</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs border border-line text-stone-500 px-2 py-1.5 rounded-lg hover:bg-stone-50"><RefreshCw className="w-3 h-3" /> Atualizar</button>
      </div>
      {reports.length === 0 && <p className="text-center py-12 text-stone-400 text-sm">Nenhum relatório gerado ainda. Rode o diagnóstico completo.</p>}
      {reports.map(r => {
        const isExp = expanded === r.id
        const total = r.total_checks
        return (
          <div key={r.id} className="bg-white rounded-xl border border-line overflow-hidden">
            <button className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-stone-50" onClick={() => setExpanded(isExp ? null : r.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-stone-500 capitalize">{r.report_type}</span>
                  <span className="text-xs text-stone-400">{new Date(r.created_at).toLocaleString('pt-BR')}</span>
                </div>
                <p className="text-sm text-stone-700">{r.summary}</p>
                <div className="flex gap-3 mt-1.5 text-xs">
                  <span className="text-forest-700">{r.ok_count} OK</span>
                  {r.warning_count > 0 && <span className="text-amber-600">{r.warning_count} alertas</span>}
                  {r.error_count > 0 && <span className="text-red-600">{r.error_count} erros</span>}
                  {r.critical_count > 0 && <span className="text-red-700 font-medium">{r.critical_count} críticos</span>}
                  <span className="text-stone-400">{total} total</span>
                </div>
              </div>
              {isExp ? <ChevronUp className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />}
            </button>
            {isExp && Array.isArray((r.details as Record<string, unknown>)?.results) && (
              <div className="border-t border-line px-4 pb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-2 max-h-60 overflow-y-auto">
                  {((r.details as Record<string, unknown>).results as Record<string, unknown>[]).map((item) => (
                    <div key={String(item.key)} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 border ${STATUS_COLOR[item.status as CheckStatus] ?? ''}`}>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[item.status as CheckStatus] ?? 'bg-stone-300'}`} />
                      <span className="truncate">{String(item.key)}</span>
                      {item.ms != null && <span className="ml-auto text-[10px] opacity-60">{String(item.ms)}ms</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Aba Incidentes ────────────────────────────────────────────────────────────

function IncidentsTab({ incidents, filter, setFilter, onResolve, onIgnore, onRetest, onRefresh, onAutofix, fixingKeys }: {
  incidents: SystemIncident[]
  filter: string
  setFilter: (f: string) => void
  onResolve: (id: string) => void
  onIgnore: (id: string) => void
  onRetest: (key: string) => void
  onRefresh: () => void
  onAutofix: (key: string) => void
  fixingKeys: Set<string>
}) {
  const filtered = incidents.filter(i => filter === 'all' ? true : i.status === filter)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {[['all', 'Todos'], ['open', 'Abertos'], ['investigating', 'Investigando'], ['resolved', 'Resolvidos'], ['ignored', 'Ignorados']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`text-xs px-3 py-1.5 rounded-lg border ${filter === v ? 'bg-forest-900 text-white border-stone-800' : 'border-line text-stone-600 hover:bg-stone-50'}`}>{l}</button>
        ))}
        <button onClick={onRefresh} className="ml-auto flex items-center gap-1 text-xs border border-line text-stone-500 px-2 py-1.5 rounded-lg hover:bg-stone-50"><RefreshCw className="w-3 h-3" /> Atualizar</button>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-14">
          <CheckCircle className="w-10 h-10 mx-auto mb-3 text-forest-200" />
          <p className="text-sm text-stone-400">Nenhum incidente {filter !== 'all' ? `com status "${filter}"` : ''}.</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-line overflow-hidden">
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-stone-50">
                  {['Data', 'Área', 'Título', 'Gravidade', 'Ocorrências', 'Status', 'Ações'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left text-xs font-semibold text-stone-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(inc => (
                  <tr key={inc.id} className="border-b border-line hover:bg-stone-50/50">
                    <td className="py-3 px-4 text-xs text-stone-500 whitespace-nowrap">{new Date(inc.first_detected_at).toLocaleDateString('pt-BR')}</td>
                    <td className="py-3 px-4 text-xs text-stone-600 font-mono">{inc.check_key ?? '—'}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-stone-700 font-medium">{inc.title}</p>
                      {inc.description && <p className="text-xs text-stone-400 truncate max-w-xs">{inc.description}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLOR[inc.severity] ?? ''}`}>{inc.severity}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600">{inc.occurrences}x</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${inc.status === 'open' ? 'bg-red-50 text-red-600 border-red-200' : inc.status === 'resolved' ? 'bg-mint text-forest-700 border-forest-200' : 'bg-stone-100 text-stone-500 border-line'}`}>{inc.status}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {inc.check_key && inc.status !== 'resolved' && (
                          <button
                            onClick={() => onAutofix(inc.check_key!)}
                            disabled={fixingKeys.has(inc.check_key)}
                            title={isAutofixable(inc.check_key) ? 'Corrige criando/ajustando o schema no banco' : 'Tenta recuperar o serviço e orienta a correção'}
                            className="flex items-center gap-1 text-xs text-white bg-amber-500 hover:bg-amber-600 px-1.5 py-0.5 rounded disabled:opacity-50 whitespace-nowrap"
                          >
                            {fixingKeys.has(inc.check_key) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
                            {isAutofixable(inc.check_key) ? 'Corrigir' : 'Tentar corrigir'}
                          </button>
                        )}
                        {inc.check_key && (
                          <button onClick={() => onRetest(inc.check_key!)} className="text-xs text-forest-700 hover:text-forest-800 border border-forest-200 px-1.5 py-0.5 rounded">Retestar</button>
                        )}
                        {inc.status !== 'resolved' && (
                          <button onClick={() => onResolve(inc.id)} className="text-xs text-stone-600 hover:text-forest-900 border border-line px-1.5 py-0.5 rounded">Resolver</button>
                        )}
                        {inc.status === 'open' && (
                          <button onClick={() => onIgnore(inc.id)} className="text-xs text-stone-400 hover:text-stone-600 px-1.5 py-0.5 rounded">Ignorar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Aba Configurações ─────────────────────────────────────────────────────────

function SettingsTab({ settings, onChange }: { settings: MonitorSettings; onChange: (s: MonitorSettings) => void }) {
  function set<K extends keyof MonitorSettings>(key: K, value: MonitorSettings[K]) {
    onChange({ ...settings, [key]: value })
  }

  const inputCls = 'px-3 py-2 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-white rounded-xl border border-line p-5 space-y-4">
        <h2 className="font-semibold text-forest-900">Monitoramento automático</h2>
        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm text-stone-700">Ativar monitoramento automático</p>
            <p className="text-xs text-stone-400">Executa testes em segundo plano enquanto você está no admin</p>
          </div>
          <button onClick={() => set('autoEnabled', !settings.autoEnabled)} className={`w-11 h-6 rounded-full transition-colors relative ${settings.autoEnabled ? 'bg-forest-600' : 'bg-stone-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings.autoEnabled ? 'left-5' : 'left-0.5'}`} />
          </button>
        </label>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Intervalo do teste rápido (segundos)</label>
            <input type="number" min={10} max={300} value={settings.quickIntervalSec} onChange={e => set('quickIntervalSec', Number(e.target.value))} className={inputCls + ' w-28'} />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Intervalo do teste intermediário (segundos)</label>
            <input type="number" min={60} max={3600} value={settings.intermediateIntervalSec} onChange={e => set('intermediateIntervalSec', Number(e.target.value))} className={inputCls + ' w-28'} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-line p-5 space-y-4">
        <h2 className="font-semibold text-forest-900">Testes específicos</h2>
        {([
          ['testAI', 'Ativar teste de IA', 'Testa a Pollinations.ai nos testes intermediários/completos'],
          ['testPayments', 'Ativar verificação de pagamento (sandbox)', 'Verifica configuração, não cria cobranças reais'],
          ['createIncidents', 'Criar incidentes automaticamente ao detectar erros', ''],
        ] as [keyof MonitorSettings, string, string][]).map(([key, label, desc]) => (
          <label key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-700">{label}</p>
              {desc && <p className="text-xs text-stone-400">{desc}</p>}
            </div>
            <button onClick={() => set(key, !settings[key])} className={`w-11 h-6 rounded-full transition-colors relative ${settings[key] ? 'bg-forest-600' : 'bg-stone-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${settings[key] ? 'left-5' : 'left-0.5'}`} />
            </button>
          </label>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-line p-5 space-y-4">
        <h2 className="font-semibold text-forest-900">Limites de tempo</h2>
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Resp. IA máxima (ms)</label>
            <input type="number" min={1000} max={30000} value={settings.maxAIResponseMs} onChange={e => set('maxAIResponseMs', Number(e.target.value))} className={inputCls + ' w-28'} />
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Resp. banco máxima (ms)</label>
            <input type="number" min={100} max={10000} value={settings.maxDBResponseMs} onChange={e => set('maxDBResponseMs', Number(e.target.value))} className={inputCls + ' w-28'} />
          </div>
        </div>
        <p className="text-xs text-stone-400">Configurações são salvas localmente no navegador por enquanto.</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium mb-1">Usuários de teste</p>
        <p className="text-xs">Para diagnósticos completos com dados isolados, configure usuários de teste no banco:</p>
        <ul className="text-xs mt-1 space-y-0.5 font-mono">
          {['teste.gratuito', 'teste.essencial', 'teste.terapeutico', 'teste.plus'].map(u => (
            <li key={u}>• {u}@avida-nao-colabora.com</li>
          ))}
        </ul>
        <p className="text-xs mt-2 text-amber-600">Se não existirem, alguns testes do diagnóstico completo serão ignorados automaticamente.</p>
      </div>
    </div>
  )
}
