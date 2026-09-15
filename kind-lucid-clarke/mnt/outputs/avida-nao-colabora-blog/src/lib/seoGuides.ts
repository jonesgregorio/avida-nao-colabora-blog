export interface SeoGuide {
  title: string
  slug: string
  description: string
  cluster: string
  searchIntent: string
  accent: string
  relatedTerms: string[]
}

// Artigos já publicados escolhidos como páginas-pilar. Centralizar a lista evita
// criar conteúdos duplicados para a mesma intenção de busca e permite que Blog,
// Guias e artigos formem uma arquitetura temática consistente.
export const SEO_PILLAR_GUIDES: SeoGuide[] = [
  { title: 'Diário emocional', slug: 'como-comecar-um-diario-emocional-sem-saber-o-que-escrever', description: 'Comece a registrar emoções e acontecimentos, mesmo quando ainda é difícil colocar o que você sente em palavras.', cluster: 'Diário e autoconhecimento', searchIntent: 'Como começar um diário emocional', accent: 'Começar a escrever', relatedTerms: ['diário emocional', 'escrita emocional', 'autoconhecimento', 'registro emocional'] },
  { title: 'Check-in emocional', slug: 'faca-seu-primeiro-check-in-emocional', description: 'Faça uma pausa curta para perceber humor, energia, corpo, contexto e necessidades do momento.', cluster: 'Diário e autoconhecimento', searchIntent: 'Como fazer um check-in emocional', accent: 'Perceber como você está', relatedTerms: ['check-in emocional', 'humor', 'emoções', 'como estou me sentindo'] },
  { title: 'Padrões emocionais', slug: 'como-identificar-padroes-nos-seus-registros-emocionais', description: 'Observe repetições nos seus registros com curiosidade, sem transformar percepção em diagnóstico ou cobrança.', cluster: 'Mapa emocional', searchIntent: 'Como identificar padrões emocionais', accent: 'Entender repetições', relatedTerms: ['padrões emocionais', 'gatilhos', 'mapa emocional', 'registros emocionais'] },
  { title: 'Autocuidado possível', slug: 'o-que-e-autocuidado-emocional-na-vida-real', description: 'Entenda o autocuidado como pequenas escolhas realistas que cabem na rotina e respeitam o seu momento.', cluster: 'Autocuidado', searchIntent: 'O que é autocuidado emocional', accent: 'Cuidar sem se cobrar', relatedTerms: ['autocuidado emocional', 'bem-estar', 'rotina de autocuidado', 'cuidado possível'] },
  { title: 'Sobrecarga emocional', slug: 'como-perceber-se-hoje-foi-um-dia-de-sobrecarga', description: 'Reconheça sinais de que o dia exigiu mais de você e encontre um próximo passo mais gentil.', cluster: 'Ansiedade e sobrecarga', searchIntent: 'Como identificar sobrecarga emocional', accent: 'Reconhecer seus sinais', relatedTerms: ['sobrecarga emocional', 'ansiedade', 'cansaço mental', 'estresse emocional'] },
  { title: 'Limites sem culpa', slug: 'como-dizer-nao-sem-culpa-e-preservar-sua-energia', description: 'Reflita sobre limites que protegem seu tempo e sua energia sem perder o respeito nas relações.', cluster: 'Relações e limites', searchIntent: 'Como dizer não sem culpa', accent: 'Proteger sua energia', relatedTerms: ['limites emocionais', 'dizer não', 'culpa', 'relações saudáveis'] },
  { title: 'Ansiedade, sono e rotina', slug: 'como-relacionar-ansiedade-sono-e-rotina', description: 'Observe como ansiedade, descanso e hábitos aparecem juntos no cotidiano sem buscar explicações apressadas.', cluster: 'Sono e rotina', searchIntent: 'Relação entre ansiedade, sono e rotina', accent: 'Observar corpo e rotina', relatedTerms: ['ansiedade e sono', 'rotina', 'descanso', 'energia'] },
  { title: 'Plano de autocuidado', slug: 'como-transformar-seus-registros-em-um-plano-de-autocuidado', description: 'Transforme registros e descobertas em ações pequenas, específicas e sustentáveis para o próximo ciclo.', cluster: 'Autocuidado', searchIntent: 'Como criar um plano de autocuidado', accent: 'Transformar percepção em ação', relatedTerms: ['plano de autocuidado', 'hábitos', 'autocuidado', 'organização emocional'] },
]

export const SEO_CLUSTERS = Array.from(new Set(SEO_PILLAR_GUIDES.map((guide) => guide.cluster)))
