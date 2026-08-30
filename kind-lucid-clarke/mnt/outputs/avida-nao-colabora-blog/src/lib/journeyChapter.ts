export type JourneyChapterKey = 'starting' | 'forming' | 'reflecting' | 'remembering'

export interface JourneyHistorySnapshot {
  activeDays: number
  reports: number
  months: number
  milestones: number
  hasSteadyMonth: boolean
}

export interface JourneyChapter {
  key: JourneyChapterKey
  eyebrow: string
  title: string
  description: string
  evidence: string[]
  note: string
}

function plural(value: number, singular: string, pluralValue: string) {
  return `${value} ${value === 1 ? singular : pluralValue}`
}

export function buildJourneyChapter(snapshot: JourneyHistorySnapshot): JourneyChapter {
  const activeDays = Math.max(0, snapshot.activeDays)
  const reports = Math.max(0, snapshot.reports)
  const months = Math.max(0, snapshot.months)
  const milestones = Math.max(0, snapshot.milestones)

  if (activeDays === 0 && reports === 0) {
    return {
      key: 'starting',
      eyebrow: 'Seu capítulo atual',
      title: 'A história começa quando fizer sentido para você',
      description: 'Ainda não há um percurso para resumir — e não existe nada para colocar em dia. O primeiro registro só abre um ponto de referência para o futuro.',
      evidence: [],
      note: 'Sem sequência, meta diária ou prazo para avançar.',
    }
  }

  if (reports === 0 && activeDays < 5) {
    return {
      key: 'starting',
      eyebrow: 'Seu capítulo atual',
      title: 'Primeiros sinais',
      description: 'Você já deixou alguns pontos da sua experiência registrados. Eles ainda não precisam formar um padrão para terem valor.',
      evidence: [plural(activeDays, 'dia registrado', 'dias registrados')],
      note: 'Este capítulo muda quando a sua própria história ganha novos elementos — não por frequência obrigatória.',
    }
  }

  if (reports === 0) {
    return {
      key: 'forming',
      eyebrow: 'Seu capítulo atual',
      title: 'Sua história está ganhando forma',
      description: 'Já existem dias suficientes para olhar o conjunto com um pouco mais de distância, sem transformar cada repetição em uma conclusão.',
      evidence: [
        plural(activeDays, 'dia registrado', 'dias registrados'),
        ...(months > 1 ? [plural(months, 'mês com registros', 'meses com registros')] : []),
      ],
      note: 'Não é um nível nem uma meta. É apenas uma leitura do material real que já existe na sua conta.',
    }
  }

  if (!snapshot.hasSteadyMonth && reports < 2) {
    return {
      key: 'reflecting',
      eyebrow: 'Seu capítulo atual',
      title: 'Você já tem algo para revisitar',
      description: 'Além dos registros do dia a dia, uma retrospectiva já ajuda a enxergar o caminho de um ponto de vista mais amplo.',
      evidence: [
        plural(activeDays, 'dia registrado', 'dias registrados'),
        plural(reports, 'retrospectiva pronta', 'retrospectivas prontas'),
      ],
      note: 'O objetivo não é acumular relatórios, mas tornar mais fácil reconhecer mudanças quando elas realmente aparecem.',
    }
  }

  return {
    key: 'remembering',
    eyebrow: 'Seu capítulo atual',
    title: 'Uma trajetória com memória',
    description: 'Sua conta já reúne registros, retrospectivas e acontecimentos suficientes para que o passado possa servir de contexto — sem prender você a uma sequência.',
    evidence: [
      plural(activeDays, 'dia registrado', 'dias registrados'),
      plural(reports, 'retrospectiva pronta', 'retrospectivas prontas'),
      ...(milestones > 0 ? [plural(milestones, 'momento reconhecido', 'momentos reconhecidos')] : []),
    ],
    note: 'Você pode passar dias sem registrar. O capítulo não regride e nenhuma ausência apaga o que já foi construído.',
  }
}
