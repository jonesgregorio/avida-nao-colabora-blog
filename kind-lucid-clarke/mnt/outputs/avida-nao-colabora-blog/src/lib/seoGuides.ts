export interface SeoGuide {
  title: string
  slug: string
  description: string
  cluster: string
  searchIntent: string
  accent: string
  relatedTerms: string[]
  supportingSlugs: string[]
  tool?: 'diary' | 'checkin' | 'map' | 'self-care'
}

// Apenas artigos PUBLICOS e indexáveis entram como portas de entrada dos clusters.
// Isso evita que /guias envie visitantes e robôs para conteúdo bloqueado por plano.
export const SEO_PILLAR_GUIDES: SeoGuide[] = [
  {
    title: 'Diário emocional',
    slug: 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever',
    description: 'Um guia para entender o diário emocional, para que ele serve e como começar mesmo sem saber exatamente o que escrever.',
    cluster: 'Diário emocional', searchIntent: 'Como começar um diário emocional', accent: 'Começar a escrever',
    relatedTerms: ['diário emocional', 'escrita emocional', 'autoconhecimento', 'registro emocional'], tool: 'diary',
    supportingSlugs: ['comece-pequeno-um-guia-para-o-primeiro-registro','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigacao','como-registrar-seu-dia-em-uma-frase','por-que-escrever-sobre-o-dia-pode-ajudar-a-organizar-a-mente','3-perguntas-para-fechar-o-dia-com-mais-clareza'],
  },
  {
    title: 'Emoções e autoconhecimento', slug: 'faca-seu-primeiro-check-in-emocional',
    description: 'Aprenda a perceber e nomear o que está acontecendo por dentro sem exigir uma resposta perfeita.',
    cluster: 'Emoções', searchIntent: 'Como entender o que estou sentindo', accent: 'Perceber como você está',
    relatedTerms: ['check-in emocional', 'emoções', 'humor', 'autoconhecimento'], tool: 'checkin',
    supportingSlugs: ['perguntas-simples-para-entender-como-voce-esta-hoje','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-perfeita'],
  },
  {
    title: 'Sobrecarga emocional', slug: 'como-perceber-se-hoje-foi-um-dia-de-sobrecarga',
    description: 'Reconheça sinais de sobrecarga, diferencie cansaço de excesso emocional e encontre formas possíveis de desacelerar.',
    cluster: 'Sobrecarga', searchIntent: 'Sinais de sobrecarga emocional e o que fazer', accent: 'Reconhecer seus sinais',
    relatedTerms: ['sobrecarga emocional', 'cansaço mental', 'estresse emocional', 'desacelerar'], tool: 'map',
    supportingSlugs: ['como-saber-se-estou-so-cansando-ou-sobrecarregando-demais','5-sinais-de-que-voce-precisa-desacelerar','o-que-observar-quando-a-cabeca-esta-cheia','como-lidar-com-dias-em-que-tudo-parece-pesado','como-fazer-uma-pausa-quando-a-mente-nao-desacelera'],
  },
  {
    title: 'Autocuidado emocional', slug: 'o-que-e-autocuidado-emocional-na-vida-real',
    description: 'Entenda o autocuidado como escolhas realistas que respeitam energia, rotina e necessidades do momento.',
    cluster: 'Autocuidado', searchIntent: 'O que é autocuidado emocional', accent: 'Cuidar sem se cobrar',
    relatedTerms: ['autocuidado emocional', 'bem-estar', 'rotina de autocuidado', 'cuidado possível'], tool: 'self-care',
    supportingSlugs: ['autocuidado-nao-precisa-ser-bonito-para-funcionar','o-que-fazer-quando-voce-tem-pouca-energia-para-se-cuidar','como-recomecar-depois-de-uma-semana-emocionalmente-dificil','nem-todo-dia-precisa-render'],
  },
  {
    title: 'Sono, descanso e energia', slug: 'como-organizar-o-sono-quando-a-rotina-saiu-do-eixo',
    description: 'Observe sono, descanso e energia como partes da rotina emocional e encontre ajustes possíveis para dias fora do eixo.',
    cluster: 'Sono e descanso', searchIntent: 'Como organizar o sono e descansar melhor na rotina', accent: 'Observar corpo e rotina',
    relatedTerms: ['sono', 'descanso', 'energia', 'rotina'], tool: 'map',
    supportingSlugs: ['a-diferenca-entre-descansar-e-fugir-de-tudo','um-exercicio-de-pausa-para-dias-pesados'],
  },
  {
    title: 'Relações e limites', slug: 'como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito',
    description: 'Um ponto de partida para comunicar limites, preservar energia e cuidar das relações sem transformar tudo em confronto.',
    cluster: 'Relações e limites', searchIntent: 'Como colocar limites sem criar conflito', accent: 'Proteger sua energia',
    relatedTerms: ['limites emocionais', 'relações', 'comunicação', 'conflito'], tool: 'diary', supportingSlugs: [],
  },
]

export const SEO_CLUSTERS = SEO_PILLAR_GUIDES.map((guide) => guide.cluster)

export function getSeoGuideForArticle(slug?: string | null) {
  if (!slug) return undefined
  return SEO_PILLAR_GUIDES.find((guide) => guide.slug === slug || guide.supportingSlugs.includes(slug))
}

export function getCuratedRelatedSlugs(slug?: string | null, limit = 3): string[] {
  const guide = getSeoGuideForArticle(slug)
  if (!guide || !slug) return []
  const sequence = [guide.slug, ...guide.supportingSlugs].filter((item) => item !== slug)
  return sequence.slice(0, limit)
}
