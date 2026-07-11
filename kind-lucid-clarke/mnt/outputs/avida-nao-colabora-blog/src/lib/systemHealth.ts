import { supabase } from './supabase'
import { getActiveProvider, availableProviders, testProvider, PROVIDER_LABELS } from './aiContent'

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type CheckStatus = 'ok' | 'warning' | 'error' | 'not_tested' | 'running'
export type CheckSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'

export interface HealthCheckResult {
  checkKey: string
  checkName: string
  category: string
  status: CheckStatus
  responseTimeMs?: number
  errorMessage?: string
  details?: Record<string, unknown>
  severity?: CheckSeverity
}

export interface SystemIncident {
  id: string
  check_key: string | null
  title: string
  description: string | null
  severity: string
  status: string
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
  occurrences: number
  details: Record<string, unknown>
}

export interface HealthReport {
  id: string
  report_type: string
  summary: string | null
  total_checks: number
  ok_count: number
  warning_count: number
  error_count: number
  critical_count: number
  details: Record<string, unknown>
  created_at: string
}

// ── Timeouts ──────────────────────────────────────────────────────────────────

const TIMEOUT_LIGHT = 5000

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)),
  ])
}

function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now()
  return fn().then(result => ({ result, ms: Date.now() - t0 }))
}

// ── Testes individuais ────────────────────────────────────────────────────────

async function checkSupabaseTable(
  checkKey: string, checkName: string, category: string, table: string,
): Promise<HealthCheckResult> {
  try {
    const { ms, result } = await timed(() =>
      withTimeout(
        Promise.resolve(supabase.from(table as Parameters<typeof supabase.from>[0]).select('id').limit(1)),
        TIMEOUT_LIGHT,
      ),
    )
    const { error } = result as { data: unknown; error: { message: string } | null }
    if (error) {
      return { checkKey, checkName, category, status: 'error', errorMessage: error.message, responseTimeMs: ms, severity: 'high' }
    }
    return { checkKey, checkName, category, status: ms > 3000 ? 'warning' : 'ok', responseTimeMs: ms, severity: 'info' }
  } catch (e) {
    return { checkKey, checkName, category, status: 'error', errorMessage: String(e), severity: 'high' }
  }
}

export async function checkSupabaseConnection(): Promise<HealthCheckResult> {
  return checkSupabaseTable('supabase_conn', 'Conexão Supabase', 'database', 'profiles')
}

export async function checkProfiles(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_profiles', 'Tabela profiles', 'database', 'profiles')
}

export async function checkNotifications(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_notifications', 'Notificações', 'notifications', 'notifications')
}

export async function checkDiary(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_diary', 'Diário', 'diary', 'diary_entries')
}

export async function checkQuestionnaires(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_questionnaires', 'Questionários', 'questionnaires', 'questionnaire_responses')
}

export async function checkArticles(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_articles', 'Artigos', 'content', 'articles')
}

export async function checkTrails(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_trails', 'Trilhas', 'content', 'trails')
}

export async function checkPersonalizationTasks(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_pers_tasks', 'Fila de Pendências', 'personalization', 'user_personalization_tasks')
}

export async function checkPersonalizationDeliveries(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_pers_deliveries', 'Envios Personalizados', 'personalization', 'personalized_content_deliveries')
}

export async function checkGuidanceRequests(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_guidance', 'Orientações', 'clinical', 'monthly_guidance_requests')
}

export async function checkUserSessions(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_sessions', 'Sessões (legado)', 'clinical', 'user_sessions')
}

export async function checkMonthlyReports(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_reports', 'Relatórios Mensais', 'clinical', 'monthly_reports')
}

export async function checkSupportTickets(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_support', 'Suporte', 'support', 'support_tickets')
}

export async function checkSavedItems(): Promise<HealthCheckResult> {
  return checkSupabaseTable('db_saved', 'Caixa de Cuidado', 'content', 'saved_items')
}

export async function checkAdminSession(): Promise<HealthCheckResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { checkKey: 'admin_session', checkName: 'Sessão Admin', category: 'auth', status: 'error', errorMessage: 'Sem sessão ativa', severity: 'critical' }
    return { checkKey: 'admin_session', checkName: 'Sessão Admin', category: 'auth', status: 'ok', severity: 'info' }
  } catch (e) {
    return { checkKey: 'admin_session', checkName: 'Sessão Admin', category: 'auth', status: 'error', errorMessage: String(e), severity: 'critical' }
  }
}

export async function checkSitePublic(): Promise<HealthCheckResult> {
  const t0 = Date.now()
  try {
    const res = await withTimeout(fetch(window.location.origin + '/', { method: 'HEAD', cache: 'no-store' }), TIMEOUT_LIGHT)
    const ms = Date.now() - t0
    if (!res.ok) return { checkKey: 'site_public', checkName: 'Site Público', category: 'site', status: 'error', errorMessage: `HTTP ${res.status}`, responseTimeMs: ms, severity: 'critical' }
    return { checkKey: 'site_public', checkName: 'Site Público', category: 'site', status: ms > 3000 ? 'warning' : 'ok', responseTimeMs: ms, severity: 'info' }
  } catch (e) {
    return { checkKey: 'site_public', checkName: 'Site Público', category: 'site', status: 'error', errorMessage: String(e), responseTimeMs: Date.now() - t0, severity: 'critical' }
  }
}

export async function checkAI(): Promise<HealthCheckResult> {
  // Testa o provider de IA ATIVO. Se ele falhar mas houver outro configurado,
  // é degradação (o app faz failover automático) → alerta, e o botão "Corrigir"
  // troca para o próximo. Sem alternativa configurada → erro.
  const active = getActiveProvider()
  const label = PROVIDER_LABELS[active]
  const res = await testProvider(active)

  if (res.ok) {
    const status: CheckStatus = res.ms > 8000 ? 'warning' : 'ok'
    return { checkKey: 'ai_provider', checkName: `IA (${label})`, category: 'ai', status, responseTimeMs: res.ms, details: { provider: active }, severity: status === 'warning' ? 'medium' : 'info' }
  }

  const alternatives = availableProviders().filter(p => p !== active)
  const hasAlt = alternatives.length > 0
  return {
    checkKey: 'ai_provider', checkName: `IA (${label})`, category: 'ai',
    status: hasAlt ? 'warning' : 'error',
    errorMessage: hasAlt
      ? `${label} indisponível (${res.error}). Clique em Corrigir para ativar ${PROVIDER_LABELS[alternatives[0]]}.`
      : `${label} indisponível (${res.error}). Nenhuma IA alternativa configurada — adicione GEMINI_API_KEY/GROQ_API_KEY nos secrets do Supabase (Edge Functions).`,
    responseTimeMs: res.ms,
    details: { provider: active, alternatives, note: hasAlt ? 'Failover disponível.' : 'Sem alternativa configurada.' },
    severity: hasAlt ? 'medium' : 'high',
  }
}

export async function checkAIFallback(): Promise<HealthCheckResult> {
  // Testa o fallback local sem chamar API externa
  try {
    const content = `[FALLBACK LOCAL] Resumo de bem-estar gerado localmente em ${new Date().toLocaleDateString('pt-BR')}.`
    if (!content || content.length < 10) return { checkKey: 'ai_fallback', checkName: 'IA Fallback Local', category: 'ai', status: 'error', errorMessage: 'Fallback vazio', severity: 'medium' }
    return { checkKey: 'ai_fallback', checkName: 'IA Fallback Local', category: 'ai', status: 'ok', severity: 'info', details: { preview: content.slice(0, 60) } }
  } catch (e) {
    return { checkKey: 'ai_fallback', checkName: 'IA Fallback Local', category: 'ai', status: 'error', errorMessage: String(e), severity: 'medium' }
  }
}

export async function checkPayments(): Promise<HealthCheckResult> {
  // Este app usa checkout SERVER-SIDE: o frontend chama a Edge Function
  // create-checkout (STRIPE_SECRET_KEY no servidor). Não existe chave publicável
  // no frontend — por isso procurar VITE_STRIPE_PUBLISHABLE_KEY dava um falso
  // "não configurado".
  // Verificamos se a função de checkout está no ar via OPTIONS (preflight CORS):
  // ela responde 'ok' de imediato — sem auth, sem criar cobrança e sem gerar
  // log de erro. 404 = função não implantada.
  const base = import.meta.env?.VITE_SUPABASE_URL as string | undefined
  if (!base) {
    return { checkKey: 'payments', checkName: 'Pagamentos', category: 'payments', status: 'error', errorMessage: 'VITE_SUPABASE_URL ausente no build', severity: 'high' }
  }

  // Verifica o CAMINHO COMPLETO do pagamento, não só o início do checkout:
  //  - create-checkout      → inicia o pagamento
  //  - stripe-webhook       → ATIVA o plano após o pagamento (crítico)
  //  - manage-subscription  → cancelar / trocar / reativar
  // OPTIONS não cria cobrança. Status 404 = não implantada; 503 = BOOT_ERROR
  // (função não inicializa). Qualquer outro status = está no ar.
  const fns = ['create-checkout', 'stripe-webhook', 'manage-subscription']
  const t0 = Date.now()
  const statuses: Record<string, number> = {}
  try {
    await Promise.all(fns.map(async fn => {
      try {
        const res = await withTimeout(fetch(`${base}/functions/v1/${fn}`, { method: 'OPTIONS' }), TIMEOUT_LIGHT)
        statuses[fn] = res.status
      } catch {
        statuses[fn] = 0
      }
    }))
    const ms = Date.now() - t0
    const broken = fns.filter(f => statuses[f] === 404 || statuses[f] === 503)
    const webhookBroken = broken.includes('stripe-webhook')
    const checkoutBroken = broken.includes('create-checkout')

    if (broken.length === 0) {
      return { checkKey: 'payments', checkName: 'Pagamentos', category: 'payments', status: 'ok', responseTimeMs: ms, details: { statuses, note: 'Checkout, webhook e gestão de assinatura acessíveis.' }, severity: 'info' }
    }

    const critical = webhookBroken || checkoutBroken
    return {
      checkKey: 'payments', checkName: 'Pagamentos', category: 'payments',
      status: critical ? 'error' : 'warning',
      errorMessage: webhookBroken
        ? `Webhook de pagamento indisponível (${broken.join(', ')}). Usuário paga mas o plano pode NÃO ser ativado.`
        : checkoutBroken
          ? `Função de checkout indisponível (${broken.join(', ')}).`
          : `Função de pagamento com problema: ${broken.join(', ')}.`,
      details: { statuses, broken, hint: `Verifique os logs no Supabase e refaça o deploy: supabase functions deploy ${broken.join(' ')}` },
      responseTimeMs: ms,
      severity: critical ? 'critical' : 'medium',
    }
  } catch (e) {
    return { checkKey: 'payments', checkName: 'Pagamentos', category: 'payments', status: 'warning', errorMessage: 'Não foi possível verificar as funções de pagamento: ' + String(e), details: { statuses, hint: 'Verifique se as Edge Functions de pagamento estão implantadas.' }, responseTimeMs: Date.now() - t0, severity: 'medium' }
  }
}

export async function checkRLSPersonalization(): Promise<HealthCheckResult> {
  // Testa se usuário logado consegue ver apenas seus próprios conteúdos enviados
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { checkKey: 'rls_personalization', checkName: 'RLS Personalização', category: 'security', status: 'warning', errorMessage: 'Sem sessão para testar RLS', severity: 'medium' }
    const { data, error } = await supabase
      .from('personalized_content_deliveries')
      .select('id, user_id')
      .eq('status', 'sent')
      .limit(5)
    if (error) return { checkKey: 'rls_personalization', checkName: 'RLS Personalização', category: 'security', status: 'error', errorMessage: error.message, severity: 'high' }
    return { checkKey: 'rls_personalization', checkName: 'RLS Personalização', category: 'security', status: 'ok', details: { rowsVisible: (data ?? []).length }, severity: 'info' }
  } catch (e) {
    return { checkKey: 'rls_personalization', checkName: 'RLS Personalização', category: 'security', status: 'error', errorMessage: String(e), severity: 'high' }
  }
}

export async function checkDraftsDryRun(): Promise<HealthCheckResult> {
  // Simula criação de rascunho em dry_run: verifica acesso à tabela, mas não insere
  try {
    const { data, error } = await supabase
      .from('user_personalization_tasks')
      .select('id, status, delivery_id')
      .in('status', ['draft', 'generated'])
      .limit(3)
    if (error) return { checkKey: 'drafts_dryrun', checkName: 'Rascunhos (dry_run)', category: 'personalization', status: 'error', errorMessage: error.message, severity: 'medium' }
    return { checkKey: 'drafts_dryrun', checkName: 'Rascunhos (dry_run)', category: 'personalization', status: 'ok', details: { draftsFound: (data ?? []).length, withDelivery: (data ?? []).filter(d => d.delivery_id).length }, severity: 'info' }
  } catch (e) {
    return { checkKey: 'drafts_dryrun', checkName: 'Rascunhos (dry_run)', category: 'personalization', status: 'error', errorMessage: String(e), severity: 'medium' }
  }
}

// ── Conjuntos de testes ───────────────────────────────────────────────────────

// Teste rápido — leve, seguro, sem chamar IA ou criar dados
export async function runQuickHealthCheck(): Promise<HealthCheckResult[]> {
  const results = await Promise.all([
    checkSitePublic(),
    checkAdminSession(),
    checkSupabaseConnection(),
    checkNotifications(),
    checkPersonalizationTasks(),
    checkPersonalizationDeliveries(),
    checkDiary(),
    checkArticles(),
    checkPayments(),
  ])
  return results
}

// Teste intermediário — um pouco mais profundo, ainda seguro
export async function runIntermediateHealthCheck(): Promise<HealthCheckResult[]> {
  const results = await Promise.all([
    checkQuestionnaires(),
    checkTrails(),
    checkGuidanceRequests(),
    checkUserSessions(),
    checkMonthlyReports(),
    checkSupportTickets(),
    checkSavedItems(),
    checkRLSPersonalization(),
    checkDraftsDryRun(),
    checkAIFallback(),
  ])
  return results
}

// Diagnóstico completo — manual, mais lento, inclui IA
export async function runFullDiagnostic(): Promise<HealthCheckResult[]> {
  const quick = await runQuickHealthCheck()
  const intermediate = await runIntermediateHealthCheck()
  const extra = await Promise.all([
    checkAI(),
    checkProfiles(),
  ])
  return [...quick, ...intermediate, ...extra]
}

export async function runSingleCheck(checkKey: string): Promise<HealthCheckResult | null> {
  const map: Record<string, () => Promise<HealthCheckResult>> = {
    site_public: checkSitePublic,
    admin_session: checkAdminSession,
    supabase_conn: checkSupabaseConnection,
    db_profiles: checkProfiles,
    db_notifications: checkNotifications,
    db_diary: checkDiary,
    db_questionnaires: checkQuestionnaires,
    db_articles: checkArticles,
    db_trails: checkTrails,
    db_pers_tasks: checkPersonalizationTasks,
    db_pers_deliveries: checkPersonalizationDeliveries,
    db_guidance: checkGuidanceRequests,
    db_sessions: checkUserSessions,
    db_reports: checkMonthlyReports,
    db_support: checkSupportTickets,
    db_saved: checkSavedItems,
    ai_provider: checkAI,
    ai_fallback: checkAIFallback,
    payments: checkPayments,
    rls_personalization: checkRLSPersonalization,
    drafts_dryrun: checkDraftsDryRun,
  }
  const fn = map[checkKey]
  if (!fn) return null
  return fn()
}

// ── Persistência ──────────────────────────────────────────────────────────────

export async function saveHealthCheckResult(result: HealthCheckResult): Promise<void> {
  await supabase.from('system_health_checks').insert({
    check_key: result.checkKey,
    check_name: result.checkName,
    category: result.category,
    status: result.status,
    response_time_ms: result.responseTimeMs ?? null,
    error_message: result.errorMessage ?? null,
    details: result.details ?? {},
    severity: result.severity ?? 'info',
    checked_at: new Date().toISOString(),
  })
}

export async function saveHealthCheckResults(results: HealthCheckResult[]): Promise<void> {
  if (results.length === 0) return

  // Carrega o status anterior de cada check para salvar apenas mudanças
  const keys = results.map(r => r.checkKey)
  const { data: previous } = await supabase
    .from('system_health_checks')
    .select('check_key, status')
    .in('check_key', keys)
    .order('checked_at', { ascending: false })
    .limit(keys.length * 2)

  const lastStatus: Record<string, string> = {}
  for (const row of previous ?? []) {
    if (!lastStatus[row.check_key]) lastStatus[row.check_key] = row.status
  }

  // Salva apenas resultados cujo status mudou (ou que ainda não existem)
  const toSave = results.filter(r => lastStatus[r.checkKey] !== r.status)
  if (toSave.length === 0) return

  await supabase.from('system_health_checks').insert(
    toSave.map(r => ({
      check_key: r.checkKey,
      check_name: r.checkName,
      category: r.category,
      status: r.status,
      response_time_ms: r.responseTimeMs ?? null,
      error_message: r.errorMessage ?? null,
      details: r.details ?? {},
      severity: r.severity ?? 'info',
      checked_at: new Date().toISOString(),
    })),
  )
}

export async function createHealthReport(results: HealthCheckResult[], type: 'quick' | 'intermediate' | 'full' | 'manual' = 'manual'): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const ok = results.filter(r => r.status === 'ok').length
  const warn = results.filter(r => r.status === 'warning').length
  const err = results.filter(r => r.status === 'error').length
  const crit = results.filter(r => r.severity === 'critical').length

  const parts: string[] = [`${results.length} verificações. ${ok} OK, ${warn} alerta${warn !== 1 ? 's' : ''}, ${err} erro${err !== 1 ? 's' : ''}.`]
  if (crit > 0) parts.push(`${crit} crítico${crit !== 1 ? 's' : ''}.`)
  const errors = results.filter(r => r.status === 'error')
  if (errors.length > 0) parts.push('Erros: ' + errors.map(r => r.checkName).join(', ') + '.')

  await supabase.from('system_health_reports').insert({
    report_type: type,
    summary: parts.join(' '),
    total_checks: results.length,
    ok_count: ok,
    warning_count: warn,
    error_count: err,
    critical_count: crit,
    details: { results: results.map(r => ({ key: r.checkKey, status: r.status, ms: r.responseTimeMs, error: r.errorMessage })) },
    created_by: session?.user?.id ?? null,
  })
}

export async function detectOrUpdateIncident(result: HealthCheckResult): Promise<void> {
  if (result.status !== 'error' && result.status !== 'warning') return

  const { data: existing } = await supabase
    .from('system_incidents')
    .select('id, occurrences')
    .eq('check_key', result.checkKey)
    .in('status', ['open', 'investigating'])
    .order('first_detected_at', { ascending: false })
    .limit(1)
    .single()

  if (existing?.id) {
    await supabase.from('system_incidents').update({
      last_detected_at: new Date().toISOString(),
      occurrences: (existing.occurrences ?? 0) + 1,
      description: result.errorMessage ?? undefined,
    }).eq('id', existing.id)
  } else {
    await supabase.from('system_incidents').insert({
      check_key: result.checkKey,
      title: `${result.checkName} — ${result.status === 'error' ? 'Erro' : 'Alerta'}`,
      description: result.errorMessage ?? null,
      severity: result.severity ?? 'medium',
      status: 'open',
    })
  }
}

export async function resolveIncident(id: string): Promise<void> {
  await supabase.from('system_incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)
}

export async function resolveIncidentsByCheckKey(checkKey: string): Promise<void> {
  await supabase
    .from('system_incidents')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('check_key', checkKey)
    .in('status', ['open', 'investigating'])
}

export async function ignoreIncident(id: string): Promise<void> {
  await supabase.from('system_incidents').update({ status: 'ignored' }).eq('id', id)
}

export async function loadIncidents(): Promise<SystemIncident[]> {
  const { data } = await supabase
    .from('system_incidents')
    .select('*')
    .order('last_detected_at', { ascending: false })
    .limit(100)
  return (data ?? []) as SystemIncident[]
}

export async function loadReports(): Promise<HealthReport[]> {
  const { data } = await supabase
    .from('system_health_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as HealthReport[]
}

export async function loadLatestChecks(): Promise<HealthCheckResult[]> {
  // Para cada check_key, pega o resultado mais recente
  const { data } = await supabase
    .from('system_health_checks')
    .select('*')
    .order('checked_at', { ascending: false })
    .limit(200)
  if (!data) return []
  const seen = new Set<string>()
  const latest: HealthCheckResult[] = []
  for (const row of data) {
    if (!seen.has(row.check_key)) {
      seen.add(row.check_key)
      latest.push({
        checkKey: row.check_key,
        checkName: row.check_name,
        category: row.category,
        status: row.status,
        responseTimeMs: row.response_time_ms ?? undefined,
        errorMessage: row.error_message ?? undefined,
        details: row.details,
        severity: row.severity,
      })
    }
  }
  return latest
}

// ── Auto-reparo (correção com 1 clique) ─────────────────────────────────────────

// Checks que a RPC admin_autofix_health_check consegue corrigir (garantia de schema).
// Checks fora desta lista (site, IA, sessão, pagamentos, RLS, performance) não são
// corrigíveis por schema e não exibem o botão de auto-reparo.
export const AUTOFIXABLE_KEYS = new Set<string>([
  'supabase_conn', 'db_profiles', 'db_notifications', 'db_diary', 'db_questionnaires',
  'db_articles', 'db_trails', 'db_pers_tasks', 'db_pers_deliveries', 'db_guidance',
  'db_sessions', 'db_reports', 'db_support', 'db_saved',
])

export interface AutofixResult {
  success: boolean
  fixable: boolean
  check_key: string
  message: string
}

export function isAutofixable(checkKey: string): boolean {
  return AUTOFIXABLE_KEYS.has(checkKey)
}

// Corrige um check específico chamando a RPC SECURITY DEFINER no servidor.
export async function autofixCheck(checkKey: string): Promise<AutofixResult> {
  const { data, error } = await supabase.rpc('admin_autofix_health_check', { p_check_key: checkKey })
  if (error) {
    return { success: false, fixable: false, check_key: checkKey, message: error.message }
  }
  return data as unknown as AutofixResult
}

// Corrige todos os checks corrigíveis de uma vez.
export async function autofixAllChecks(): Promise<{ success: boolean; fixed_count: number; results: AutofixResult[] }> {
  const { data, error } = await supabase.rpc('admin_autofix_all_health')
  if (error) {
    return { success: false, fixed_count: 0, results: [{ success: false, fixable: false, check_key: 'all', message: error.message }] }
  }
  return data as unknown as { success: boolean; fixed_count: number; results: AutofixResult[] }
}
