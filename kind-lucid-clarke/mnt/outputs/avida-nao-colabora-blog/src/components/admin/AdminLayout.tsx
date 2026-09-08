import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard, Users, HeartHandshake, BookOpen,
  Mail, LifeBuoy, Settings2, Activity,
  ExternalLink, Menu, BarChart3, DollarSign, ArrowLeftFromLine, Megaphone, ListFilter,
  Search, Bell, CreditCard, AlertTriangle, Loader2, X,
} from 'lucide-react'
import { LogoIcon } from '../Logo'
import type { AdminView } from './types'
import { fetchOperationalSnapshot } from '../../lib/adminOperationalStatus'
import './admin-theme.css'

type NavItem = { id: AdminView; label: string; icon: LucideIcon }
type NavGroup = { label: string; items: NavItem[] }

type SearchItem = {
  view: AdminView
  label: string
  description: string
  keywords: string[]
  module?: string
}

type AdminAlert = {
  key: string
  label: string
  count: number
  view: AdminView
  severity: 'warning' | 'error'
}

const NAV_GROUPS: NavGroup[] = [
  { label: 'Visão geral', items: [
    { id: 'visao-geral', label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { label: 'Pessoas', items: [
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'segmentacao', label: 'Segmentação', icon: ListFilter },
    { id: 'engajamento', label: 'Engajamento', icon: Activity },
  ]},
  { label: 'Negócio', items: [
    { id: 'assinaturas', label: 'Assinaturas', icon: CreditCard },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  ]},
  { label: 'Conteúdo', items: [
    { id: 'conteudos', label: 'Conteúdo', icon: BookOpen },
    { id: 'estudio', label: 'Estúdio de Conteúdo', icon: Megaphone },
  ]},
  { label: 'Cuidado', items: [
    { id: 'cuidado', label: 'Cuidado', icon: HeartHandshake },
  ]},
  { label: 'Relacionamento', items: [
    { id: 'comunicacao', label: 'Comunicação', icon: Mail },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
  ]},
  { label: 'Análise', items: [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ]},
  { label: 'Administração', items: [
    { id: 'sistema', label: 'Sistema', icon: Settings2 },
  ]},
]

const SEARCH_ITEMS: SearchItem[] = [
  { view: 'visao-geral', label: 'Dashboard', description: 'Visão geral e pendências atuais', keywords: ['inicio', 'visao geral', 'pendencias'], module: 'overview' },
  { view: 'usuarios', label: 'Usuários', description: 'Contas, perfil, bloqueio, plano e histórico', keywords: ['contas', 'perfil', 'cliente', 'pessoa'], module: 'users' },
  { view: 'segmentacao', label: 'Segmentação', description: 'Filtros e grupos de usuários', keywords: ['segmentos', 'filtros', 'publico'], module: 'users' },
  { view: 'engajamento', label: 'Engajamento', description: 'Atividade e usuários inativos', keywords: ['atividade', 'inativos', 'retencao'], module: 'analytics' },
  { view: 'assinaturas', label: 'Assinaturas', description: 'Planos, alterações e cancelamentos', keywords: ['planos', 'upgrade', 'downgrade', 'cancelamento'], module: 'finance' },
  { view: 'financeiro', label: 'Financeiro', description: 'Receita, pagamentos e eventos Stripe', keywords: ['receita', 'stripe', 'pagamentos', 'fatura'], module: 'finance' },
  { view: 'articles', label: 'Artigos', description: 'Publicação e edição de artigos', keywords: ['conteudo', 'editor', 'publicacao'], module: 'content' },
  { view: 'fabrica-ia', label: 'Fábrica IA', description: 'Geração editorial com IA', keywords: ['ia', 'gerar', 'conteudo'], module: 'content' },
  { view: 'calendario', label: 'Calendário editorial', description: 'Planejamento e programação', keywords: ['agenda', 'programados', 'planejamento'], module: 'content' },
  { view: 'images', label: 'Mídia', description: 'Biblioteca e uploads', keywords: ['imagem', 'upload', 'storage'], module: 'content' },
  { view: 'seo', label: 'SEO', description: 'Otimização dos conteúdos', keywords: ['busca', 'meta', 'slug'], module: 'content' },
  { view: 'estudio', label: 'Estúdio de Conteúdo', description: 'Produção de peças e campanhas', keywords: ['instagram', 'social', 'estudio'], module: 'content' },
  { view: 'diary-config', label: 'Diário e check-ins', description: 'Configuração e acompanhamento do diário', keywords: ['diario', 'checkin', 'humor'], module: 'content' },
  { view: 'questionnaires', label: 'Questionários', description: 'Questionários de autoconhecimento', keywords: ['perguntas', 'avaliacao'], module: 'content' },
  { view: 'pdf', label: 'Relatórios', description: 'Relatórios emocionais e revisão', keywords: ['relatorio', 'pdf', 'mensal'], module: 'content' },
  { view: 'self-care-plans', label: 'Planos de autocuidado', description: 'Geração, revisão e envio', keywords: ['autocuidado', 'care plan'], module: 'content' },
  { view: 'guidance-requests', label: 'Orientações', description: 'Orientações mensais aguardando resposta', keywords: ['orientacao', 'mensagem'], module: 'content' },
  { view: 'personalization', label: 'Recomendações', description: 'Personalização e entregas', keywords: ['recomendacoes', 'personalizacao'], module: 'content' },
  { view: 'notifications', label: 'Campanhas e notificações', description: 'Comunicação in-app', keywords: ['notificacao', 'campanha', 'push'], module: 'communication' },
  { view: 'emails', label: 'Histórico de e-mails', description: 'Entregas e falhas de e-mail', keywords: ['email', 'mensagem', 'reenviar'], module: 'communication' },
  { view: 'support', label: 'Suporte', description: 'Tickets e atendimento', keywords: ['ticket', 'atendimento', 'ajuda'], module: 'users' },
  { view: 'analytics', label: 'Analytics', description: 'Aquisição, conteúdo, conversão e retenção', keywords: ['metricas', 'funil', 'conversao', 'retencao'], module: 'analytics' },
  { view: 'system-health', label: 'Saúde do sistema', description: 'Diagnóstico e disponibilidade', keywords: ['health', 'saude', 'banco', 'storage'], module: 'system' },
  { view: 'uso-ia', label: 'IA — uso e falhas', description: 'Providers, logs e incidentes de IA', keywords: ['gemini', 'groq', 'openai', 'ia'], module: 'system' },
  { view: 'integrations', label: 'Integrações', description: 'Serviços e infraestrutura externa', keywords: ['stripe', 'supabase', 'servicos'], module: 'system' },
  { view: 'logs', label: 'Auditoria', description: 'Registro de ações administrativas', keywords: ['logs', 'auditoria', 'historico'], module: 'system' },
  { view: 'permissions', label: 'Papéis e permissões', description: 'Acesso de administradores', keywords: ['rbac', 'permissoes', 'admin'], module: 'system' },
]

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function deriveActive(view: string): string {
  if (view === 'article-editor') return 'conteudos'
  return view
}

const AREA_MODULE: Record<string, string> = {
  'visao-geral': 'overview', usuarios: 'users', segmentacao: 'users', engajamento: 'analytics',
  assinaturas: 'finance', financeiro: 'finance',
  conteudos: 'content', estudio: 'content',
  cuidado: 'content', analytics: 'analytics',
  comunicacao: 'communication', suporte: 'users', sistema: 'system',
}

interface Props {
  currentView: string
  onNavigate: (v: AdminView) => void
  onExit: () => void
  userEmail?: string
  userName?: string
  children: ReactNode
}

export default function AdminLayout({ currentView, onNavigate, onExit, userEmail, userName, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [allowed, setAllowed] = useState<Set<string> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState('')
  const [alerts, setAlerts] = useState<AdminAlert[]>([])
  // undefined = ainda não carregou; nunca tratamos "sem dados" como "sem problemas".
  const [alertsLoadedOk, setAlertsLoadedOk] = useState<boolean | undefined>(undefined)
  const active = deriveActive(currentView)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.rpc('admin_my_permissions')
      if (!alive) return
      const mods = (data as string[] | null) ?? null
      if (error || !mods || mods.includes('*')) { setAllowed(null); return }
      setAllowed(new Set(mods))
    })().catch(() => { setAllowed(null) })
    return () => { alive = false }
  }, [])

  const name = userName || (userEmail ? userEmail.split('@')[0] : 'Administrador')
  const initials = (name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('') || 'AD').toUpperCase()

  function canShow(item: NavItem) {
    if (!allowed) return true
    const mod = AREA_MODULE[item.id]
    return !mod || mod === 'permissions' || allowed.has(mod)
  }

  const visibleNav = NAV_GROUPS
    .map(group => ({ ...group, items: group.items.filter(canShow) }))
    .filter(group => group.items.length > 0)

  const searchResults = useMemo(() => {
    const canUseModule = (module?: string) => !module || !allowed || allowed.has(module)
    const q = normalizeSearch(searchQuery)
    if (!q) return SEARCH_ITEMS.filter(item => canUseModule(item.module)).slice(0, 8)
    return SEARCH_ITEMS
      .filter(item => canUseModule(item.module))
      .map(item => ({ item, haystack: normalizeSearch([item.label, item.description, ...item.keywords].join(' ')) }))
      .filter(({ haystack }) => haystack.includes(q))
      .map(({ item }) => item)
      .slice(0, 8)
  }, [searchQuery, allowed])

  function navigateTo(view: AdminView) {
    onNavigate(view)
    setSearchOpen(false)
    setSearchQuery('')
    setAlertsOpen(false)
  }

  function go(item: NavItem) {
    onNavigate(item.id)
    setSidebarOpen(false)
  }

  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    setAlertsError('')

    // Fonte ÚNICA: adminOperationalStatus (RPC admin_queues_overview). Sem
    // re-consultar support_tickets / guidance / cancellations por conta própria.
    const snap = await fetchOperationalSnapshot()
    if (!snap.ok) setAlertsError('Painel de filas indisponível')
    const q = snap.queues
    const f = snap.failuresActive

    const candidates: AdminAlert[] = [
      { key: 'tickets', label: 'Tickets de suporte abertos', count: q.tickets_open ?? 0, view: 'support', severity: 'warning' },
      { key: 'tickets-stale', label: 'Tickets parados há +7 dias', count: q.tickets_stale_7d ?? 0, view: 'support', severity: 'error' },
      { key: 'guidance', label: 'Orientações aguardando resposta', count: q.guidance_pending ?? 0, view: 'guidance-requests', severity: 'warning' },
      { key: 'reports-review', label: 'Relatórios aguardando revisão', count: q.reports_pending_review ?? 0, view: 'pdf', severity: 'warning' },
      { key: 'care-plans', label: 'Planos de autocuidado pendentes', count: q.care_plans_pending ?? 0, view: 'self-care-plans', severity: 'warning' },
      { key: 'personalization-overdue', label: 'Personalizações vencidas', count: q.personalization_overdue ?? 0, view: 'personalization', severity: 'error' },
      { key: 'cancellations', label: 'Cancelamentos a revisar', count: q.cancellations_to_handle ?? 0, view: 'cancelamentos', severity: 'warning' },
      { key: 'notifications-draft', label: 'Campanhas em rascunho', count: q.notifications_draft ?? 0, view: 'comunicacao', severity: 'warning' },
      { key: 'ai', label: 'Falhas ativas de IA', count: f.ai_errors ?? 0, view: 'uso-ia', severity: 'error' },
      { key: 'email', label: 'Falhas ativas de e-mail', count: f.emails_failed ?? 0, view: 'emails', severity: 'error' },
      { key: 'reports', label: 'Relatórios com falha', count: f.reports_failed ?? 0, view: 'pdf', severity: 'error' },
      { key: 'care-plans-failed', label: 'Planos de autocuidado com falha', count: f.care_plans_failed ?? 0, view: 'self-care-plans', severity: 'error' },
      { key: 'content-jobs', label: 'Jobs de conteúdo com falha', count: f.content_jobs_failed ?? 0, view: 'automacoes-blog', severity: 'error' },
      { key: 'webhooks-stuck', label: 'Webhooks Stripe travados', count: q.webhooks_stuck ?? 0, view: 'financeiro', severity: 'error' },
      { key: 'webhooks-failed', label: 'Webhooks Stripe com falha', count: f.webhooks_failed ?? 0, view: 'financeiro', severity: 'error' },
    ]
    const next = candidates.filter(item => item.count > 0)

    setAlerts(next)
    setAlertsLoadedOk(snap.ok)
    setAlertsLoading(false)
  }, [])

  // Carrega o snapshot ao entrar no Admin (badge aparece sem clique) e atualiza
  // em intervalo moderado. Não bloqueia a renderização do Admin.
  useEffect(() => {
    void loadAlerts()
    const id = window.setInterval(() => { void loadAlerts() }, 180_000)
    const onFocus = () => { void loadAlerts() }
    window.addEventListener('focus', onFocus)
    return () => { window.clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [loadAlerts])

  function toggleAlerts() {
    const next = !alertsOpen
    setAlertsOpen(next)
    setSearchOpen(false)
    if (next) void loadAlerts()
  }

  const alertCount = alerts.reduce((sum, item) => sum + item.count, 0)
  // Estado desconhecido: já tentou carregar e a fonte principal falhou, sem itens.
  const alertsUnknown = alertsLoadedOk === false && alertCount === 0

  const Sidebar = () => (
    <aside className="admin-sidebar w-[250px] text-forest-100 flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
        <LogoIcon className="w-8 h-8 text-white flex-shrink-0" />
        <div className="leading-tight min-w-0">
          <p className="font-serif text-white text-[17px] truncate">A Vida Não Colabora</p>
          <p className="text-[10px] tracking-[0.22em] text-forest-300 uppercase mt-1">Área Administrativa</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleNav.map(group => (
          <div key={group.label}>
            <div className="admin-nav-section">{group.label}</div>
            <div className="space-y-1 px-1">
              {group.items.map(item => {
                const Icon = item.icon
                const on = active === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => go(item)}
                    className={`admin-nav-button ${on ? 'is-active' : ''} w-full flex items-center gap-3 px-3 py-2.5 text-[13px] text-left`}
                  >
                    <Icon className="w-[17px] h-[17px] flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/10 space-y-2 flex-shrink-0">
        <button
          onClick={() => window.open('/', '_blank')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 text-forest-100 transition-colors"
        >
          <ExternalLink className="w-4 h-4" /> Ver site
        </button>
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white truncate">{name}</p>
            <p className="text-[11px] text-forest-300">Administrador</p>
          </div>
          <button onClick={onExit} title="Voltar ao blog (continua logado)" className="text-forest-300 hover:text-white p-1 flex-shrink-0">
            <ArrowLeftFromLine className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="admin-shell flex min-h-screen">
      <div className="hidden md:flex flex-shrink-0 h-screen sticky top-0"><Sidebar /></div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="flex-shrink-0 h-screen"><Sidebar /></div>
          <div className="flex-1 bg-black/45" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <header className="admin-topbar sticky top-0 z-20 border-b flex items-center gap-3 px-4 md:px-6 h-[62px] flex-shrink-0">
          <button className="md:hidden p-2 text-forest-900" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu">
            <Menu className="w-5 h-5" />
          </button>

          <div className="admin-search-wrap hidden sm:block relative">
            <Search className="admin-search-icon w-4 h-4" />
            <input
              className="admin-search"
              placeholder="Buscar no admin..."
              aria-label="Buscar no admin"
              aria-expanded={searchOpen}
              value={searchQuery}
              onFocus={() => { setSearchOpen(true); setAlertsOpen(false) }}
              onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true) }}
              onKeyDown={event => {
                if (event.key === 'Escape') { setSearchOpen(false); return }
                if (event.key === 'Enter' && searchResults[0]) {
                  event.preventDefault()
                  navigateTo(searchResults[0].view)
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchOpen(true) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {searchOpen && (
              <div className="absolute left-0 top-[calc(100%+8px)] w-[min(560px,80vw)] rounded-2xl border border-line bg-white shadow-xl overflow-hidden z-50">
                <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-stone-400 border-b border-line">Navegar no Admin</div>
                {searchResults.length === 0 ? (
                  <div className="px-4 py-5 text-sm text-stone-500">Nenhum resultado para “{searchQuery}”.</div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto py-1">
                    {searchResults.map(item => (
                      <button
                        key={`${item.view}-${item.label}`}
                        type="button"
                        onClick={() => navigateTo(item.view)}
                        className="w-full text-left px-4 py-2.5 hover:bg-stone-50 focus:bg-stone-50 focus:outline-none"
                      >
                        <p className="text-sm font-medium text-forest-900">{item.label}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{item.description}</p>
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2 text-[10px] text-stone-400 border-t border-line">Enter abre o primeiro resultado · Esc fecha</div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2.5 relative">
            <button
              type="button"
              onClick={toggleAlerts}
              className="relative w-9 h-9 rounded-full border border-[#ded5c8] bg-[#fffdf9] flex items-center justify-center text-[#637069] hover:bg-[#f5efe6]"
              aria-label="Alertas administrativos"
              aria-expanded={alertsOpen}
            >
              <Bell className="w-4 h-4" />
              {alertCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-semibold flex items-center justify-center">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              ) : alertsUnknown ? (
                <span
                  title="Não foi possível verificar os alertas — clique para tentar de novo"
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"
                />
              ) : null}
            </button>
            {alertsOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] w-[min(420px,90vw)] rounded-2xl border border-line bg-white shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-forest-900">Central de alertas</p>
                    <p className="text-[11px] text-stone-400">Itens que precisam de atenção agora</p>
                  </div>
                  <button type="button" onClick={() => void loadAlerts()} className="text-xs text-forest-700 hover:text-forest-900">Atualizar</button>
                </div>
                {alertsLoading ? (
                  <div className="px-4 py-8 flex items-center justify-center gap-2 text-sm text-stone-500"><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</div>
                ) : alerts.length === 0 && !alertsError ? (
                  <div className="px-4 py-8 text-center text-sm text-stone-500">Nenhuma pendência ativa encontrada.</div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
                    {alerts.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => navigateTo(item.view)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-stone-50"
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center ${item.severity === 'error' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                        <span className="flex-1 text-sm text-stone-700">{item.label}</span>
                        <span className="text-sm font-semibold text-forest-900 tabular-nums">{item.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                {alertsError && <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 text-[11px] text-amber-800">Algumas fontes não puderam ser verificadas: {alertsError}</div>}
              </div>
            )}
            <span className="w-9 h-9 rounded-full bg-[#E7F0EA] flex items-center justify-center text-xs font-semibold text-forest-700">{initials}</span>
            <div className="hidden sm:block leading-tight">
              <p className="text-sm text-forest-900">{name}</p>
              <p className="text-[11px] text-ink-soft">Administrador</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
