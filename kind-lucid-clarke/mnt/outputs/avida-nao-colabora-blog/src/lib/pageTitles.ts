// Títulos e metadados por rota, centralizados.
//
// Motivo: como é uma SPA, o <title> e as meta tags de OG só mudavam quando um
// componente cuidava disso por conta própria (só o ArticleView fazia). Ao sair
// de um artigo, o título ficava preso no nome do artigo. Aqui definimos o
// título de cada view e reaplicamos a cada troca de rota; o ArticleView
// continua responsável pelo caso dele (título específico do artigo).

export const SITE_NAME = 'A Vida Não Colabora'
export const HOME_TITLE = `${SITE_NAME} — Bem-estar emocional e autoconhecimento`
// Título seguro para artigos enquanto o conteúdo ainda carrega (o ArticleView
// troca pelo título real do artigo assim que os dados chegam).
export const ARTICLE_FALLBACK_TITLE = `Conteúdos Guiados — ${SITE_NAME}`
const DEFAULT_DESCRIPTION =
  'Um espaço para organizar o que você sente, acompanhar seus padrões emocionais e cuidar de si com mais leveza.'
const ORIGIN = 'https://www.avidanaocolabora.com'

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
  articles: 'Conteúdos Guiados',
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

  const url = `${ORIGIN}${pathname}`
  const setMeta = (selector: string, content: string) => {
    const el = document.head.querySelector(selector)
    if (el) el.setAttribute('content', content)
  }
  setMeta('meta[name="description"]', DEFAULT_DESCRIPTION)
  setMeta('meta[property="og:title"]', title)
  setMeta('meta[property="og:description"]', DEFAULT_DESCRIPTION)
  setMeta('meta[property="og:url"]', url)
  setMeta('meta[name="twitter:title"]', title)
  setMeta('meta[name="twitter:description"]', DEFAULT_DESCRIPTION)
  const canonicalLink = document.head.querySelector('link[rel="canonical"]')
  if (canonicalLink) canonicalLink.setAttribute('href', url)
}