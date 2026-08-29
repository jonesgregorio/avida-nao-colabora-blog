export interface SmallActionEntry {
  date?: string | null
  created_at?: string | null
  mood?: string | number | null
  energy?: number | null
  anxiety_level?: number | null
  sleep_quality?: number | null
  emotional_tags?: string[] | null
  context_tags?: string[] | null
  need_tags?: string[] | null
  care_action_tags?: string[] | null
  trigger_tags?: string[] | null
}

export type SmallActionKind = 'overload' | 'anxiety' | 'low_energy' | 'sleep' | 'connection'

export interface TodaySmallAction {
  id: string
  kind: SmallActionKind
  eyebrow: string
  title: string
  description: string
  reason: string
  cta: string
  doneMessage: string
  careTag: string | null
}

const MOOD_ALIASES: Record<string, string> = {
  bem_estar: 'bem-estar',
  'bem-estar': 'bem-estar',
  tranquilidade: 'tranquilidade',
  cansaco: 'cansaço',
  'cansaço': 'cansaço',
  sem_energia: 'sem energia',
  'sem energia': 'sem energia',
  ansiedade: 'ansiedade',
  sobrecarga: 'sobrecarga',
  tristeza: 'tristeza',
  irritacao: 'irritação',
  'irritação': 'irritação',
  desanimo: 'desânimo',
  'desânimo': 'desânimo',
  confusao: 'confusão',
  'confusão': 'confusão',
}

function dayKey(entry: SmallActionEntry): string {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  const raw = String(entry.created_at ?? '')
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : ''
}

function tags(value: string[] | null | undefined): Set<string> {
  return new Set((value ?? []).map(item => String(item).trim().toLowerCase()).filter(Boolean))
}

function moodOf(entry: SmallActionEntry): string {
  const raw = String(entry.mood ?? '').trim().toLowerCase()
  return MOOD_ALIASES[raw] ?? raw
}

function numeric(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function newestToday(entries: SmallActionEntry[], todayKey: string): SmallActionEntry | null {
  return entries
    .filter(entry => dayKey(entry) === todayKey)
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null
}

function hasAny(source: Set<string>, values: string[]) {
  return values.some(value => source.has(value))
}

/**
 * Escolhe no máximo uma pequena ação opcional para o dia.
 *
 * Regras:
 * - só existe ação quando há registro no dia atual;
 * - usa apenas campos estruturados do check-in/Diário;
 * - não lê texto livre e não chama IA;
 * - prioriza aliviar cobrança, não aumentar produtividade;
 * - não repete uma ação de cuidado que a pessoa já marcou no registro atual;
 * - não atribui diagnóstico, causa ou melhora clínica;
 * - não cria pontos, streak, recompensa ou obrigação.
 */
export function buildTodaySmallAction(entries: SmallActionEntry[], todayKey: string): TodaySmallAction | null {
  const current = newestToday(entries, todayKey)
  if (!current) return null

  const mood = moodOf(current)
  const emotions = tags(current.emotional_tags)
  const contexts = tags(current.context_tags)
  const needs = tags(current.need_tags)
  const triggers = tags(current.trigger_tags)
  const care = tags(current.care_action_tags)
  const anxiety = numeric(current.anxiety_level)
  const energy = numeric(current.energy)
  const sleep = numeric(current.sleep_quality)

  const overloadSignal = mood === 'sobrecarga' || emotions.has('sobrecarga') || hasAny(triggers, ['cobrança', 'excesso de tarefas'])
  if (overloadSignal && !care.has('fazer uma pausa')) {
    return {
      id: `overload:${todayKey}`,
      kind: 'overload',
      eyebrow: 'Talvez isso ajude hoje',
      title: 'Tire uma coisa da lista de hoje',
      description: 'Escolha uma tarefa que não precisa ser resolvida agora e permita que ela fique para amanhã ou para outro momento.',
      reason: 'Seu registro de hoje trouxe sinais estruturados de sobrecarga ou cobrança. A proposta é reduzir uma exigência, não criar outra.',
      cta: 'Vou aliviar uma coisa',
      doneMessage: 'Você abriu um pouco de espaço hoje. Isso já basta por agora.',
      careTag: 'fazer uma pausa',
    }
  }

  const anxietySignal = (anxiety != null && anxiety >= 4) || mood === 'ansiedade' || emotions.has('ansiedade')
  if (anxietySignal && !care.has('respirar') && !care.has('fazer uma pausa')) {
    return {
      id: `anxiety:${todayKey}`,
      kind: 'anxiety',
      eyebrow: 'Talvez isso ajude hoje',
      title: 'Faça uma pausa antes de tentar resolver',
      description: 'Por um minuto, deixe as decisões em espera. Apenas desacelere, perceba a respiração e o corpo e depois escolha se quer continuar.',
      reason: 'Ansiedade apareceu no seu registro de hoje. Esta é só uma possibilidade de pausa, não uma orientação clínica nem uma obrigação.',
      cta: 'Vou fazer essa pausa',
      doneMessage: 'Você se deu um minuto antes de continuar. Não precisa transformar isso em mais uma tarefa.',
      careTag: 'respirar',
    }
  }

  const lowEnergySignal = (energy != null && energy <= 2) || mood === 'cansaço' || mood === 'sem energia' || emotions.has('cansaço')
  if (lowEnergySignal && !care.has('fazer uma pausa')) {
    return {
      id: `low-energy:${todayKey}`,
      kind: 'low_energy',
      eyebrow: 'Talvez isso ajude hoje',
      title: 'Diminua o tamanho da próxima tarefa',
      description: 'Escolha apenas o menor próximo passo que realmente precisa acontecer. O restante pode esperar.',
      reason: 'Energia baixa ou cansaço apareceram no seu registro de hoje. A proposta é reduzir esforço, não cobrar produtividade.',
      cta: 'Vou escolher o mínimo',
      doneMessage: 'Você reduziu a exigência para caber no dia que está tendo.',
      careTag: 'fazer uma pausa',
    }
  }

  const sleepSignal = (sleep != null && sleep <= 2) || contexts.has('sono') || triggers.has('falta de descanso') || needs.has('descanso')
  if (sleepSignal && !care.has('dormir mais cedo')) {
    return {
      id: `sleep:${todayKey}`,
      kind: 'sleep',
      eyebrow: 'Talvez isso ajude hoje',
      title: 'Proteja um pouco do seu fim de dia',
      description: 'Se for possível, reserve alguns minutos a menos para cobranças e alguns minutos a mais para desacelerar antes de dormir.',
      reason: 'Sono ou necessidade de descanso apareceram no seu registro de hoje. Isso é um convite de autocuidado, não uma regra.',
      cta: 'Vou guardar esse espaço',
      doneMessage: 'Você reservou um pouco do fim do dia para desacelerar.',
      careTag: 'dormir mais cedo',
    }
  }

  const connectionSignal = emotions.has('solidão') || contexts.has('solidão') || needs.has('conversa') || needs.has('acolhimento') || needs.has('ajuda')
  if (connectionSignal && !care.has('conversar com alguém') && !care.has('pedir ajuda')) {
    return {
      id: `connection:${todayKey}`,
      kind: 'connection',
      eyebrow: 'Talvez isso ajude hoje',
      title: 'Pense em alguém com quem você possa ser simples',
      description: 'Se fizer sentido, mande uma mensagem curta para uma pessoa de confiança. Não precisa explicar tudo — pode ser só um “oi, hoje está meio difícil”.',
      reason: 'Seu registro trouxe solidão, conversa, acolhimento ou ajuda como sinal estruturado. A sugestão só aparece quando você mesmo marcou algo nessa direção.',
      cta: 'Vou pensar em alguém',
      doneMessage: 'Você abriu uma possibilidade de não carregar tudo sozinho hoje.',
      careTag: 'conversar com alguém',
    }
  }

  return null
}
