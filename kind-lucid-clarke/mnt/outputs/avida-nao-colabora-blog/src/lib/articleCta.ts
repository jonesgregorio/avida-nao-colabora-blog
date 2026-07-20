// Textos FIXOS do CTA no fim do artigo — fonte ÚNICA de verdade.
// Usados tanto pelo blog (ArticleView) quanto pelo preview no editor
// (AdminArticleEditor), para nunca divergirem.
//
// Regra: visitante SEM conta vê o convite de cadastro (aquisição);
// quem JÁ tem conta vê o convite para registrar no diário (engajamento).
// Quando o artigo usa CTA personalizado (cta_mode='custom'), o bloco do
// visitante é substituído pelo título/texto próprios — o do logado continua fixo.

export const DEFAULT_CTA = {
  guest: {
    title: 'Quer transformar essa reflexão em um registro pessoal?',
    paragraphs: [
      'Faça um check-in emocional gratuito. No A Vida Não Colabora, você acompanha seus padrões emocionais com diário, check-ins e mapa emocional.',
      'Crie sua conta gratuita para salvar seus registros e acompanhar sua evolução emocional.',
    ],
    buttons: ['Criar conta gratuita', 'Já tenho conta — entrar'],
  },
  logged: {
    title: 'Quer explorar isso mais de perto?',
    paragraph: 'Use o diário para registrar o que você está sentindo agora.',
    button: 'Registrar como estou hoje',
  },
} as const
