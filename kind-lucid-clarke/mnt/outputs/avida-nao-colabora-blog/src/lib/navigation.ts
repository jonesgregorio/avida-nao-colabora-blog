import type { View } from '../types'

export const PERSIST_KEY = 'avida_nav'

// Views válidas — SOMENTE as que existem nos 3 planos oficiais + utilitários de conta.
export const VALID_VIEWS: View[] = [
  'home','auth','diary','profile',
  'about','privacy','terms','questionnaire','questionarios','pricing',
  'articles','article','responsibility','admin','contact','success','faq',
  'support','support-ticket','monthly-guidance','professional-comments','my-plan','my-report','my-evolution','my-history','self-care',
  'notifications',
]

// Mapeamento bidirecional URL ↔ view.
const URL_TO_VIEW: Record<string, View> = {
  '/':                           'home',
  '/blog':                       'articles',
  '/conteudos':                  'articles',
  '/planos':                     'pricing',
  '/faq':                        'faq',
  '/perguntas-frequentes':       'faq',
  '/sobre':                      'about',
  '/contato':                    'contact',
  '/privacidade':                'privacy',
  '/termos':                     'terms',
  '/aviso-de-responsabilidade':  'responsibility',
  '/admin':                      'admin',
  '/login':                      'auth',
  '/diario':                     'diary',
  '/perfil':                     'profile',
  '/questionarios':              'questionarios',
  '/sucesso':                    'success',
  '/suporte':                    'support',
  '/notificacoes':               'notifications',
  '/guia-mensal':                'monthly-guidance',
  '/comentarios-profissional':   'professional-comments',
  '/mapa-emocional':             'my-evolution',
  '/meu-relatorio':              'my-report',
  '/minha-historia':             'my-history',
  '/plano-de-autocuidado':       'self-care',
  '/meu-plano':                  'my-plan',
}

// Rotas antigas de módulos removidos do MVP → destino válido nos novos planos.
const LEGACY_PATH_REDIRECT: Record<string, View> = {
  '/meditacoes': 'articles',
  '/desafios':   'articles',
  '/trilhas':    'articles',
  '/conquistas': 'home',
  '/lembretes':  'home',
  '/itens-salvos': 'home',
  '/favoritos':  'home',
  '/sessoes':    'home',
  '/sessao':     'home',
}

// Views antigas ainda referenciadas por chamadas navigate() em telas legadas.
const LEGACY_VIEW_REDIRECT: Record<string, View> = {
  meditations: 'articles',
  challenges:  'articles',
  trails:      'articles',
  content:     'articles',
  'therapeutic-q': 'questionarios',
  saved:         'home',
  conquistas:    'home',
  lembretes:     'home',
}

// Aliases amigáveis: resolvem para uma view, mas a URL canônica continua sendo a
// definida em URL_TO_VIEW.
const URL_ALIASES: Record<string, View> = {
  '/orientacao':  'monthly-guidance',
  '/orientacoes': 'monthly-guidance',
  '/minha-evolucao': 'my-evolution',
}

const VIEW_TO_URL: Record<string, string> = Object.fromEntries(
  Object.entries(URL_TO_VIEW).map(([url, view]) => [view, url])
)

export interface NavigationState {
  view: View
  articleSlug: string | null
  ticketId: string | null
  questionnaireId?: string | null
}

export function parseNavLocation(path: string, search = ''): NavigationState | null {
  // /blog/:slug → article
  if (path.startsWith('/blog/') && path.length > 6) {
    return { view: 'article', articleSlug: path.slice(6), ticketId: null }
  }

  // /suporte/:ticketId → support-ticket
  if (path.startsWith('/suporte/') && path.length > 9) {
    return { view: 'support-ticket', articleSlug: null, ticketId: path.slice(9) }
  }

  // Rota antiga do questionário terapêutico → Questionários.
  if (path === '/questionario-terapeutico') {
    return { view: 'questionarios', articleSlug: null, ticketId: null }
  }

  if (LEGACY_PATH_REDIRECT[path]) {
    return { view: LEGACY_PATH_REDIRECT[path], articleSlug: null, ticketId: null }
  }

  // Compatibilidade com links antigos e redirecionamentos Stripe (?view=X).
  const params = new URLSearchParams(search)
  const urlView = params.get('view') as View
  if (urlView && VALID_VIEWS.includes(urlView)) {
    return { view: urlView, articleSlug: null, ticketId: null }
  }

  const mapped = URL_TO_VIEW[path] ?? URL_ALIASES[path]
  if (mapped) return { view: mapped, articleSlug: null, ticketId: null }

  return null
}

export function parseURLNav(): NavigationState | null {
  try {
    return parseNavLocation(window.location.pathname, window.location.search)
  } catch {
    return null
  }
}

export function restoreNavFrom(
  pathname: string,
  search: string,
  storage: Pick<Storage, 'getItem'>,
): NavigationState | null {
  const fromURL = parseNavLocation(pathname, search)
  if (fromURL) return fromURL

  // Só retomamos a sessão salva na raiz. Um path específico desconhecido vai ao
  // Início em vez de cair na última tela visitada.
  if (pathname !== '/') return null

  try {
    const raw = storage.getItem(PERSIST_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as NavigationState
    if (saved.view === 'auth') return null
    if (!VALID_VIEWS.includes(saved.view)) return null
    return saved
  } catch {
    return null
  }
}

export function restoreNav(): NavigationState | null {
  try {
    return restoreNavFrom(window.location.pathname, window.location.search, window.localStorage)
  } catch {
    return null
  }
}

export function normalizeLegacyView(section: string): string {
  return LEGACY_VIEW_REDIRECT[section] ?? section
}

export function urlForView(targetView: string, slug?: string | null, ticketId?: string | null): string {
  if (targetView === 'article' && slug) return `/blog/${slug}`
  if (targetView === 'support-ticket' && ticketId) return `/suporte/${ticketId}`
  return VIEW_TO_URL[targetView] ?? '/'
}

/**
 * Retorna apenas quando a URL atual precisa ser substituída por uma URL canônica.
 * null significa que a URL já é válida e deve permanecer como está.
 */
export function canonicalPathForLocation(path: string, search = ''): string | null {
  const target = LEGACY_PATH_REDIRECT[path] ?? URL_ALIASES[path]
  if (target) return VIEW_TO_URL[target] ?? '/'
  if (path !== '/' && !parseNavLocation(path, search)) return '/'
  return null
}
