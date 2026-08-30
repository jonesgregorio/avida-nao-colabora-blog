import type { ContinuityPrompt } from './todayContinuity'

export type AdaptiveCheckinAnswer = 'better' | 'same' | 'worse' | 'yes' | 'a_little' | 'not_today' | 'continue_now'

export interface AdaptiveCheckinChoice {
  id: AdaptiveCheckinAnswer
  label: string
}

export interface AdaptiveCheckinPrompt {
  id: string
  continuityId: string
  eyebrow: string
  title: string
  description: string
  choices: AdaptiveCheckinChoice[]
  guidance: Record<AdaptiveCheckinAnswer, string>
}

const RELATIVE_CHOICES: AdaptiveCheckinChoice[] = [
  { id: 'better', label: 'Melhorou' },
  { id: 'same', label: 'Está parecido' },
  { id: 'worse', label: 'Está mais intenso' },
]

const PRESENCE_CHOICES: AdaptiveCheckinChoice[] = [
  { id: 'yes', label: 'Sim' },
  { id: 'a_little', label: 'Um pouco' },
  { id: 'not_today', label: 'Hoje não' },
]

const GENERIC_GUIDANCE: Record<AdaptiveCheckinAnswer, string> = {
  better: 'Que bom perceber uma mudança. Agora registre como você está neste momento; não precisamos transformar “melhor” em uma nota automática.',
  same: 'Entendi. Vamos registrar como está agora, usando os campos normais do check-in.',
  worse: 'Obrigado por sinalizar. Registre como está agora no check-in; se precisar, você também pode escrever depois.',
  yes: 'Certo. Se fizer sentido para você registrar este momento, esse contexto também pode ser marcado nos detalhes do check-in.',
  a_little: 'Entendi. Vale registrar o momento de hoje sem precisar concluir se esse contexto foi a causa de alguma coisa.',
  not_today: 'Tudo bem. O registro de hoje pode seguir por outro assunto completamente diferente.',
  continue_now: 'Vamos começar apenas por como você está agora.',
}

/**
 * Traduz uma retomada segura da Home em uma pergunta curta para o check-in.
 * A resposta relativa não vira escala numérica automaticamente: o usuário ainda
 * registra os dados atuais nos campos normais para evitar inferências artificiais.
 */
export function buildAdaptiveCheckinPrompt(continuity: ContinuityPrompt | null): AdaptiveCheckinPrompt | null {
  if (!continuity) return null

  if (continuity.kind === 'return') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Continuamos daqui',
      title: 'Quer retomar sem precisar recuperar os dias que passaram?',
      description: 'Seu check-in de hoje começa do presente. O histórico continua guardado, mas você não precisa preencher o que ficou para trás.',
      choices: [{ id: 'continue_now', label: 'Começar por hoje' }],
      guidance: GENERIC_GUIDANCE,
    }
  }

  if (continuity.kind === 'yesterday_anxiety') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Comparando com ontem',
      title: 'Ontem sua ansiedade ficou alta. Como ela parece hoje?',
      description: 'Essa resposta só orienta a conversa. A intensidade de hoje continua sendo registrada por você, sem o sistema inventar uma nota.',
      choices: RELATIVE_CHOICES,
      guidance: GENERIC_GUIDANCE,
    }
  }

  if (continuity.kind === 'yesterday_energy') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Comparando com ontem',
      title: 'Ontem sua energia ficou baixa. Como está hoje?',
      description: 'Escolha apenas a comparação que fizer sentido e depois registre sua energia atual normalmente.',
      choices: RELATIVE_CHOICES,
      guidance: GENERIC_GUIDANCE,
    }
  }

  if (continuity.kind === 'yesterday_sleep') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Comparando com ontem',
      title: 'Seu sono apareceu mais difícil ontem. Como você percebe isso hoje?',
      description: 'A comparação não substitui o registro atual; ela apenas ajuda a começar de onde você parou.',
      choices: RELATIVE_CHOICES,
      guidance: GENERIC_GUIDANCE,
    }
  }

  if (continuity.kind === 'yesterday_mood') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Lembra de ontem?',
      title: 'Esse estado de ontem ainda parece presente hoje?',
      description: 'Você pode comparar primeiro e depois escolher livremente como está agora.',
      choices: PRESENCE_CHOICES,
      guidance: GENERIC_GUIDANCE,
    }
  }

  if (continuity.kind === 'repeated_trigger' || continuity.kind === 'repeated_context' || continuity.kind === 'repeated_mood') {
    return {
      id: `checkin:${continuity.id}`,
      continuityId: continuity.id,
      eyebrow: 'Seu histórico recente',
      title: 'Isso que vinha aparecendo ainda teve algum peso hoje?',
      description: 'Não estamos dizendo que existe uma causa. É apenas uma retomada do que apareceu em dias diferentes do seu próprio histórico.',
      choices: PRESENCE_CHOICES,
      guidance: GENERIC_GUIDANCE,
    }
  }

  return null
}
