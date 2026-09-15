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

export const SEO_PILLAR_GUIDES: SeoGuide[] = [
  { title:'Diário emocional', slug:'como-comecar-um-diario-emocional-sem-saber-o-que-escrever', description:'Entenda o que é um diário emocional, para que ele pode servir e como começar sem transformar o registro em cobrança.', cluster:'Diário emocional', searchIntent:'Como começar um diário emocional', accent:'Começar a escrever', relatedTerms:['diário emocional','escrita emocional','autoconhecimento','registro emocional'], tool:'diary', supportingSlugs:['comece-pequeno-um-guia-para-o-primeiro-registro','como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigacao','como-registrar-seu-dia-em-uma-frase','por-que-escrever-sobre-o-dia-pode-ajudar-a-organizar-a-mente','3-perguntas-para-fechar-o-dia-com-mais-clareza'] },
  { title:'Emoções e autoconhecimento', slug:'faca-seu-primeiro-check-in-emocional', description:'Perceba, nomeie e contextualize emoções com mais clareza, sem exigir uma resposta perfeita sobre o que você sente.', cluster:'Emoções e autoconhecimento', searchIntent:'Como entender o que estou sentindo', accent:'Perceber como você está', relatedTerms:['check-in emocional','emoções','humor','autoconhecimento'], tool:'checkin', supportingSlugs:['perguntas-simples-para-entender-como-voce-esta-hoje','como-nomear-uma-emocao-sem-se-cobrar','o-que-fazer-quando-voce-nao-sabe-explicar-o-que-sente','como-perceber-o-que-voce-sente-sem-procurar-uma-resposta-perfeita'] },
  { title:'Sobrecarga emocional', slug:'como-perceber-se-hoje-foi-um-dia-de-sobrecarga', description:'Reconheça sinais de sobrecarga, diferencie cansaço de excesso emocional e organize próximos passos possíveis.', cluster:'Sobrecarga emocional', searchIntent:'Sinais de sobrecarga emocional e o que fazer', accent:'Reconhecer seus sinais', relatedTerms:['sobrecarga emocional','cansaço mental','estresse emocional','desacelerar'], tool:'map', supportingSlugs:['como-saber-se-estou-so-cansando-ou-sobrecarregando-demais','5-sinais-de-que-voce-precisa-desacelerar','o-que-observar-quando-a-cabeca-esta-cheia','como-lidar-com-dias-em-que-tudo-parece-pesado','como-fazer-uma-pausa-quando-a-mente-nao-desacelera'] },
  { title:'Autocuidado emocional', slug:'o-que-e-autocuidado-emocional-na-vida-real', description:'Entenda autocuidado emocional como escolhas realistas que respeitam energia, rotina e necessidades do momento.', cluster:'Autocuidado emocional', searchIntent:'O que é autocuidado emocional', accent:'Cuidar sem se cobrar', relatedTerms:['autocuidado emocional','bem-estar','rotina de autocuidado','cuidado possível'], tool:'self-care', supportingSlugs:['autocuidado-nao-precisa-ser-bonito-para-funcionar','o-que-fazer-quando-voce-tem-pouca-energia-para-se-cuidar','como-recomecar-depois-de-uma-semana-emocionalmente-dificil','nem-todo-dia-precisa-render'] },
  { title:'Sono, descanso e energia', slug:'como-organizar-o-sono-quando-a-rotina-saiu-do-eixo', description:'Observe sono, descanso e energia como partes da rotina emocional e entenda quando alterações persistentes merecem avaliação.', cluster:'Sono, descanso e energia', searchIntent:'Como organizar o sono e observar a energia na rotina', accent:'Observar corpo e rotina', relatedTerms:['sono','descanso','energia','rotina'], tool:'map', supportingSlugs:['a-diferenca-entre-descansar-e-fugir-de-tudo','um-exercicio-de-pausa-para-dias-pesados'] },
  { title:'Relações e limites', slug:'como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito', description:'Identifique limites, comunique necessidades e preserve energia nas relações com clareza e respeito.', cluster:'Relações e limites', searchIntent:'Como colocar limites sem criar conflito', accent:'Proteger sua energia', relatedTerms:['limites emocionais','relações','comunicação','conflito'], tool:'diary', supportingSlugs:[] },
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
export function guideToolPath(guide?:SeoGuide){ if(!guide)return'/diario'; if(guide.tool==='self-care')return'/plano-de-autocuidado'; if(guide.tool==='map')return'/mapa-emocional'; return '/diario' }
