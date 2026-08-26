import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, CheckCircle, ChevronDown, Database, Loader2,
  RefreshCw, Shield, Sparkles, CreditCard, Bell, Clock, Wrench,
} from 'lucide-react'
import {
  loadLatestChecks,
  runQuickHealthCheck,
  saveHealthCheckResults,
  type CheckStatus,
  type HealthCheckResult,
} from '../../lib/systemHealth'
import AdminSystemHealth from './AdminSystemHealth'

type FriendlyCategory = 'availability' | 'product' | 'ai' | 'payments' | 'communication' | 'automations' | 'security'

const CATEGORY_META: Record<FriendlyCategory, { label: string; description: string; icon: typeof Activity }> = {
  availability: { label: 'Site e dados', description: 'Disponibilidade do site, sessão administrativa e conexão com os dados.', icon: Database },
  product: { label: 'Recursos do produto', description: 'Diário, questionários, relatórios, suporte, artigos e personalização.', icon: Activity },
  ai: { label: 'Inteligência artificial', description: 'Provedores de IA e a rede de segurança quando a IA externa falha.', icon: Sparkles },
  payments: { label: 'Pagamentos', description: 'Configuração e disponibilidade do fluxo de assinatura.', icon: CreditCard },
  communication: { label: 'Comunicação', description: 'Notificações e recursos que avisam o usuário.', icon: Bell },
  automations: { label: 'Automações', description: 'Rotinas editoriais, emocionais e filas que funcionam automaticamente.', icon: Clock },
  security: { label: 'Acesso e segurança', description: 'Sessão administrativa e proteções de acesso aos dados.', icon: Shield },
}

const FRIENDLY_CHECK_NAMES: Record<string, string> = {
  site_public: 'Site disponível para visitantes',
  admin_session: 'Acesso administrativo',
  supabase_conn: 'Conexão com o banco de dados',
  db_profiles: 'Perfis de usuários',
  db_notifications: 'Notificações',
  db_diary: 'Diário emocional',
  db_questionnaires: 'Questionários',
  db_articles: 'Artigos e conteúdos',
  db_pers_tasks: 'Fila de personalização',
  db_pers_deliveries: 'Entregas personalizadas',
  db_guidance: 'Orientações mensais',
  db_reports: 'Relatórios emocionais',
  db_support: 'Suporte ao usuário',
  db_saved: 'Itens salvos',
  rls_personalization: 'Proteção dos dados de personalização',
  drafts_dryrun: 'Criação segura de rascunhos',
  ai_provider: 'Provedor principal de IA',
  ai_fallback: 'Rede de segurança da IA',
  payments: 'Fluxo de pagamentos',
  automation_emotional: 'Automação de relatórios e autocuidado',
  automation_editorial: 'Automação editorial',
  operational_metrics: 'Filas e qualidade operacional',
}

const FRIENDLY_IMPACT: Record<string, string> = {
  site_public: 'Indica se o público consegue abrir o site normalmente.',
  admin_session: 'Indica se sua sessão de administrador continua válida.',
  supabase_conn: 'Indica se o aplicativo consegue consultar os dados necessários.',
  db_notifications: 'Afeta avisos exibidos dentro do produto.',
  db_diary: 'Afeta leitura e gravação dos registros do diário.',
  db_questionnaires: 'Afeta respostas e histórico dos questionários.',
  db_articles: 'Afeta publicação e leitura de conteúdos.',
  db_pers_tasks: 'Afeta a fila de entregas personalizadas do Admin.',
  db_pers_deliveries: 'Afeta rascunhos e envios personalizados.',
  db_guidance: 'Afeta solicitações e respostas de orientação mensal.',
  db_reports: 'Afeta disponibilidade dos relatórios emocionais.',
  db_support: 'Afeta tickets e mensagens de suporte.',
  ai_provider: 'Se houver alerta, o sistema ainda pode tentar outro provedor automaticamente.',
  ai_fallback: 'É a proteção usada quando nenhum provedor externo responde.',
  payments: 'Afeta novas assinaturas ou mudanças de plano.',
  automation_emotional: 'Afeta geração automática de relatórios, planos e avisos relacionados.',
  automation_editorial: 'Afeta regras automáticas de geração e planejamento editorial.',
  operational_metrics: 'Resume filas ou falhas recentes que merecem revisão.',
}

const STATUS_META: Record<CheckStatus, { label: string; explanation: string; className: string }> = {
  ok: { label: 'Funcionando', explanation: 'Nenhum problema detectado nesta verificação.', className: 'bg-mint text-forest-800 border-forest-200' },
  warning: { label: 'Precisa de atenção', explanation: 'O recurso funciona, mas há degradação ou algo para revisar.', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Com problema', explanation: 'A falha pode afetar esta parte do produto.', className: 'bg-red-50 text-red-700 border-red-200' },
  not_tested: { label: 'Ainda não verificado', explanation: 'Ainda não há resultado recente para esta verificação.', className: 'bg-stone-50 text-stone-500 border-line' },
  running: { label: 'Verificando', explanation: 'O teste está sendo executado agora.', className: 'bg-blue-50 text-blue-700 border-blue-200' },
}

function friendlyCategory(result: HealthCheckResult): FriendlyCategory {
  if (result.category === 'ai') return 'ai'
  if (result.category === 'payments') return 'payments'
  if (result.category === 'notifications') return 'communication'
  if (result.category === 'automations') return 'automations'
  if (result.category === 'security' || result.category === 'auth') return 'security'
  if (result.category === 'site' || result.category === 'database') return 'availability'
  return 'product'
}

function friendlyName(result: HealthCheckResult): string {
  return FRIENDLY_CHECK_NAMES[result.checkKey] ?? result.checkName
}

function mergeChecks(current: HealthCheckResult[], incoming: HealthCheckResult[]): HealthCheckResult[] {
  const map = new Map(current.map(result => [result.checkKey, result]))
  incoming.forEach(result => map.set(result.checkKey, result))
  return [...map.values()]
}

function overallStatus(results: HealthCheckResult[]): CheckStatus {
  if (!results.length) return 'not_tested'
  if (results.some(result => result.status === 'error')) return 'error'
  if (results.some(result => result.status === 'warning')) return 'warning'
  if (results.some(result => result.status === 'running')) return 'running'
  if (results.every(result => result.status === 'ok')) return 'ok'
  return 'not_tested'
}

function StatusPill({ status }: { status: CheckStatus }) {
  const meta = STATUS_META[status]
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>{meta.label}</span>
}

export default function AdminSystemHealthFriendly() {
  const [results, setResults] = useState<HealthCheckResult[]>([])
  const [loading, setLoading] = useState(true)
  const [technicalOpen, setTechnicalOpen] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const latest = await loadLatestChecks()
      setResults(latest)
      const quick = await runQuickHealthCheck()
      setResults(current => mergeChecks(current, quick))
      await saveHealthCheckResults(quick)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  const overall = overallStatus(results)
  const grouped = useMemo(() => {
    const groups = new Map<FriendlyCategory, HealthCheckResult[]>()
    for (const result of results) {
      const category = friendlyCategory(result)
      groups.set(category, [...(groups.get(category) ?? []), result])
    }
    return [...groups.entries()].sort(([a], [b]) => CATEGORY_META[a].label.localeCompare(CATEGORY_META[b].label, 'pt-BR'))
  }, [results])

  const errors = results.filter(result => result.status === 'error').length
  const warnings = results.filter(result => result.status === 'warning').length
  const overallMessage = overall === 'ok'
    ? 'As áreas verificadas estão funcionando normalmente.'
    : overall === 'error'
      ? 'Há falhas que podem afetar partes do produto e precisam de revisão.'
      : overall === 'warning'
        ? 'O produto está disponível, mas há pontos que merecem atenção.'
        : overall === 'running'
          ? 'As verificações estão sendo atualizadas.'
          : 'Ainda não há verificações suficientes para resumir a saúde do sistema.'

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl text-forest-900 flex items-center gap-2"><Activity className="w-6 h-6 text-forest-700" /> Saúde do sistema</h2>
          <p className="text-sm text-ink-soft mt-1">Veja primeiro o impacto no produto. Nomes técnicos, códigos e respostas brutas ficam nos detalhes.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 border border-line bg-white px-3 py-2 rounded-xl text-sm text-forest-800 hover:border-forest-300 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar status
        </button>
      </div>

      <section className={`rounded-2xl border p-5 ${STATUS_META[overall].className}`} aria-live="polite">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {overall === 'error' ? <AlertTriangle className="w-6 h-6 mt-0.5" /> : overall === 'ok' ? <CheckCircle className="w-6 h-6 mt-0.5" /> : <Activity className="w-6 h-6 mt-0.5" />}
            <div>
              <p className="font-semibold">{STATUS_META[overall].label}</p>
              <p className="text-sm mt-0.5 opacity-90">{overallMessage}</p>
              {error && <p className="text-xs mt-2">Não foi possível atualizar agora: {error}</p>}
            </div>
          </div>
          <div className="flex gap-4 text-center">
            <div><p className="text-xl font-bold">{errors}</p><p className="text-[10px] opacity-75">com problema</p></div>
            <div><p className="text-xl font-bold">{warnings}</p><p className="text-[10px] opacity-75">em atenção</p></div>
            <div><p className="text-xl font-bold">{results.length}</p><p className="text-[10px] opacity-75">verificações</p></div>
          </div>
        </div>
      </section>

      {loading && results.length === 0 ? (
        <div className="py-14 flex items-center justify-center text-sm text-ink-soft gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Verificando as áreas principais…</div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([category, categoryResults]) => {
            const meta = CATEGORY_META[category]
            const Icon = meta.icon
            const categoryStatus = overallStatus(categoryResults)
            return (
              <section key={category} className="bg-white border border-line rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-line bg-stone-50/70 flex flex-wrap items-center gap-3">
                  <Icon className="w-4 h-4 text-forest-700" />
                  <div className="flex-1 min-w-[180px]">
                    <h3 className="text-sm font-semibold text-forest-900">{meta.label}</h3>
                    <p className="text-xs text-stone-400">{meta.description}</p>
                  </div>
                  <StatusPill status={categoryStatus} />
                </div>
                <div className="divide-y divide-line">
                  {categoryResults.map(result => {
                    const statusMeta = STATUS_META[result.status]
                    return (
                      <div key={result.checkKey} className="px-4 py-3">
                        <div className="flex flex-wrap items-start gap-3">
                          <div className="flex-1 min-w-[220px]">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-stone-700">{friendlyName(result)}</p>
                              <StatusPill status={result.status} />
                            </div>
                            <p className="text-xs text-stone-500 mt-1">{FRIENDLY_IMPACT[result.checkKey] ?? statusMeta.explanation}</p>
                            {(result.status === 'warning' || result.status === 'error') && result.errorMessage && (
                              <p className={`text-xs mt-1.5 ${result.status === 'error' ? 'text-red-600' : 'text-amber-700'}`}>Motivo detectado: {result.errorMessage}</p>
                            )}
                          </div>
                          {result.responseTimeMs != null && <span className="text-[11px] text-stone-400">Resposta: {result.responseTimeMs} ms</span>}
                        </div>
                        <details className="mt-2 text-xs">
                          <summary className="cursor-pointer inline-flex items-center gap-1 text-stone-400 hover:text-stone-600 select-none"><ChevronDown className="w-3 h-3" /> Detalhe técnico</summary>
                          <div className="mt-2 rounded-xl bg-stone-50 border border-line p-3 text-stone-600 space-y-1">
                            <p><strong>Nome técnico:</strong> {result.checkName}</p>
                            <p><strong>Chave:</strong> <code>{result.checkKey}</code></p>
                            <p><strong>Categoria técnica:</strong> <code>{result.category}</code></p>
                            {result.responseTimeMs != null && <p><strong>Tempo de resposta:</strong> {result.responseTimeMs} ms</p>}
                            {result.errorMessage && <p className="text-red-600"><strong>Erro bruto:</strong> {result.errorMessage}</p>}
                            {result.details && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(result.details, null, 2)}</pre>}
                          </div>
                        </details>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="border border-line rounded-2xl bg-white overflow-hidden">
        <button type="button" onClick={() => setTechnicalOpen(open => !open)} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-stone-50">
          <Wrench className="w-4 h-4 text-stone-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-stone-700">Diagnóstico técnico e ferramentas de reparo</p>
            <p className="text-xs text-stone-400">Abra somente quando precisar retestar, reparar, consultar incidentes, relatórios ou configurações avançadas.</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${technicalOpen ? 'rotate-180' : ''}`} />
        </button>
        {technicalOpen && <div className="border-t border-line"><AdminSystemHealth /></div>}
      </section>
    </div>
  )
}
