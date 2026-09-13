// Títulos e metadados por rota, centralizados.
//
// Motivo: como é uma SPA, o <title> e as meta tags de OG só mudavam quando um
// componente cuidava disso por conta própria (só o ArticleView fazia). Ao sair
// de um artigo, o título ficava preso no nome do artigo. Aqui definimos o
// título de cada view e reaplicamos a cada troca de rota; o ArticleView
// continua responsável pelo caso dele (título específico do artigo).

export const SITE_NAME = 'A Vida Não Colabora'
export const HOME_TITLE = `${SITE_NAME} — Diário emocional e autocuidado`
// Título seguro para artigos enquanto o conteúdo ainda carrega (o ArticleView
// troca pelo título real do artigo assim que os dados chegam).
export const ARTICLE_FALLBACK_TITLE = `Conteúdos Guiados — ${SITE_NAME}`
const DEFAULT_DESCRIPTION =
  'Um espaço para organizar o que você sente, acompanhar seus padrões emocionais e cuidar de si com mais leveza.'
const ORIGIN = 'https://www.avidanaocolabora.com'

const PUBLIC_META: Record<string, { path: string; description: string }> = {
  home: { path: '/', description: 'Organize o que você sente com diário emocional, check-ins, mapa emocional, conteúdos e recursos de autocuidado em um espaço privado e acolhedor.' },
  articles: { path: '/blog', description: 'Conteúdos sobre bem-estar emocional, autoconhecimento, relações, rotina e autocuidado para ajudar você a organizar o que sente com mais leveza.' },
  guides: { path: '/guias', description: 'Guias completos sobre diário emocional, check-in, padrões emocionais, ansiedade, limites, rotina e autocuidado para começar com clareza.' },
  pricing: { path: '/planos', description: 'Compare os planos da A Vida Não Colabora e escolha os recursos de diário emocional e autocuidado que fazem sentido para você.' },
  faq: { path: '/faq', description: 'Dúvidas sobre recursos, planos, conta, privacidade e funcionamento da A Vida Não Colabora.' },
  about: { path: '/sobre', description: 'Conheça a proposta da A Vida Não Colabora: organização emocional, autoconhecimento e autocuidado com linguagem acolhedora.' },
  contact: { path: '/contato', description: 'Entre em contato com a equipe da A Vida Não Colabora para dúvidas, suporte e informações sobre a plataforma.' },
  privacy: { path: '/privacidade', description: 'Saiba como a A Vida Não Colabora trata dados pessoais e registros emocionais.' },
  terms: { path: '/termos', description: 'Consulte os Termos de Uso da A Vida Não Colabora.' },
  responsibility: { path: '/aviso-de-responsabilidade', description: 'Entenda os limites dos recursos de bem-estar da A Vida Não Colabora e quando procurar atendimento profissional.' },
  'editorial-policy': { path: '/politica-editorial', description: 'Conheça os critérios de autoria, revisão, fontes, atualização e segurança dos conteúdos da A Vida Não Colabora.' },
}

const VIEW_TITLES: Record<string, string> = {
  home: HOME_TITLE,
  auth: 'Entrar',
  diary: 'Diário',
  descobertas: 'Descobertas',
  'my-evolution': 'Mapa Emocional',
  'my-report': 'Relatórios',
  'my-history': 'Minha História',
  'my-garden': 'Meu Jardim',
  'self-care': 'Plano de Autocuidado',
  'monthly-guidance': 'Orientação',
  'professional-comments': 'Orientação',
  articles: 'Blog',
  guides: 'Guias de bem-estar emocional',
  'editorial-policy': 'Política editorial',
  article: 'Conteúdos Guiados',
  questionarios: 'Questionários',
  'questionarios-evolucao': 'Questionários',
  questionnaire: 'Questionário',
  'my-plan': 'Meu Plano',
  profile: 'Perfil',
  support: 'Suporte',
  'support-ticket': 'Suporte',
  notifications: 'Notificações',
  pricing: 'Planos',
  mais: 'Mais',
  cuidar: 'Cuidar',
  about: 'Sobre',
  contact: 'Contato',
  faq: 'Perguntas frequentes',
  privacy: 'Política de Privacidade',
  terms: 'Termos de Uso',
  responsibility: 'Aviso de Responsabilidade',
  admin: 'Painel Admin',
  success: 'Assinatura confirmada',
}

export function titleForView(view: string): string {
  if (view === 'home') return HOME_TITLE
  const label = VIEW_TITLES[view]
  return label ? `${label} — ${SITE_NAME}` : HOME_TITLE
}

/**
 * Atualiza <title> e as meta tags de descrição/OG/canonical para a view atual.
 * Para `view === 'article'` NÃO tocamos em nada: o ArticleView é o dono exclusivo
 * do título/OG do artigo (título específico quando carrega, fallback enquanto isso).
 */
export function applyRouteMetadata(view: string, pathname = window.location.pathname): void {
  if (view === 'article') return

  const title = titleForView(view)
  document.title = title

  const publicMeta = PUBLIC_META[view]
  const url = `${ORIGIN}${publicMeta?.path ?? pathname}`
  const setMeta = (selector: string, content: string) => {
    const el = document.head.querySelector(selector)
    if (el) el.setAttribute('content', content)
  }
  const description = publicMeta?.description ?? DEFAULT_DESCRIPTION
  setMeta('meta[name="description"]', description)
  setMeta('meta[name="robots"]', publicMeta ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive')
  setMeta('meta[property="og:title"]', title)
  setMeta('meta[property="og:description"]', description)
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[name="twitter:title"]', title)
  setMeta('meta[name="twitter:description"]', description)
  const canonicalLink = document.head.querySelector('link[rel="canonical"]')
  if (canonicalLink) canonicalLink.setAttribute('href', url)
}
