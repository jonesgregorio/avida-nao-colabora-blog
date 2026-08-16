// ─────────────────────────────────────────────────────────────────────────────
// Motor de IA do Plano de Autocuidado Mensal (Plus).
//
// Recebe MÉTRICAS agregadas do mês (nunca texto íntimo) e produz, com apoio da
// IA, um resumo mensal + um Plano de Autocuidado em JSON estruturado (§7/§8/§19).
// Sempre com revisão humana depois. Linguagem acolhedora, nunca diagnóstica (§9).
//
// Se a IA falhar/estourar tempo, ou houver poucos dados, cai para um rascunho
// determinístico (buildDeepReport) — o admin nunca fica sem um ponto de partida.
// ─────────────────────────────────────────────────────────────────────────────
import { generateWithFailover } from './aiContent'
import { buildDeepReport, type EmotionalAnalysis } from './emotionalAnalytics'
import { fetchGuidedCatalog, signalFromTags, scoreCatalog } from './contentRecommendation'

// ── Formato exato esperado da IA (§19) ────────────────────────────────────────
export interface CareSummary {
  general_overview: string
  main_emotions: string[]
  recurring_triggers: string[]
  energy_anxiety_relation: string
  attention_days: string[]
  improvement_moments: string[]
  patterns: string[]
  attention_points: string[]
}
export interface CarePlanContent {
  monthly_priority: string
  main_care: string
  recommended_practice: string
  attention_point: string
  small_commitment: string
  checkin_suggestion: string
  practical_tips: string[]
  reflection_questions: string[]
  final_message: string
}
export interface CarePlanResult {
  summary: CareSummary
  care_plan: CarePlanContent
  recommended_content_tags: string[]
  generatedByAI: boolean
  hasEnoughData: boolean
}

export interface RecordsSummary {
  totalEntries: number
  diaryCount: number
  checkinCount: number
  activeDays: number
  avgEnergy: number
  avgAnxiety: number
  avgSleep: number
  topEmotions: { label: string; count: number }[]
  triggers: { tag: string; count: number }[]
  // §16: contexto/necessidade/cuidado/gatilhos reais marcados no diário —
  // dão ao plano uma base concreta em vez de só resumo genérico do mês.
  contexts: { tag: string; count: number }[]
  needs: { tag: string; count: number }[]
  careActions: { tag: string; count: number }[]
  realTriggers: { tag: string; count: number }[]
  attentionDays: number[]
  hasEnoughData: boolean
  monthLabel: string
  periodLabel: string
}

export const CARE_PLAN_DISCLAIMER =
  'Este Plano de Autocuidado é uma ferramenta de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

/** Métricas agregadas do mês (sem texto sensível), base do resumo e do plano. */
export function buildRecordsSummary(a: EmotionalAnalysis, monthLabel: string, periodLabel: string): RecordsSummary {
  const attention = [...a.calendar]
    .filter(c => c.avg > 0)
    .sort((x, y) => x.avg - y.avg) // menor humor primeiro
    .slice(0, 3)
    .map(c => c.day)
  return {
    totalEntries: a.totalEntries,
    diaryCount: a.diaryCount,
    checkinCount: a.checkinCount,
    activeDays: a.activeDays,
    avgEnergy: a.avg.energy,
    avgAnxiety: a.avg.anxiety,
    avgSleep: a.avg.sleep,
    topEmotions: a.topEmotions.map(e => ({ label: e.label, count: e.count })),
    triggers: a.triggers.map(t => ({ tag: t.tag, count: t.count })),
    contexts: a.contexts.map(t => ({ tag: t.tag, count: t.count })),
    needs: a.needs.map(t => ({ tag: t.tag, count: t.count })),
    careActions: a.careActions.map(t => ({ tag: t.tag, count: t.count })),
    realTriggers: a.realTriggers.map(t => ({ tag: t.tag, count: t.count })),
    attentionDays: attention,
    hasEnoughData: a.totalEntries >= 5 && a.activeDays >= 3,
    monthLabel,
    periodLabel,
  }
}

// ── Prompt (§9 + §19) ─────────────────────────────────────────────────────────
export function buildCarePlanPrompt(rs: RecordsSummary): string {
  const metrics = {
    mes: rs.monthLabel,
    periodo: rs.periodLabel,
    total_registros: rs.totalEntries,
    diarios: rs.diaryCount,
    checkins: rs.checkinCount,
    dias_ativos: rs.activeDays,
    energia_media: rs.avgEnergy,
    ansiedade_media: rs.avgAnxiety,
    sono_medio: rs.avgSleep,
    emocoes_frequentes: rs.topEmotions.slice(0, 6),
    marcadores_emocionais: rs.triggers.slice(0, 8),
    contextos_frequentes: rs.contexts.slice(0, 6),
    necessidades_frequentes: rs.needs.slice(0, 6),
    acoes_de_cuidado_escolhidas: rs.careActions.slice(0, 6),
    gatilhos_reais: rs.realTriggers.slice(0, 6),
    dias_de_atencao: rs.attentionDays,
    dados_suficientes: rs.hasEnoughData,
  }
  return [
    'Você é um assistente que ajuda uma equipe de bem-estar a preparar um Plano de Autocuidado mensal para uma pessoa usuária, a partir APENAS das métricas fornecidas.',
    '',
    'REGRAS OBRIGATÓRIAS DE LINGUAGEM:',
    '- Nunca diagnostique. Nunca use: "você tem ansiedade/depressão", "diagnóstico", "transtorno", "quadro clínico", "tratamento", "prescrição", "psicanalista", "sessão", "consulta", "cura".',
    '- Use linguagem acolhedora, humana, objetiva e prática: "seus registros sugerem", "parece haver", "vale observar", "pode ser útil perceber".',
    '- Baseie-se SOMENTE nas métricas fornecidas. Não invente fatos, dias ou padrões que os dados não sustentam.',
    '- Se dados_suficientes for false, deixe o texto mais suave e incentive registrar mais, sem forçar conclusões.',
    '- Escreva em português do Brasil.',
    '- OBRIGATÓRIO: preencha TODOS os campos de "care_plan" — nenhum pode ficar vazio ou genérico demais. Cada campo de texto precisa ter 1 a 3 frases com orientação prática de verdade (não apenas um título ou uma palavra).',
    '- Use contextos_frequentes, necessidades_frequentes e acoes_de_cuidado_escolhidas para tornar o plano concreto — ex.: "seus registros mostram que trabalho e sobrecarga apareceram com frequência, enquanto descanso e pausa foram necessidades marcadas várias vezes". Não ignore esses dados se estiverem presentes.',
    '',
    'MÉTRICAS DO MÊS (JSON):',
    JSON.stringify(metrics, null, 2),
    '',
    'TAREFA: gere o resumo mensal e o plano de autocuidado do PRÓXIMO mês.',
    'Responda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem comentários) EXATAMENTE neste formato:',
    `{
  "summary": {
    "general_overview": "texto acolhedor de 2-4 frases sobre o mês",
    "main_emotions": ["..."],
    "recurring_triggers": ["..."],
    "energy_anxiety_relation": "1-2 frases",
    "attention_days": ["ex: dias 08, 14 e 22 concentraram registros mais pesados"],
    "improvement_moments": ["..."],
    "patterns": ["..."],
    "attention_points": ["..."]
  },
  "care_plan": {
    "monthly_priority": "...",
    "main_care": "...",
    "recommended_practice": "descreva 1-2 práticas concretas, com um mínimo de 'como fazer'",
    "attention_point": "...",
    "small_commitment": "...",
    "checkin_suggestion": "...",
    "practical_tips": ["3 a 5 dicas curtas e práticas de autocuidado para o mês, complementares ao cuidado principal — cada uma com uma ação clara"],
    "reflection_questions": ["3 a 5 perguntas"],
    "final_message": "mensagem curta e humana"
  },
  "recommended_content_tags": ["ansiedade","sobrecarga","descanso","autocobranca","limites","rotina","sono","fome emocional","autoestima"]
}`,
    'Use em recommended_content_tags apenas temas realmente presentes nos dados.',
  ].join('\n')
}

// ── Parse robusto ─────────────────────────────────────────────────────────────
function extractJson(raw: string): unknown | null {
  if (!raw) return null
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const first = s.indexOf('{'); const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) return null
  s = s.slice(first, last + 1)
  try { return JSON.parse(s) } catch { return null }
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  if (typeof v === 'string' && v.trim()) return [v.trim()]
  return []
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function validate(parsed: unknown): CarePlanResult | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Record<string, unknown>
  const s = (p.summary ?? {}) as Record<string, unknown>
  const c = (p.care_plan ?? {}) as Record<string, unknown>
  const care_plan: CarePlanContent = {
    monthly_priority: asString(c.monthly_priority),
    main_care: asString(c.main_care),
    recommended_practice: asString(c.recommended_practice),
    attention_point: asString(c.attention_point),
    small_commitment: asString(c.small_commitment),
    checkin_suggestion: asString(c.checkin_suggestion),
    practical_tips: asStringArray(c.practical_tips),
    reflection_questions: asStringArray(c.reflection_questions),
    final_message: asString(c.final_message),
  }
  // A IA às vezes devolve o JSON só parcialmente preenchido (bug relatado: "não
  // preenche todos os campos"). Em vez de aceitar um plano pela metade, exige
  // TODOS os campos essenciais — se faltar algo, rejeita (generateCarePlanAI
  // tenta de novo e, no limite, cai no rascunho determinístico, que é sempre
  // completo).
  const scalarsComplete = [
    care_plan.monthly_priority, care_plan.main_care, care_plan.recommended_practice,
    care_plan.attention_point, care_plan.small_commitment, care_plan.checkin_suggestion,
    care_plan.final_message,
  ].every(Boolean)
  if (!scalarsComplete || care_plan.reflection_questions.length < 2 || care_plan.practical_tips.length < 2) {
    return null
  }
  return {
    summary: {
      general_overview: asString(s.general_overview),
      main_emotions: asStringArray(s.main_emotions),
      recurring_triggers: asStringArray(s.recurring_triggers),
      energy_anxiety_relation: asString(s.energy_anxiety_relation),
      attention_days: asStringArray(s.attention_days),
      improvement_moments: asStringArray(s.improvement_moments),
      patterns: asStringArray(s.patterns),
      attention_points: asStringArray(s.attention_points),
    },
    care_plan,
    recommended_content_tags: asStringArray(p.recommended_content_tags),
    generatedByAI: true,
    hasEnoughData: true,
  }
}

// ── Fallback determinístico (sem IA) ──────────────────────────────────────────
export function fallbackCarePlan(a: EmotionalAnalysis, monthLabel: string): CarePlanResult {
  const dr = buildDeepReport(a, monthLabel)
  return {
    summary: {
      general_overview: dr.summary,
      main_emotions: a.topEmotions.map(e => e.label),
      recurring_triggers: a.triggers.map(t => t.tag),
      energy_anxiety_relation: dr.energyAnxietySleep,
      attention_days: dr.attentionDays.map(d => `Dia ${d.day}: ${d.reason}`),
      improvement_moments: [dr.improvementMoments],
      patterns: dr.patterns,
      attention_points: dr.patterns.slice(0, 2),
    },
    care_plan: {
      monthly_priority: dr.selfCarePlan.priority,
      main_care: dr.selfCarePlan.mainCare,
      recommended_practice: dr.selfCarePlan.practice,
      attention_point: dr.selfCarePlan.attention,
      small_commitment: dr.selfCarePlan.commitment,
      checkin_suggestion: dr.selfCarePlan.checkin,
      practical_tips: dr.patterns.length > 0 ? dr.patterns.slice(0, 4) : [
        'Reserve alguns minutos do seu dia só para você, sem cobrança de produtividade.',
        'Beba água e faça pausas curtas entre tarefas — pequenos cuidados físicos ajudam o emocional.',
        'Quando perceber tensão, experimente respirar fundo por alguns segundos antes de continuar.',
      ],
      reflection_questions: dr.reflectionQuestions,
      final_message: 'Este plano não precisa ser seguido com perfeição. Ele é um ponto de apoio para perceber seus sinais com mais cuidado e escolher pequenos passos possíveis.',
    },
    recommended_content_tags: dr.recommendTags,
    generatedByAI: false,
    hasEnoughData: dr.hasEnoughData,
  }
}

/**
 * Gera resumo + plano com IA a partir das métricas do mês. Em qualquer falha
 * (rede, timeout, JSON inválido) cai para o rascunho determinístico. Nunca
 * lança — o admin sempre recebe um rascunho para revisar.
 */
export async function generateCarePlanAI(a: EmotionalAnalysis, rs: RecordsSummary): Promise<CarePlanResult> {
  // Poucos dados: não força a IA a inventar; entrega rascunho suave direto.
  if (!rs.hasEnoughData) return fallbackCarePlan(a, rs.monthLabel)
  // Até 2 tentativas: validate() agora rejeita respostas com campos faltando,
  // então uma 2ª tentativa muitas vezes já resolve antes de cair no rascunho
  // determinístico (mais genérico que o da IA).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateWithFailover(buildCarePlanPrompt(rs))
      const parsed = validate(extractJson(raw))
      if (parsed) return parsed
    } catch {
      /* tenta de novo; se for a última tentativa, cai no fallback abaixo */
    }
  }
  return fallbackCarePlan(a, rs.monthLabel)
}

// ── Conteúdos recomendados reais (§20) ────────────────────────────────────────
export interface ResolvedContent {
  id: string
  title: string
  slug: string | null
  category: string | null
  reason: string
}

/** Converte tags sugeridas em conteúdos guiados REAIS compatíveis com o plano. */
export async function resolveRecommendedContent(tags: string[], plan = 'plus', limit = 4): Promise<ResolvedContent[]> {
  if (!tags.length) return []
  try {
    const [catalog] = await Promise.all([fetchGuidedCatalog()])
    const sig = signalFromTags(tags)
    const scored = scoreCatalog(catalog, sig, plan, { limit })
    return scored.map(s => ({
      id: s.item.id,
      title: s.item.title,
      slug: s.item.slug,
      category: s.item.category,
      reason: s.reason,
    }))
  } catch {
    return []
  }
}
