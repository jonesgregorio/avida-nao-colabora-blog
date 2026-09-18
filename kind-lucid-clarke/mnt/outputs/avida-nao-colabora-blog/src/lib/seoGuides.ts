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

export interface GuideToolDestination {
  href: string
  view: string
  ref?: string
}

export const SEO_PILLAR_GUIDES: SeoGuide[] = [
  { title:'Diário emocional', slug:'como-comecar-um-diario-emocional-sem-saber-o-que-escrever', description:'Entenda o que é um diário emocional, veja exemplos reais de estrutura e encontre um jeito de começar sem transformar o registro em cobrança.', cluster:'Diário emocional', searchIntent:'Como começar um diário emocional', accent:'Começar a escrever', relatedTerms:['diário emocional','escrita emocional','autoconhecimento','registro emocional','exemplo de diário emocional'], tool:'diary', supportingSlugs:['diario-emocional-exemplo-preenchido-passo-a-passo','comece-pequeno-um-guia-para-o-primeiro-registro','como-registrar-seu-dia-em-uma-frase','perguntas-simples-para-entender-como-voce-esta-hoje','3-perguntas-para-fechar-o-dia-com-mais-clareza','por-que-escrever-sobre-o-dia-pode-ajudar-a-organizar-a-mente','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca','diario-emocional-no-celular-ou-no-papel'] },
  { title:'Emoções e autoconhecimento', slug:'faca-seu-primeiro-check-in-emocional', description:'Comece por um check-in simples, diferencie emoção, pensamento e necessidade e aprofunde a percepção do que está acontecendo sem buscar uma resposta perfeita.', cluster:'Emoções e autoconhecimento', searchIntent:'Como entender o que estou sentindo', accent:'Perceber e diferenciar', relatedTerms:['check-in emocional','emoções','autoconhecimento','como entender o que sinto','emoção e pensamento'], tool:'checkin', supportingSlugs:['emocao-pensamento-ou-necessidade-como-perceber-a-diferenca','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-per','perguntas-simples-para-entender-como-voce-esta-hoje'] },
  { title:'Sobrecarga emocional', slug:'como-perceber-se-hoje-foi-um-dia-de-sobrecarga', description:'Reconheça sinais de sobrecarga, diferencie cansaço de excesso recorrente e encontre um próximo passo possível sem tentar resolver tudo de uma vez.', cluster:'Sobrecarga emocional', searchIntent:'Sinais de sobrecarga emocional e o que fazer', accent:'Reconhecer e reorganizar', relatedTerms:['sobrecarga emocional','cansaço mental','mente sobrecarregada','desacelerar','o que fazer quando estou sobrecarregado'], tool:'map', supportingSlugs:['o-que-fazer-quando-voce-percebe-que-esta-sobrecarregado','como-saber-se-estou-so-cansando-ou-sobrecarregando-demais','5-sinais-de-que-voce-precisa-desacelerar','o-que-observar-quando-a-cabeca-esta-cheia','como-fazer-uma-pausa-quando-a-mente-nao-desacelera','como-lidar-com-dias-em-que-tudo-parece-pesado','um-exercicio-de-pausa-para-dias-pesados'] },
  { title:'Autocuidado emocional', slug:'o-que-e-autocuidado-emocional-na-vida-real', description:'Entenda o que é autocuidado emocional, monte uma rotina possível e ajuste o cuidado conforme energia, limites e necessidades do dia.', cluster:'Autocuidado emocional', searchIntent:'O que é autocuidado emocional e como praticar', accent:'Cuidar de um jeito possível', relatedTerms:['autocuidado emocional','rotina de autocuidado emocional','autocuidado real','cuidado possível','baixa energia'], tool:'self-care', supportingSlugs:['rotina-de-autocuidado-emocional-como-criar-uma-versao-possivel','autocuidado-nao-precisa-ser-bonito-para-funcionar','o-que-fazer-quando-voce-tem-pouca-energia-para-se-cuidar','como-recomecar-depois-de-uma-semana-emocionalmente-dificil','nem-todo-dia-precisa-render'] },
  { title:'Sono, descanso e energia', slug:'como-organizar-o-sono-quando-a-rotina-saiu-do-eixo', description:'Reorganize o ritmo noturno, aprenda a desacelerar antes de dormir e diferencie descanso de adiamento sem transformar o sono em cobrança.', cluster:'Sono, descanso e energia', searchIntent:'Como organizar o sono e desacelerar antes de dormir', accent:'Encerrar o dia com menos cobrança', relatedTerms:['sono','rotina de sono','descanso','mente acelerada antes de dormir','desacelerar à noite'], tool:'map', supportingSlugs:['como-desacelerar-a-mente-antes-de-dormir-sem-transformar-o-sono-em-cobranca','a-diferenca-entre-descansar-e-fugir-de-tudo'] },
  { title:'Relações e limites', slug:'como-conversar-sobre-os-seus-limites-sem-transformar-tudo-em', description:'Aprenda a comunicar limites, dizer não com mais clareza e proteger sua disponibilidade sem transformar toda diferença em confronto.', cluster:'Relações e limites', searchIntent:'Como colocar limites e dizer não sem culpa', accent:'Comunicar sem se abandonar', relatedTerms:['como colocar limites','dizer não sem culpa','limites pessoais','comunicação de limites','relações'], tool:'diary', supportingSlugs:['como-dizer-nao-sem-culpa-e-preservar-sua-energia'] },
]

export const SEO_CLUSTERS = SEO_PILLAR_GUIDES.map(guide => guide.cluster)
const GUIDE_KEYS: Record<string,string> = {
  'Diário emocional':'diario-emocional',
  'Emoções e autoconhecimento':'emocoes-autoconhecimento',
  'Sobrecarga emocional':'sobrecarga-emocional',
  'Autocuidado emocional':'autocuidado-emocional',
  'Sono, descanso e energia':'sono-descanso-energia',
  'Relações e limites':'relacoes-limites',
}
export function guideKeyFor(guide: SeoGuide){ return GUIDE_KEYS[guide.cluster] ?? 'relacoes-limites' }
export function guidePathFor(guide: SeoGuide){ return `/guias/${guideKeyFor(guide)}` }
export function getSeoGuideForArticle(slug?: string|null){ if(!slug)return undefined; return SEO_PILLAR_GUIDES.find(g=>g.slug===slug||g.supportingSlugs.includes(slug)) }
export function getCuratedRelatedSlugs(slug?: string|null,limit=3){ const guide=getSeoGuideForArticle(slug); if(!guide||!slug)return[]; return [guide.slug,...guide.supportingSlugs].filter(s=>s!==slug).slice(0,limit) }
export function guideToolPath(guide?:SeoGuide): GuideToolDestination {
  if (!guide || guide.tool === 'diary') return { href:'/diario', view:'diary' }
  if (guide.tool === 'self-care') return { href:'/plano-de-autocuidado', view:'self-care' }
  if (guide.tool === 'map') return { href:'/mapa-emocional', view:'my-evolution' }
  // O check-in rápido vive na Home autenticada; não existe rota /checkin independente.
  return { href:'/', view:'home', ref:'checkin' }
}
