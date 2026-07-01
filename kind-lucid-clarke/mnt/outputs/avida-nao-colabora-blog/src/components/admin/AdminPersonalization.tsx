import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Sparkles, Loader2, Search, Filter, X, ChevronDown, Copy,
  Send, Save, Trash2, Clock, CheckCircle, AlertCircle, RefreshCw,
  User, BookOpen, Calendar, BarChart2, FileText, Brain,
} from 'lucide-react'
import { callAI, DISCLAIMER } from '../../lib/aiContent'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface UserRow {
  user_id: string
  full_name: string | null
  email: string | null
  plan: string
  created_at: string
  pendingCount: number
  pendingLabels: string[]
  lastSentAt: string | null
}

interface Delivery {
  id: string
  user_id: string
  plan_key: string
  content_type: string
  title: string
  body: string
  target_area: string | null
  ai_generated: boolean
  status: string
  sent_at: string | null
  created_at: string
  data_snapshot: Record<string, any>
}

interface UserDetail {
  diaryCount: number
  questionnaireCount: number
  savedCount: number
  ticketCount: number
  guidanceCount: number
  sessionsCount: number
  articlesReadCount: number
  topTags: string[]
  avgMood: number | null
  openGuidance: boolean
  requestedSession: boolean
  hasReportThisMonth: boolean
  hasProfCommentThisMonth: boolean
  memberSince: string
}

type DetailTab = 'resumo' | 'direitos' | 'dados' | 'gerar' | 'rascunhos' | 'historico'

// ─── Dados dos planos ─────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-600',
  essential: 'bg-blue-100 text-blue-700',
  therapeutic: 'bg-purple-100 text-purple-700',
  'therapeutic-plus': 'bg-emerald-100 text-emerald-700',
}

const PLAN_RIGHTS: Record<string, string[]> = {
  free: [
    'Sugestão de artigo gratuito',
    'Mini-desafio quinzenal',
    'Pergunta simples para diário',
    'Recomendação de questionário básico',
  ],
  essential: [
    'Sugestão de artigo gratuito',
    'Mini-desafio quinzenal',
    'Pergunta simples para diário',
    'Recomendação de questionário básico',
    'Meditação guiada em texto',
    'Exercício emocional',
    'Notas guiadas para diário',
    'Resumo mensal simples',
    'Destaques de evolução sem análise clínica',
    'Sugestão de relatório mensal',
  ],
  therapeutic: [
    'Sugestão de artigo gratuito',
    'Mini-desafio quinzenal',
    'Pergunta simples para diário',
    'Meditação guiada em texto',
    'Exercício emocional',
    'Notas guiadas para diário',
    'Resumo mensal simples',
    'Plano de autocuidado personalizado',
    'Plano semanal de autocuidado',
    'Recomendações personalizadas de conteúdo',
    'Relatório mensal avançado',
    'Orientação mensal por mensagem',
    'Sugestão de trilha',
    'Recomendações por marcadores extras',
    'Próximos passos de autocuidado',
  ],
  'therapeutic-plus': [
    'Sugestão de artigo gratuito',
    'Mini-desafio quinzenal',
    'Pergunta simples para diário',
    'Meditação guiada em texto',
    'Exercício emocional',
    'Notas guiadas para diário',
    'Resumo mensal simples',
    'Plano de autocuidado personalizado',
    'Plano semanal de autocuidado',
    'Recomendações personalizadas de conteúdo',
    'Relatório mensal avançado',
    'Orientação mensal por mensagem',
    'Sugestão de trilha',
    'Próximos passos de autocuidado',
    'Revisão mensal do plano de autocuidado',
    'Comentário individual sobre relatório',
    'Resumo administrativo para sessão',
    'Sugestões de temas para sessão',
    'Mensagem personalizada pós-sessão',
    'Próximos passos após sessão',
  ],
}

const CONTENT_TYPES_BY_PLAN: Record<string, { value: string; label: string; area: string }[]> = {
  free: [
    { value: 'article_suggestion', label: 'Sugestão de artigo gratuito', area: 'recommendations' },
    { value: 'mini_challenge', label: 'Mini-desafio quinzenal', area: 'my_evolution' },
    { value: 'diary_question', label: 'Pergunta simples para diário', area: 'diary' },
    { value: 'questionnaire_suggestion', label: 'Recomendação de questionário básico', area: 'my_evolution' },
  ],
  essential: [
    { value: 'article_suggestion', label: 'Sugestão de artigo gratuito', area: 'recommendations' },
    { value: 'mini_challenge', label: 'Mini-desafio quinzenal', area: 'my_evolution' },
    { value: 'diary_question', label: 'Pergunta simples para diário', area: 'diary' },
    { value: 'guided_meditation', label: 'Meditação guiada em texto', area: 'meditations' },
    { value: 'emotional_exercise', label: 'Exercício emocional', area: 'exercises' },
    { value: 'guided_diary_notes', label: 'Notas guiadas para diário', area: 'diary' },
    { value: 'monthly_summary', label: 'Resumo mensal simples', area: 'reports' },
    { value: 'evolution_highlights', label: 'Destaques de evolução', area: 'my_evolution' },
    { value: 'report_suggestion', label: 'Sugestão de relatório mensal', area: 'reports' },
  ],
  therapeutic: [
    { value: 'article_suggestion', label: 'Sugestão de artigo', area: 'recommendations' },
    { value: 'mini_challenge', label: 'Mini-desafio quinzenal', area: 'my_evolution' },
    { value: 'guided_meditation', label: 'Meditação guiada em texto', area: 'meditations' },
    { value: 'self_care_plan', label: 'Plano de autocuidado personalizado', area: 'self_care_plan' },
    { value: 'weekly_self_care', label: 'Plano semanal de autocuidado', area: 'self_care_plan' },
    { value: 'content_recommendations', label: 'Recomendações personalizadas de conteúdo', area: 'recommendations' },
    { value: 'advanced_monthly_report', label: 'Relatório mensal avançado', area: 'reports' },
    { value: 'monthly_guidance_draft', label: 'Rascunho de orientação mensal', area: 'guidance' },
    { value: 'trail_suggestion', label: 'Sugestão de trilha', area: 'my_evolution' },
    { value: 'next_steps', label: 'Próximos passos de autocuidado', area: 'my_evolution' },
  ],
  'therapeutic-plus': [
    { value: 'article_suggestion', label: 'Sugestão de artigo', area: 'recommendations' },
    { value: 'weekly_self_care', label: 'Plano semanal de autocuidado', area: 'self_care_plan' },
    { value: 'self_care_plan', label: 'Plano de autocuidado personalizado', area: 'self_care_plan' },
    { value: 'monthly_review', label: 'Revisão mensal do plano de autocuidado', area: 'self_care_plan' },
    { value: 'professional_comment', label: 'Comentário individual sobre relatório', area: 'professional_comments' },
    { value: 'session_summary', label: 'Resumo administrativo para sessão', area: 'session_plus' },
    { value: 'session_themes', label: 'Sugestões de temas para sessão', area: 'session_plus' },
    { value: 'post_session_message', label: 'Mensagem personalizada pós-sessão', area: 'session_plus' },
    { value: 'next_steps_after_session', label: 'Próximos passos após sessão', area: 'my_evolution' },
    { value: 'monthly_guidance_draft', label: 'Rascunho de orientação mensal', area: 'guidance' },
  ],
}

const TARGET_AREA_LABELS: Record<string, string> = {
  my_evolution: 'Minha Evolução',
  diary: 'Diário',
  reports: 'Relatórios',
  self_care_plan: 'Plano de Autocuidado',
  guidance: 'Orientações',
  professional_comments: 'Comentários Profissionais',
  session_plus: 'Sessão Plus',
  recommendations: 'Recomendações',
  meditations: 'Meditações',
  exercises: 'Exercícios',
}

const ACTION_VIEW_MAP: Record<string, string> = {
  my_evolution: 'my-evolution',
  diary: 'diary',
  reports: 'my-evolution',
  self_care_plan: 'my-evolution',
  guidance: 'my-evolution',
  professional_comments: 'my-evolution',
  session_plus: 'my-evolution',
  recommendations: 'my-evolution',
  meditations: 'meditations',
  exercises: 'my-evolution',
}

const TONE_OPTIONS = ['Acolhedor', 'Simples', 'Direto', 'Leve', 'Motivacional', 'Profissional', 'Com humor leve']
const PERIOD_OPTIONS = ['Últimos 7 dias', 'Últimos 15 dias', 'Últimos 30 dias', 'Mês atual', 'Mês anterior', 'Todo o histórico']

const inputCls = 'w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300'

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getAllPlanRights(plan: string): string[] {
  return PLAN_RIGHTS[plan] ?? PLAN_RIGHTS.free
}

function getContentTypes(plan: string) {
  return CONTENT_TYPES_BY_PLAN[plan] ?? CONTENT_TYPES_BY_PLAN.free
}

// ─── Prompt da IA ─────────────────────────────────────────────────────────────

async function generatePersonalizedContent(opts: {
  contentType: string
  contentLabel: string
  plan: string
  planLabel: string
  tone: string
  period: string
  snapshot: Record<string, any>
  extraInstructions: string
}): Promise<string> {
  const { contentType, contentLabel, plan, planLabel, tone, period, snapshot, extraInstructions } = opts

  const snapshotText = JSON.stringify(snapshot, null, 2)

  const prompt = `Você é um assistente de personalização do projeto "A Vida Não Colabora".
Sua tarefa é gerar conteúdos personalizados de apoio ao autoconhecimento com base no plano do usuário e nos dados agregados de uso da plataforma.

Regras obrigatórias:
- Respeite rigorosamente o plano ${planLabel}.
- Não ofereça recursos que o plano não permite.
- Não faça diagnóstico. Não afirme que o usuário tem transtornos.
- Não use linguagem clínica conclusiva. Não prometa cura.
- Não substitua acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
- Use linguagem simples, acolhedora, prática e sem caráter clínico.
- Quando falar de emoções, use termos como "o usuário registrou", "aparece com frequência nos registros", "pode ser útil sugerir", "sem caráter clínico".
- Gere um conteúdo pronto para revisão do admin antes do envio.
- Tom de voz: ${tone.toLowerCase()}.
- Período analisado: ${period}.
${extraInstructions ? `- Instruções extras: ${extraInstructions}` : ''}

Plano do usuário: ${planLabel}
Tipo de conteúdo a gerar: ${contentLabel}

Dados agregados do usuário:
${snapshotText}

Gere o conteúdo personalizado agora. Comece com um título curto em negrito, seguido do conteúdo principal.
Não inclua avisos, apenas o conteúdo em si. O admin irá revisar antes de enviar.`

  try {
    const result = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai',
        seed: Math.floor(Math.random() * 9999),
      }),
      signal: AbortSignal.timeout(35000),
    })
    if (!result.ok) throw new Error('AI unavailable')
    return await result.text()
  } catch {
    // Fallback local
    return generateLocalFallback(contentType, plan, snapshot)
  }
}

function generateLocalFallback(contentType: string, plan: string, snapshot: Record<string, any>): string {
  const topTag = snapshot?.diary?.topMarkers?.[0] ?? 'rotina'
  const diaryCount = snapshot?.diary?.count ?? 0
  const name = 'você'

  const fallbacks: Record<string, string> = {
    article_suggestion: `**Sugestão de artigo personalizada**\n\nCom base nos registros recentes, pode ser útil explorar conteúdos relacionados a ${topTag}. Separamos um artigo que pode conversar com o seu momento atual.`,
    mini_challenge: `**Mini-desafio quinzenal**\n\nDurante os próximos 3 dias, registre uma frase curta no diário respondendo: "O que eu consegui fazer hoje, mesmo que tenha sido pequeno?"\n\nObjetivo: Ajudar a perceber pequenas ações possíveis no dia a dia.`,
    diary_question: `**Pergunta para o diário**\n\nPara esta semana, propomos uma reflexão: "O que mais pesou esta semana? E o que, apesar disso, foi possível?"\n\nNão há resposta certa. O importante é registrar o que vier.`,
    weekly_self_care: `**Plano semanal de autocuidado**\n\nObjetivo: Criar uma rotina mínima de cuidado sem cobrança de perfeição.\n\nPráticas sugeridas:\n1. Registrar o humor uma vez ao dia.\n2. Fazer uma pausa curta antes de dormir.\n3. Escolher uma pequena tarefa possível por dia.\n\nPerguntas para diário:\n- O que mais pesou hoje?\n- O que eu consegui fazer apesar do cansaço?\n- Qual cuidado pequeno eu posso repetir amanhã?`,
    professional_comment: `**Comentário sobre o relatório do mês**\n\nCom base nos registros de ${name} neste período${diaryCount > 0 ? ` (${diaryCount} entradas no diário)` : ''}, aparecem registros relacionados a ${topTag}. Sem caráter clínico, pode ser útil observar como esses pontos se relacionam com rotina e descanso.\n\nSugestão: Para o próximo mês, pode ser útil priorizar práticas simples de autocuidado e registros curtos.`,
    session_themes: `**Sugestões de temas para sessão**\n\nCom base nos registros recentes, estes pontos podem ser úteis para a sessão:\n1. Padrões registrados com frequência: ${topTag}\n2. Relação entre rotina e energia percebida\n3. Estratégias simples para os próximos passos\n4. Cobranças internas e autocuidado possível`,
    guided_meditation: `**Pausa breve para reorganizar o dia**\n\nEncontre uma posição confortável. Respire devagar por alguns instantes. Não tente resolver tudo agora. Apenas perceba como seu corpo está chegando neste momento.\n\nSe vier algum pensamento, deixe passar sem julgamento. Você não precisa resolver nada agora.`,
  }

  return fallbacks[contentType] ?? `**${contentType}**\n\nConteúdo gerado com base no plano ${plan}. Edite antes de enviar.`
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminPersonalization() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [pendingFilter, setPendingFilter] = useState('all')
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)

  function showToast(msg: string, err = false) {
    setToast({ msg, err })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const cur = monthKey()

    const [
      { data: profiles },
      { data: openGuidance },
      { data: reqSessions },
      { data: lastDeliveries },
    ] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, plan, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('monthly_guidance_requests').select('user_id').eq('status', 'open'),
      supabase.from('user_sessions').select('user_id').eq('status', 'requested'),
      supabase.from('personalized_content_deliveries').select('user_id, sent_at').eq('status', 'sent').order('sent_at', { ascending: false }).limit(1000),
    ])

    const openGuidanceSet = new Set((openGuidance ?? []).map((r: any) => r.user_id))
    const reqSessionSet = new Set((reqSessions ?? []).map((r: any) => r.user_id))
    const lastSentMap: Record<string, string> = {}
    for (const d of (lastDeliveries ?? []) as any[]) {
      if (!lastSentMap[d.user_id]) lastSentMap[d.user_id] = d.sent_at
    }

    const rows: UserRow[] = (profiles ?? []).map((p: any) => {
      const pendingLabels: string[] = []
      const plan = p.plan ?? 'free'

      if (openGuidanceSet.has(p.user_id)) pendingLabels.push('Orientação aguardando')
      if (reqSessionSet.has(p.user_id)) pendingLabels.push('Sessão aguardando')
      if (!lastSentMap[p.user_id]) pendingLabels.push('Sem envio recente')

      return {
        user_id: p.user_id,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
        plan,
        created_at: p.created_at,
        pendingCount: pendingLabels.length,
        pendingLabels,
        lastSentAt: lastSentMap[p.user_id] ?? null,
      }
    })

    setUsers(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u => {
    if (planFilter !== 'all' && u.plan !== planFilter) return false
    if (pendingFilter === 'pending' && u.pendingCount === 0) return false
    if (pendingFilter === 'guidance' && !u.pendingLabels.includes('Orientação aguardando')) return false
    if (pendingFilter === 'session' && !u.pendingLabels.includes('Sessão aguardando')) return false
    if (pendingFilter === 'no-send' && u.lastSentAt !== null) return false
    if (search) {
      const q = search.toLowerCase()
      return (u.full_name ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        PLAN_LABELS[u.plan]?.toLowerCase().includes(q)
    }
    return true
  })

  if (selectedUser) {
    return (
      <UserDetailPanel
        user={selectedUser}
        onBack={() => setSelectedUser(null)}
        showToast={showToast}
        onRefresh={load}
      />
    )
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-600" /> Personalização por Plano
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">Gere e envie conteúdos personalizados conforme o plano de cada usuário</p>
        </div>
        <button onClick={() => load()} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Busca + Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail ou plano..."
            className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          )}
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className="border border-stone-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none">
          <option value="all">Todos os planos</option>
          {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={pendingFilter} onChange={e => setPendingFilter(e.target.value)} className="border border-stone-200 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none">
          <option value="all">Todas as situações</option>
          <option value="pending">Com pendências</option>
          <option value="guidance">Orientação pendente</option>
          <option value="session">Sessão pendente</option>
          <option value="no-send">Sem envio recente</option>
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum usuário encontrado com esses filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const rights = getAllPlanRights(u.plan)
            return (
              <div
                key={u.user_id}
                className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-colors cursor-pointer"
                onClick={() => setSelectedUser(u)}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-stone-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-stone-800 text-sm">{u.full_name ?? '(sem nome)'}</p>
                      <p className="text-xs text-stone-400">{u.email ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                    {/* Plano */}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.plan] ?? 'bg-stone-100 text-stone-500'}`}>
                      {PLAN_LABELS[u.plan] ?? u.plan}
                    </span>

                    {/* Direitos */}
                    <span className="text-xs text-stone-500 hidden sm:block">
                      {rights.length} recursos · {rights.slice(0, 2).join(', ')}...
                    </span>

                    {/* Pendências */}
                    {u.pendingCount > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        <Clock className="w-3 h-3" /> {u.pendingCount} pendência{u.pendingCount > 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Último envio */}
                    <span className="text-xs text-stone-400">
                      {u.lastSentAt
                        ? `Último envio: ${new Date(u.lastSentAt).toLocaleDateString('pt-BR')}`
                        : <span className="text-amber-500">Sem envio</span>
                      }
                    </span>

                    {/* Ação */}
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedUser(u) }}
                      className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-lg hover:bg-emerald-100 font-medium"
                    >
                      Ver detalhes
                    </button>
                  </div>
                </div>

                {u.pendingLabels.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {u.pendingLabels.map(l => (
                      <span key={l} className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded">
                        {l}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Painel de detalhe do usuário ────────────────────────────────────────────

function UserDetailPanel({
  user,
  onBack,
  showToast,
  onRefresh,
}: {
  user: UserRow
  onBack: () => void
  showToast: (msg: string, err?: boolean) => void
  onRefresh: () => void
}) {
  const [tab, setTab] = useState<DetailTab>('resumo')
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loadingDetail, setLoadingDetail] = useState(true)

  const loadDetail = useCallback(async () => {
    setLoadingDetail(true)
    const uid = user.user_id
    const cur = monthKey()

    const [
      { count: diaryCount },
      { count: questionnaireCount },
      { count: savedCount },
      { count: ticketCount },
      { count: guidanceCount },
      { count: sessionsCount },
      { count: articlesReadCount },
      { data: guidanceOpen },
      { data: sessionReq },
      { data: reportThisMonth },
      { data: diaryData },
      { data: delivs },
    ] = await Promise.all([
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('questionnaire_responses').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('saved_items').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('monthly_guidance_requests').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('user_sessions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('event_type', 'article_read'),
      supabase.from('monthly_guidance_requests').select('status').eq('user_id', uid).eq('status', 'open').limit(1),
      supabase.from('user_sessions').select('status').eq('user_id', uid).eq('status', 'requested').limit(1),
      supabase.from('monthly_reports').select('id').eq('user_id', uid).eq('month_key', cur).limit(1),
      supabase.from('diary_entries').select('mood, energy, tags').eq('user_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('personalized_content_deliveries').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
    ])

    // Calcular top tags e média de humor
    const allTags: string[] = []
    let moodSum = 0; let moodCount = 0
    for (const d of (diaryData ?? []) as any[]) {
      if (d.tags) allTags.push(...(Array.isArray(d.tags) ? d.tags : []))
      if (d.mood) { moodSum += d.mood; moodCount++ }
    }
    const tagFreq: Record<string, number> = {}
    for (const t of allTags) tagFreq[t] = (tagFreq[t] ?? 0) + 1
    const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t)

    setDetail({
      diaryCount: diaryCount ?? 0,
      questionnaireCount: questionnaireCount ?? 0,
      savedCount: savedCount ?? 0,
      ticketCount: ticketCount ?? 0,
      guidanceCount: guidanceCount ?? 0,
      sessionsCount: sessionsCount ?? 0,
      articlesReadCount: articlesReadCount ?? 0,
      topTags,
      avgMood: moodCount > 0 ? Math.round((moodSum / moodCount) * 10) / 10 : null,
      openGuidance: (guidanceOpen ?? []).length > 0,
      requestedSession: (sessionReq ?? []).length > 0,
      hasReportThisMonth: (reportThisMonth ?? []).length > 0,
      hasProfCommentThisMonth: false,
      memberSince: new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    })

    setDeliveries((delivs ?? []) as Delivery[])
    setLoadingDetail(false)
  }, [user])

  useEffect(() => { loadDetail() }, [loadDetail])

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'resumo', label: 'Resumo' },
    { id: 'direitos', label: 'Direitos do Plano' },
    { id: 'dados', label: 'Dados para IA' },
    { id: 'gerar', label: '✦ Gerar com IA' },
    { id: 'rascunhos', label: `Rascunhos (${deliveries.filter(d => d.status === 'draft').length})` },
    { id: 'historico', label: `Histórico (${deliveries.filter(d => d.status === 'sent').length})` },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1">
          ← Voltar
        </button>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center">
            <User className="w-4 h-4 text-stone-400" />
          </div>
          <div>
            <p className="font-semibold text-stone-800">{user.full_name ?? '(sem nome)'}</p>
            <p className="text-xs text-stone-400">{user.email ?? '—'}</p>
          </div>
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[user.plan] ?? 'bg-stone-100'}`}>
            {PLAN_LABELS[user.plan] ?? user.plan}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-stone-200 mb-5 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-sm px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap font-medium ${
              tab === t.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loadingDetail ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-stone-400" /></div>
      ) : (
        <>
          {tab === 'resumo' && detail && (
            <TabResumo user={user} detail={detail} />
          )}
          {tab === 'direitos' && detail && (
            <TabDireitos user={user} detail={detail} />
          )}
          {tab === 'dados' && detail && (
            <TabDados user={user} detail={detail} />
          )}
          {tab === 'gerar' && detail && (
            <TabGerarIA
              user={user}
              detail={detail}
              onSaved={loadDetail}
              showToast={showToast}
            />
          )}
          {tab === 'rascunhos' && (
            <TabRascunhos
              deliveries={deliveries.filter(d => d.status === 'draft')}
              user={user}
              onRefresh={loadDetail}
              showToast={showToast}
            />
          )}
          {tab === 'historico' && (
            <TabHistorico deliveries={deliveries.filter(d => d.status === 'sent')} />
          )}
        </>
      )}
    </div>
  )
}

// ─── Tab: Resumo ─────────────────────────────────────────────────────────────

function TabResumo({ user, detail }: { user: UserRow; detail: UserDetail }) {
  const items = [
    ['Registros no diário', detail.diaryCount],
    ['Questionários respondidos', detail.questionnaireCount],
    ['Itens salvos', detail.savedCount],
    ['Artigos lidos', detail.articlesReadCount],
    ['Orientações mensais', detail.guidanceCount],
    ['Sessões Plus', detail.sessionsCount],
    ['Tickets de suporte', detail.ticketCount],
  ]

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">Informações gerais</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-stone-500">Plano</div>
          <div className="font-medium text-stone-800">{PLAN_LABELS[user.plan] ?? user.plan}</div>
          <div className="text-stone-500">Membro desde</div>
          <div className="text-stone-700">{detail.memberSince}</div>
          {detail.avgMood !== null && (
            <>
              <div className="text-stone-500">Humor médio registrado</div>
              <div className="text-stone-700">{detail.avgMood}/5</div>
            </>
          )}
          {detail.topTags.length > 0 && (
            <>
              <div className="text-stone-500">Temas frequentes</div>
              <div className="text-stone-700">{detail.topTags.join(', ')}</div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">Atividade na plataforma</h3>
        <div className="grid grid-cols-2 gap-2">
          {items.map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between bg-stone-50 rounded-lg px-3 py-2">
              <span className="text-xs text-stone-500">{label}</span>
              <span className="text-sm font-semibold text-stone-800">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {user.pendingLabels.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-700">Pendências identificadas:</p>
          {user.pendingLabels.map(l => (
            <p key={l} className="text-sm text-amber-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {l}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Direitos do Plano ───────────────────────────────────────────────────

function TabDireitos({ user, detail }: { user: UserRow; detail: UserDetail }) {
  const rights = getAllPlanRights(user.plan)
  const cur = monthKey()
  const d = new Date(); const mLabel = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const pendencies: string[] = []
  if (detail.openGuidance) pendencies.push('Orientação mensal aguardando resposta')
  if (detail.requestedSession) pendencies.push('Sessão Plus aguardando agendamento')
  if (!detail.hasReportThisMonth && ['therapeutic', 'therapeutic-plus'].includes(user.plan)) pendencies.push('Relatório mensal avançado ainda não gerado')
  if (user.plan === 'therapeutic-plus' && !detail.hasProfCommentThisMonth) pendencies.push('Comentário profissional pendente')

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">
          Personalizações disponíveis para o plano {PLAN_LABELS[user.plan] ?? user.plan}
        </h3>
        <div className="space-y-1.5">
          {rights.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-stone-600">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              {r}
            </div>
          ))}
        </div>
      </div>

      {pendencies.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="font-semibold text-amber-700 mb-3">Pendências em {mLabel}:</h3>
          <div className="space-y-1.5">
            {pendencies.map((p, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-600">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {pendencies.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-700">Sem pendências identificadas para este mês.</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Dados para IA ───────────────────────────────────────────────────────

function TabDados({ user, detail }: { user: UserRow; detail: UserDetail }) {
  const snapshot = buildSnapshot(user, detail)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          Use estes dados apenas para personalização da experiência do usuário. Evite expor informações sensíveis sem necessidade.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
        <h3 className="font-semibold text-stone-700">Dados agregados disponíveis para a IA</h3>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-stone-500">Plano</div>
          <div className="font-medium">{PLAN_LABELS[user.plan] ?? user.plan}</div>
          <div className="text-stone-500">Membro desde</div>
          <div>{detail.memberSince}</div>
          <div className="text-stone-500">Entradas no diário</div>
          <div>{detail.diaryCount}</div>
          <div className="text-stone-500">Questionários</div>
          <div>{detail.questionnaireCount}</div>
          <div className="text-stone-500">Itens salvos</div>
          <div>{detail.savedCount}</div>
          <div className="text-stone-500">Artigos lidos</div>
          <div>{detail.articlesReadCount}</div>
          <div className="text-stone-500">Humor médio</div>
          <div>{detail.avgMood !== null ? `${detail.avgMood}/5` : 'Sem dados'}</div>
        </div>

        {detail.topTags.length > 0 && (
          <div>
            <p className="text-xs text-stone-500 mb-1.5 font-medium">Temas mais frequentes nos registros:</p>
            <div className="flex flex-wrap gap-1.5">
              {detail.topTags.map(t => (
                <span key={t} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5">
        <h3 className="font-semibold text-stone-700 mb-3">Snapshot JSON (enviado para a IA)</h3>
        <pre className="text-xs text-stone-600 bg-stone-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function buildSnapshot(user: UserRow, detail: UserDetail) {
  return {
    plan: user.plan,
    planLabel: PLAN_LABELS[user.plan] ?? user.plan,
    memberSince: detail.memberSince,
    diary: {
      count: detail.diaryCount,
      topMarkers: detail.topTags,
      avgMood: detail.avgMood,
    },
    questionnaires: { count: detail.questionnaireCount },
    content: { articlesRead: detail.articlesReadCount, savedItems: detail.savedCount },
    guidance: { count: detail.guidanceCount, pending: detail.openGuidance },
    sessions: { count: detail.sessionsCount, pending: detail.requestedSession },
    support: { count: detail.ticketCount },
  }
}

// ─── Tab: Gerar com IA ────────────────────────────────────────────────────────

function TabGerarIA({
  user, detail, onSaved, showToast,
}: {
  user: UserRow; detail: UserDetail
  onSaved: () => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const contentTypes = getContentTypes(user.plan)
  const [contentType, setContentType] = useState(contentTypes[0]?.value ?? '')
  const [tone, setTone] = useState('Acolhedor')
  const [period, setPeriod] = useState('Últimos 30 dias')
  const [extras, setExtras] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState('')
  const [editedTitle, setEditedTitle] = useState('')
  const [editedBody, setEditedBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  const selectedType = contentTypes.find(c => c.value === contentType)

  async function generate() {
    if (!contentType) return
    setGenerating(true)
    const snapshot = buildSnapshot(user, detail)
    const result = await generatePersonalizedContent({
      contentType,
      contentLabel: selectedType?.label ?? contentType,
      plan: user.plan,
      planLabel: PLAN_LABELS[user.plan] ?? user.plan,
      tone,
      period,
      snapshot,
      extraInstructions: extras,
    })
    setGenerated(result)
    // Extrair título da primeira linha
    const lines = result.split('\n').filter(l => l.trim())
    const firstLine = lines[0]?.replace(/^\*\*|\*\*$/g, '').trim() ?? selectedType?.label ?? 'Conteúdo personalizado'
    setEditedTitle(firstLine)
    setEditedBody(result)
    setGenerating(false)
  }

  async function save(sendNow: boolean) {
    if (!editedBody.trim() || !editedTitle.trim()) { showToast('Preencha título e conteúdo.', true); return }
    sendNow ? setSending(true) : setSaving(true)
    const snapshot = buildSnapshot(user, detail)

    const { data: me } = await supabase.auth.getUser()
    const payload = {
      user_id: user.user_id,
      created_by: me.user?.id ?? null,
      plan_key: user.plan,
      content_type: contentType,
      title: editedTitle,
      body: editedBody,
      target_area: selectedType?.area ?? 'my_evolution',
      data_snapshot: snapshot,
      ai_generated: generated.length > 0,
      status: sendNow ? 'sent' : 'draft',
      sent_at: sendNow ? new Date().toISOString() : null,
    }

    const { error } = await supabase.from('personalized_content_deliveries').insert(payload)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); setSending(false); return }

    if (sendNow) {
      await supabase.from('notifications').insert({
        user_id: user.user_id,
        title: 'Novo conteúdo personalizado disponível',
        body: `Preparamos uma nova sugestão com base no seu uso da plataforma: ${editedTitle}`,
        type: 'system',
        action_view: ACTION_VIEW_MAP[selectedType?.area ?? 'my_evolution'] ?? 'my-evolution',
        action_label: 'Ver conteúdo',
        is_read: false,
      })
      showToast('Conteúdo enviado e usuário notificado!')
    } else {
      showToast('Rascunho salvo!')
    }

    setSaving(false); setSending(false)
    setGenerated(''); setEditedTitle(''); setEditedBody('')
    onSaved()
  }

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Aviso */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
        <span className="font-semibold">Lembre-se:</span> o conteúdo gerado é um rascunho. Revise antes de enviar ao usuário.
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
        <div>
          <label className="text-xs text-stone-500 block mb-1">Tipo de conteúdo ({PLAN_LABELS[user.plan]})</label>
          <select value={contentType} onChange={e => setContentType(e.target.value)} className={inputCls}>
            {contentTypes.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          {selectedType && (
            <p className="text-xs text-stone-400 mt-1">Área: {TARGET_AREA_LABELS[selectedType.area] ?? selectedType.area}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Tom de voz</label>
            <select value={tone} onChange={e => setTone(e.target.value)} className={inputCls}>
              {TONE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-stone-500 block mb-1">Período analisado</label>
            <select value={period} onChange={e => setPeriod(e.target.value)} className={inputCls}>
              {PERIOD_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-stone-500 block mb-1">Instruções extras (opcional)</label>
          <textarea
            value={extras}
            onChange={e => setExtras(e.target.value)}
            rows={2}
            placeholder="Ex: focar em rotina, mencionar que a sessão foi realizada..."
            className={inputCls + ' resize-none'}
          />
        </div>

        <button
          onClick={generate}
          disabled={generating || !contentType}
          className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {generating ? 'Gerando...' : 'Gerar com IA'}
        </button>
      </div>

      {/* Editor do rascunho */}
      {(editedBody || generating) && (
        <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
          <h3 className="font-semibold text-stone-700">Rascunho gerado — revise antes de enviar</h3>

          <div>
            <label className="text-xs text-stone-500 block mb-1">Título</label>
            <input
              value={editedTitle}
              onChange={e => setEditedTitle(e.target.value)}
              className={inputCls}
              placeholder="Título do conteúdo"
            />
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">Conteúdo</label>
            <textarea
              value={editedBody}
              onChange={e => setEditedBody(e.target.value)}
              rows={12}
              className={inputCls + ' resize-y font-mono text-xs'}
            />
          </div>

          <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
            <p className="text-xs text-stone-500 font-medium mb-1">Aviso padrão que acompanhará o envio:</p>
            <p className="text-xs text-stone-400 italic">{DISCLAIMER}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Gerar novamente
            </button>
            <button
              onClick={() => { if (editedBody) navigator.clipboard.writeText(editedBody).catch(() => {}) }}
              className="flex items-center gap-2 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50"
            >
              <Copy className="w-3.5 h-3.5" /> Copiar
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving || sending}
              className="flex items-center gap-2 border border-stone-200 text-stone-600 text-sm px-3 py-1.5 rounded-lg hover:bg-stone-50 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar rascunho
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving || sending}
              className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Enviando...' : 'Enviar ao usuário'}
            </button>
            <button
              onClick={() => { setEditedBody(''); setEditedTitle(''); setGenerated('') }}
              className="flex items-center gap-2 text-red-400 text-sm px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Descartar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Rascunhos ───────────────────────────────────────────────────────────

function TabRascunhos({
  deliveries, user, onRefresh, showToast,
}: {
  deliveries: Delivery[]; user: UserRow
  onRefresh: () => void
  showToast: (msg: string, err?: boolean) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)

  async function send(d: Delivery) {
    setSaving(true)
    const { error } = await supabase.from('personalized_content_deliveries')
      .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', d.id)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    await supabase.from('notifications').insert({
      user_id: user.user_id,
      title: 'Novo conteúdo personalizado disponível',
      body: `Preparamos uma nova sugestão: ${d.title}`,
      type: 'system',
      action_view: ACTION_VIEW_MAP[d.target_area ?? 'my_evolution'] ?? 'my-evolution',
      action_label: 'Ver conteúdo',
      is_read: false,
    })
    showToast('Conteúdo enviado!')
    setSaving(false)
    onRefresh()
  }

  async function archive(id: string) {
    await supabase.from('personalized_content_deliveries').update({ status: 'archived' }).eq('id', id)
    showToast('Rascunho arquivado.')
    onRefresh()
  }

  async function saveEdit(id: string) {
    setSaving(true)
    await supabase.from('personalized_content_deliveries')
      .update({ title: editTitle, body: editBody, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSaving(false)
    setEditing(null)
    showToast('Rascunho atualizado.')
    onRefresh()
  }

  if (deliveries.length === 0) {
    return <p className="text-sm text-stone-400 py-8 text-center">Nenhum rascunho salvo.</p>
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {deliveries.map(d => (
        <div key={d.id} className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
          {editing === d.id ? (
            <>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className={inputCls} />
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8} className={inputCls + ' font-mono text-xs resize-y'} />
              <div className="flex gap-2">
                <button onClick={() => saveEdit(d.id)} disabled={saving} className="flex items-center gap-1.5 bg-stone-700 text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                </button>
                <button onClick={() => setEditing(null)} className="text-xs border border-stone-200 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-50">Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-stone-800 text-sm">{d.title}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {d.content_type} · {TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area} · criado em {new Date(d.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {d.ai_generated && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded flex-shrink-0">✦ IA</span>
                )}
              </div>
              <p className="text-xs text-stone-500 line-clamp-3">{d.body}</p>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => { setEditing(d.id); setEditTitle(d.title); setEditBody(d.body) }} className="flex items-center gap-1 text-xs border border-stone-200 text-stone-600 px-2.5 py-1 rounded-lg hover:bg-stone-50">
                  Editar
                </button>
                <button onClick={() => send(d)} disabled={saving} className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-2.5 py-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="w-3 h-3" /> Enviar
                </button>
                <button onClick={() => archive(d.id)} className="flex items-center gap-1 text-xs text-red-400 border border-red-100 px-2.5 py-1 rounded-lg hover:bg-red-50">
                  <Trash2 className="w-3 h-3" /> Arquivar
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Histórico ───────────────────────────────────────────────────────────

function TabHistorico({ deliveries }: { deliveries: Delivery[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (deliveries.length === 0) {
    return <p className="text-sm text-stone-400 py-8 text-center">Nenhum conteúdo enviado ainda.</p>
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {deliveries.map(d => (
        <div key={d.id} className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-800 text-sm">{d.title}</p>
              <p className="text-xs text-stone-400 mt-0.5">
                {TARGET_AREA_LABELS[d.target_area ?? ''] ?? d.target_area} ·
                Enviado em {d.sent_at ? new Date(d.sent_at).toLocaleDateString('pt-BR') : '—'}
                {d.ai_generated && ' · ✦ IA'}
              </p>
            </div>
            <button
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="text-xs text-stone-400 hover:text-stone-600 flex-shrink-0"
            >
              {expanded === d.id ? 'Fechar' : 'Ver'}
            </button>
          </div>
          {expanded === d.id && (
            <div className="mt-3 border-t border-stone-100 pt-3">
              <p className="text-sm text-stone-600 whitespace-pre-wrap">{d.body}</p>
              <button
                onClick={() => navigator.clipboard.writeText(d.body).catch(() => {})}
                className="mt-2 flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
