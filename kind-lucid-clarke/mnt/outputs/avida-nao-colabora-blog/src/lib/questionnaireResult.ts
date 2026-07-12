// ─────────────────────────────────────────────────────────────────────────────
// Motor de RESULTADO de questionário — devolutiva de AUTOPERCEPÇÃO (nunca
// diagnóstico) + recomendação de conteúdos guiados existentes por tags/plano.
//
// Regras: linguagem de autopercepção ("suas respostas parecem indicar…"),
// nunca afirmar transtorno/diagnóstico. Recomenda apenas conteúdo publicado e
// compatível com o plano do usuário (nada de conteúdo pago para quem não tem).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { hasPlanAccess, normalizePlan, type PlanKey } from './officialPlans'
import type { Article } from '../types'

// ── Temas de autopercepção ───────────────────────────────────────────────────
export type ResultTheme =
  | 'ansiedade' | 'sobrecarga' | 'cansaco' | 'alimentacao'
  | 'autoestima' | 'sono' | 'tristeza' | 'geral'

interface ThemeConfig {
  title: string
  indication: string          // "o que suas respostas parecem indicar"
  attentionPoints: string[]   // pontos que merecem atenção
  keywords: string[]          // p/ casar com conteúdos (sem acento, minúsculo)
  categories: string[]        // categorias de artigos relacionadas
}

// Ordem = prioridade em caso de empate na contagem de tags.
const THEMES: { key: ResultTheme; match: string[]; cfg: ThemeConfig }[] = [
  {
    key: 'ansiedade',
    match: ['ansiedad', 'ansios', 'pensament', 'acelerad', 'tens', 'preocupa', 'nervos', 'panico', 'medo'],
    cfg: {
      title: 'Sinais de ansiedade e sobrecarga emocional',
      indication: 'Você marcou respostas associadas a ansiedade percebida e pensamentos acelerados.',
      attentionPoints: ['Pensamentos acelerados', 'Dificuldade de descanso ou pausa', 'Tensão emocional ao longo do dia', 'Necessidade de momentos de regulação'],
      keywords: ['ansiedade', 'respiracao', 'pensamentos', 'regulacao', 'calma', 'sobrecarga'],
      categories: ['Ansiedade', 'Pensamentos difíceis'],
    },
  },
  {
    key: 'sobrecarga',
    match: ['sobrecarg', 'excesso', 'demanda', 'esgota', 'nao dou conta', 'limite'],
    cfg: {
      title: 'Sinais de sobrecarga emocional',
      indication: 'As respostas trazem sinais de sobrecarga e de excesso de demandas no seu dia.',
      attentionPoints: ['Excesso de demandas', 'Dificuldade de dizer não', 'Sensação de não dar conta', 'Pouco tempo para você'],
      keywords: ['sobrecarga', 'limites', 'descanso', 'pausa', 'rotina'],
      categories: ['Cansaço emocional', 'Relações e limites', 'Rotina e hábitos'],
    },
  },
  {
    key: 'cansaco',
    match: ['cansa', 'energia', 'exaust', 'fadiga', 'disposicao', 'desanimo fisico'],
    cfg: {
      title: 'Rotina e energia pedem atenção',
      indication: 'As respostas mostram maior presença de cansaço, baixa energia e dificuldade de recuperação.',
      attentionPoints: ['Energia baixa em períodos recorrentes', 'Dificuldade de descanso', 'Sensação de rotina pesada', 'Pouco espaço para pausas'],
      keywords: ['descanso', 'rotina', 'pausa', 'energia', 'autocuidado', 'sono'],
      categories: ['Cansaço emocional', 'Autocuidado possível', 'Rotina e hábitos', 'Sono e descanso'],
    },
  },
  {
    key: 'alimentacao',
    match: ['fome', 'comida', 'aliment', 'compuls', 'culpa'],
    cfg: {
      title: 'Relação com a comida marcada por gatilhos emocionais',
      indication: 'Há sinais de que emoções podem estar influenciando escolhas alimentares em alguns momentos.',
      attentionPoints: ['Gatilhos emocionais ligados à comida', 'Sentimentos de culpa', 'Comer para aliviar emoções', 'Relação com a comida em momentos difíceis'],
      keywords: ['fome', 'emocional', 'gatilhos', 'comida', 'alimentacao', 'culpa', 'autocuidado'],
      categories: ['Autocuidado possível', 'Autoconhecimento'],
    },
  },
  {
    key: 'autoestima',
    match: ['autoestim', 'autocobr', 'cobranc', 'compara', 'critic', 'perfeccion'],
    cfg: {
      title: 'Autocobrança elevada',
      indication: 'A autocobrança parece ter peso importante na forma como você avalia o seu dia.',
      attentionPoints: ['Tendência a se cobrar demais', 'Comparação com outras pessoas', 'Dificuldade de reconhecer conquistas', 'Autocrítica frequente'],
      keywords: ['autocobranca', 'autoestima', 'comparacao', 'autocompaixao', 'limites'],
      categories: ['Autoestima', 'Relações e limites', 'Autoconhecimento'],
    },
  },
  {
    key: 'sono',
    match: ['sono', 'dormir', 'insonia', 'noite', 'descans'],
    cfg: {
      title: 'Sono e rotina pedem cuidado',
      indication: 'Suas respostas indicam que o sono e a organização da rotina podem estar pesando.',
      attentionPoints: ['Dificuldade para desacelerar à noite', 'Sono irregular', 'Rotina sem pausas', 'Cansaço ao acordar'],
      keywords: ['sono', 'rotina', 'noturna', 'desaceleracao', 'habitos', 'energia'],
      categories: ['Sono e descanso', 'Rotina e hábitos'],
    },
  },
  {
    key: 'tristeza',
    match: ['triste', 'desanim', 'choro', 'vazio', 'solidao', 'sozinh'],
    cfg: {
      title: 'Momentos de desânimo pedem acolhimento',
      indication: 'As respostas trazem sinais de tristeza ou desânimo em alguns momentos.',
      attentionPoints: ['Desânimo recorrente', 'Menos vontade nas atividades', 'Necessidade de acolhimento', 'Emoções difíceis presentes'],
      keywords: ['tristeza', 'acolhimento', 'emocoes', 'autocuidado'],
      categories: ['Pensamentos difíceis', 'Autocuidado possível', 'Autoconhecimento'],
    },
  },
]

const GERAL: ThemeConfig = {
  title: 'Um retrato do seu momento',
  indication: 'Suas respostas ajudam a perceber como você tem se sentido ultimamente.',
  attentionPoints: ['Como você tem se sentido no dia a dia', 'O que tem pedido mais atenção', 'Pequenos cuidados possíveis'],
  keywords: ['autoconhecimento', 'autocuidado', 'rotina', 'diario'],
  categories: ['Autoconhecimento', 'Diário emocional', 'Autocuidado possível', 'Vida real'],
}

function deburr(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** Escolhe o tema dominante a partir das tags (contagem; empate → prioridade). */
export function themeFromTags(tags: string[]): { key: ResultTheme; cfg: ThemeConfig } {
  const norm = tags.map(deburr).filter(Boolean)
  let best: { key: ResultTheme; cfg: ThemeConfig } | null = null
  let bestCount = 0
  for (const t of THEMES) {
    const count = norm.reduce((n, tag) => n + (t.match.some(m => tag.includes(m)) ? 1 : 0), 0)
    if (count > bestCount) { bestCount = count; best = { key: t.key, cfg: t.cfg } }
  }
  return best ?? { key: 'geral', cfg: GERAL }
}

// ── Resultado estruturado ─────────────────────────────────────────────────────
export interface QuestionnaireResult {
  theme: ResultTheme
  title: string
  summary: string
  indications: string[]
  attentionPoints: string[]
  nextSteps: string[]
  topTags: string[]
}

const NEXT_STEPS: Record<PlanKey, string[]> = {
  free: ['Registrar no diário', 'Fazer um check-in rápido', 'Explorar conteúdos gratuitos'],
  essential: ['Registrar no diário', 'Ler um conteúdo guiado recomendado', 'Acompanhar no Mapa Emocional', 'Usar no relatório semanal'],
  plus: ['Registrar no diário', 'Ler um conteúdo guiado recomendado', 'Atualizar o plano de autocuidado', 'Usar no relatório mensal', 'Levar para a orientação por mensagem'],
}

/** Tags mais frequentes (limitadas), preservando o rótulo original. */
export function topTagsFrom(tags: string[], limit = 5): string[] {
  const count = new Map<string, number>()
  for (const t of tags) {
    const key = t.trim()
    if (!key) continue
    count.set(key, (count.get(key) ?? 0) + 1)
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([t]) => t)
}

interface BuildParams {
  totalScore: number
  tags: string[]
  plan: string | null | undefined
  // Resultado configurado no admin (por faixa de pontuação), se houver.
  adminResult?: { title?: string; message?: string; description?: string } | null
}

/**
 * Monta a devolutiva completa. Usa o resultado do admin (por faixa) quando
 * existe e complementa com o tema derivado das tags. SEMPRE em linguagem de
 * autopercepção — nunca diagnóstica.
 */
export function buildQuestionnaireResult({ tags, plan, adminResult }: BuildParams): QuestionnaireResult {
  const planKey = normalizePlan(plan)
  const { key, cfg } = themeFromTags(tags)
  const top = topTagsFrom(tags)

  const title = (adminResult?.title && adminResult.title.trim()) || cfg.title

  // Resumo acolhedor: prioriza o texto do admin; complementa com o tema.
  const adminText = [adminResult?.message, adminResult?.description].filter(Boolean).join(' ').trim()
  const themed = `Pelas suas respostas, ${cfg.indication.replace(/^Você marcou|^As respostas|^Há sinais|^A autocobrança|^Suas respostas/i, m => m.toLowerCase())}`
  const summary = (adminText ? `${adminText} ` : `${themed} `) +
    'Isto não é um diagnóstico: é uma leitura de autopercepção que pode ajudar você a observar quando esses sinais aparecem e a criar pequenos momentos de cuidado ao longo do dia.'

  const indications = [cfg.indication]
  if (top.length > 0) {
    indications.push(`Aparecem com mais frequência nas suas respostas: ${top.slice(0, 3).join(', ')}.`)
  }

  return {
    theme: key,
    title,
    summary,
    indications,
    attentionPoints: cfg.attentionPoints.slice(0, 4),
    nextSteps: NEXT_STEPS[planKey],
    topTags: top,
  }
}

// ── Recomendação de conteúdos guiados existentes ──────────────────────────────
export interface RecommendedContent {
  id: string
  title: string
  slug: string | null
  category: string
  summary: string
  readTime: number | null
  planRequired: string
  raw: Article
}

function articleSummary(a: Article): string {
  return (a.summary || a.excerpt || '').toString()
}

/**
 * Recomenda conteúdos JÁ publicados, compatíveis com o plano do usuário. Nunca
 * inventa conteúdo e nunca retorna conteúdo pago para quem não tem acesso
 * (respeita hasPlanAccess + plan_required). Pontua por categoria/keyword.
 */
export async function recommendGuidedContent(
  plan: string | null | undefined,
  tags: string[],
  limit = 3,
): Promise<RecommendedContent[]> {
  const { cfg } = themeFromTags(tags)
  const keywords = [...new Set([...cfg.keywords, ...tags.map(deburr)])].filter(Boolean)
  const cats = cfg.categories.map(deburr)
  const now = new Date().toISOString()

  // select('*') evita erro caso alguma coluna opcional não exista no schema.
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .or(`status.eq.published,and(status.eq.scheduled,scheduled_at.lte.${now})`)
    .limit(200)

  if (error || !data) return []

  const scored = (data as Article[])
    // Só conteúdos que o plano do usuário PODE acessar (nada de vazamento pago).
    .filter(a => hasPlanAccess(plan, a.plan_required ?? 'free'))
    .map(a => {
      const cat = deburr(a.category ?? '')
      const hay = `${cat} ${deburr(a.title ?? '')} ${deburr(articleSummary(a))}`
      let score = 0
      if (cats.some(c => c && cat.includes(c))) score += 4
      for (const k of keywords) {
        if (!k) continue
        if (cat.includes(k)) score += 2
        else if (hay.includes(k)) score += 1
      }
      return { a, score }
    })
    .filter(x => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)

  return scored.map(({ a }) => ({
    id: a.id,
    title: a.title,
    slug: a.slug ?? null,
    category: a.category ?? 'Conteúdo',
    summary: articleSummary(a),
    readTime: a.read_time ?? a.reading_time_minutes ?? null,
    planRequired: a.plan_required ?? 'free',
    raw: a,
  }))
}
