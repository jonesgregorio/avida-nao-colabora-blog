import { useEffect, useMemo, useState } from 'react'
import { Plan } from '../types'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'
import { Check, Info, LineChart, Loader2, ShieldCheck, Sprout, Star, X } from 'lucide-react'
import { type PlanCompareValue } from '../lib/planComparison'
import { OFFICIAL_PLANS, normalizePlan, type PlanKey } from '../lib/officialPlans'
import {
  buildFallbackPlanFeatureCatalog,
  getCatalogPlanBenefits,
  loadPlanFeatureCatalog,
  type PlanFeatureCatalog,
} from '../lib/planFeatureCatalog'
import { resolvePricingPlanAction } from '../lib/pricingPlanAction'
import { usePlanPricing } from '../lib/planPricing'

interface PricingProps {
  user: unknown
  currentPlan: Plan
  onNavigateAuth: () => void
}

type FeatureId =
  | 'checkin'
  | 'diary'
  | 'voice'
  | 'deepening'
  | 'questionnaires'
  | 'articles'
  | 'guided'
  | 'map'
  | 'discoveries'
  | 'history'
  | 'weekly'
  | 'garden'
  | 'monthly-report'
  | 'self-care'
  | 'guidance'

type PlanFeature = {
  id: FeatureId
  label: string
  short?: string
  catalogKey?: string
  info?: {
    title: string
    what: string
    how?: string
    bullets?: string[]
    note?: string
  }
}

const FEATURES: Record<FeatureId, PlanFeature> = {
  checkin: { id: 'checkin', label: 'Check-in diário', catalogKey: 'checkin_daily' },
  diary: { id: 'diary', label: 'Diário emocional', catalogKey: 'wellbeing_diary_5_month' },
  voice: { id: 'voice', label: 'Diário por voz', catalogKey: 'diary_voice' },
  deepening: {
    id: 'deepening',
    label: 'Aprofundamentos do Diário',
    catalogKey: 'diary_deepenings',
    short: 'Acrescente novos momentos, pensamentos ou sentimentos ao seu Diário ao longo do dia.',
    info: {
      title: 'Aprofundamentos do Diário',
      what: 'Permitem voltar ao registro principal do dia para acrescentar o que mudou, aconteceu ou ganhou importância depois.',
      how: 'Cada aprofundamento fica ligado ao Diário daquele dia, sem criar um novo check-in.',
      note: 'Disponível no Plus, com até 3 aprofundamentos por dia.',
    },
  },
  questionnaires: {
    id: 'questionnaires',
    label: 'Questionários de autoconhecimento',
    catalogKey: 'basic_self_assessment',
    short: 'Questionários para ajudar você a refletir e compreender diferentes aspectos do seu momento.',
    info: {
      title: 'Questionários de autoconhecimento',
      what: 'São questionários organizados para apoiar reflexões sobre diferentes aspectos do bem-estar emocional.',
      how: 'A disponibilidade varia conforme o plano e conforme a classificação definida para cada questionário.',
    },
  },
  articles: { id: 'articles', label: 'Artigos e conteúdos', catalogKey: 'articles_free' },
  guided: {
    id: 'guided',
    label: 'Conteúdos Guiados',
    catalogKey: 'emotional_exercise_library',
    short: 'Exercícios, reflexões e práticas para diferentes momentos e necessidades.',
    info: {
      title: 'Conteúdos Guiados',
      what: 'Uma biblioteca de exercícios, reflexões, pausas e práticas de apoio não clínico.',
      how: 'No Gratuito há uma seleção para começar. Essencial e Plus recebem acesso completo.',
    },
  },
  map: {
    id: 'map',
    label: 'Mapa Emocional',
    catalogKey: 'diary_mood_symptoms_summary',
    short: 'Visualize como emoções, contextos e sintomas aparecem e evoluem nos seus registros.',
    info: {
      title: 'Mapa Emocional',
      what: 'Mostra como emoções, contextos e sintomas aparecem e se distribuem ao longo dos seus registros.',
      how: 'Organiza as informações de forma visual para facilitar a observação de tendências, mudanças e conexões ao longo do tempo.',
      bullets: ['Visão mensal', 'Gráfico de evolução', 'Emoções, contextos e sintomas', 'Conexões entre temas', 'Exploração progressiva das informações'],
      note: 'O Mapa Emocional não faz diagnósticos. Ele é uma ferramenta de autoconhecimento e reflexão.',
    },
  },
  discoveries: {
    id: 'discoveries',
    label: 'Descobertas',
    catalogKey: 'discoveries',
    short: 'Perceba padrões, repetições e conexões nos seus registros.',
    info: {
      title: 'Descobertas',
      what: 'Ajuda a perceber temas, situações e combinações que aparecem repetidamente nos seus registros.',
      how: 'As descobertas organizam sinais que podem passar despercebidos no dia a dia e podem ser salvas ou ocultadas.',
      note: 'As relações apresentadas são observações dos registros e não representam diagnóstico ou relação de causa e efeito.',
    },
  },
  history: {
    id: 'history',
    label: 'Minha História',
    catalogKey: 'full_history',
    short: 'Acompanhe como sua trajetória foi mudando ao longo do tempo.',
    info: {
      title: 'Minha História',
      what: 'Organiza sua trajetória para ajudar você a enxergar mudanças, períodos marcantes e temas importantes ao longo do tempo.',
      how: 'No Gratuito você recebe uma visão inicial. No Essencial e no Plus, a experiência completa inclui períodos, marcos, mudanças e evolução ao longo da trajetória.',
    },
  },
  weekly: {
    id: 'weekly',
    label: 'Relatório Semanal',
    catalogKey: 'weekly_assessments',
    short: 'Uma leitura organizada dos principais pontos da sua semana.',
    info: {
      title: 'Relatório Semanal',
      what: 'Reúne os principais registros da semana em uma leitura mais fácil de acompanhar.',
      how: 'Ajuda a rever o período, notar o que esteve mais presente e acompanhar mudanças de uma semana para outra.',
    },
  },
  garden: {
    id: 'garden',
    label: 'Meu Jardim',
    catalogKey: 'my_garden',
    short: 'Veja sua jornada ganhar vida em um espaço que cresce com seus momentos de cuidado.',
    info: {
      title: 'Meu Jardim',
      what: 'Uma representação visual da sua jornada dentro do projeto.',
      how: 'O jardim pode ganhar novos elementos conforme você registra seus momentos, acompanha relatórios e marca acontecimentos importantes.',
      note: 'Não existem sequências obrigatórias: nada morre e você não perde seu progresso quando fica um tempo sem registrar.',
    },
  },
  'monthly-report': {
    id: 'monthly-report',
    label: 'Relatório Mensal Aprofundado',
    catalogKey: 'advanced_monthly_report',
    short: 'Uma leitura mais completa dos padrões, mudanças, conexões e momentos importantes do mês.',
    info: {
      title: 'Relatório Mensal Aprofundado',
      what: 'Uma leitura mais ampla do que apareceu ao longo do mês nos seus registros.',
      how: 'Organiza padrões, mudanças, conexões e momentos importantes para ajudar você a compreender o período com mais profundidade.',
    },
  },
  'self-care': {
    id: 'self-care',
    label: 'Plano de Autocuidado Mensal',
    catalogKey: 'personalized_self_care_plan',
    short: 'Pequenas possibilidades de cuidado construídas a partir do que apareceu nos seus registros.',
    info: {
      title: 'Plano de Autocuidado Mensal',
      what: 'Transforma o que apareceu nos seus registros e padrões em poucas possibilidades práticas de cuidado para o próximo período.',
      how: 'Pode trazer um foco do mês, pequenas ações, uma ação principal, perguntas para observar e revisão do plano anterior.',
      note: 'As sugestões são de autocuidado e não substituem acompanhamento profissional.',
    },
  },
  guidance: {
    id: 'guidance',
    label: 'Orientação Mensal',
    catalogKey: 'monthly_message_guidance',
    short: 'Leve uma questão importante do seu momento e receba uma orientação personalizada.',
    info: {
      title: 'Orientação Mensal',
      what: 'Um espaço para levar uma questão importante do seu momento e receber uma orientação personalizada.',
      how: 'Você escolhe o tipo de apoio que deseja, envia sua questão e acompanha o status até a resposta.',
      note: 'Uma orientação pode ser solicitada por mês, conforme as regras do recurso.',
    },
  },
}

const PLAN_PRESENTATION: Record<PlanKey, {
  subtitle: string
  description: string
  Icon: typeof Sprout
  featured?: boolean
  features: Array<{ id: FeatureId; value?: string }>
}> = {
  free: {
    subtitle: 'Começar a se observar',
    description: 'Registre seus dias e dê os primeiros passos para compreender seu momento.',
    Icon: Sprout,
    features: [
      { id: 'checkin', value: '1 por dia' },
      { id: 'diary', value: 'Até 5 dias/mês' },
      { id: 'voice' },
      { id: 'questionnaires', value: 'Seleção do Gratuito' },
      { id: 'articles' },
      { id: 'guided', value: 'Seleção para começar' },
      { id: 'history', value: 'Visão inicial' },
    ],
  },
  essential: {
    subtitle: 'Entender seus padrões',
    description: 'Perceba conexões, acompanhe mudanças e compreenda melhor sua trajetória.',
    Icon: LineChart,
    featured: true,
    features: [
      { id: 'diary', value: 'Sem limite mensal' },
      { id: 'questionnaires', value: '+ questionários do Essencial' },
      { id: 'map', value: 'Completo' },
      { id: 'discoveries' },
      { id: 'history', value: 'Completa' },
      { id: 'weekly' },
      { id: 'guided', value: 'Acesso completo' },
      { id: 'garden' },
    ],
  },
  plus: {
    subtitle: 'Transformar entendimento em cuidado',
    description: 'Aprofunde o que percebe sobre si e encontre possibilidades de cuidado conectadas ao seu momento.',
    Icon: Star,
    features: [
      { id: 'deepening', value: 'Até 3 por dia' },
      { id: 'questionnaires', value: '+ questionários do Plus' },
      { id: 'monthly-report' },
      { id: 'self-care' },
      { id: 'guidance' },
    ],
  },
}

const PLANS = OFFICIAL_PLANS.map(plan => ({
  ...plan,
  ...PLAN_PRESENTATION[plan.key],
}))

const COMPARISON_ROWS: Array<{ id: FeatureId; values: Record<PlanKey, PlanCompareValue> }> = [
  { id: 'checkin', values: { free: '1 por dia', essential: '1 por dia', plus: '1 por dia' } },
  { id: 'diary', values: { free: 'Até 5 dias/mês', essential: 'Sem limite', plus: 'Sem limite' } },
  { id: 'voice', values: { free: true, essential: true, plus: true } },
  { id: 'deepening', values: { free: false, essential: false, plus: 'Até 3 por dia' } },
  { id: 'questionnaires', values: { free: 'Seleção', essential: 'Ampliados', plus: 'Do Plus' } },
  { id: 'articles', values: { free: true, essential: true, plus: true } },
  { id: 'guided', values: { free: 'Seleção', essential: 'Completo', plus: 'Completo' } },
  { id: 'map', values: { free: false, essential: 'Completo', plus: 'Completo' } },
  { id: 'discoveries', values: { free: false, essential: true, plus: true } },
  { id: 'history', values: { free: 'Visão inicial', essential: 'Completa', plus: 'Completa' } },
  { id: 'weekly', values: { free: false, essential: true, plus: true } },
  { id: 'garden', values: { free: false, essential: true, plus: true } },
  { id: 'monthly-report', values: { free: false, essential: false, plus: true } },
  { id: 'self-care', values: { free: false, essential: false, plus: true } },
  { id: 'guidance', values: { free: false, essential: false, plus: true } },
]

function ComparisonCell({ value }: { value: PlanCompareValue }) {
  if (value === true) return <Check className="w-4 h-4 text-forest-700 inline" aria-label="incluído" />
  if (value === false || value === '—') return <span className="text-ink-soft/45">—</span>
  return <span className="text-ink">{value}</span>
}

function InfoButton({ feature, onOpen }: { feature: PlanFeature; onOpen: (feature: PlanFeature) => void }) {
  if (!feature.info) return null
  return (
    <button type="button" onClick={() => onOpen(feature)} className="inline-flex items-center justify-center text-ink-soft hover:text-forest-800 transition-colors" aria-label={`Saiba mais sobre ${feature.label}`}>
      <Info className="w-3.5 h-3.5" />
    </button>
  )
}

export default function Pricing({ user, currentPlan, onNavigateAuth }: PricingProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [infoFeature, setInfoFeature] = useState<PlanFeature | null>(null)
  const [catalog, setCatalog] = useState<PlanFeatureCatalog>(() => buildFallbackPlanFeatureCatalog())
  const current = normalizePlan(currentPlan)
  const isPaidSubscriber = !!user && current !== 'free'
  const { prices } = usePlanPricing()

  useEffect(() => {
    void loadPlanFeatureCatalog().then(setCatalog)
  }, [])

  const displayPlans = useMemo(() => PLANS.map(p => ({
    ...p,
    price: prices[p.key]?.display || p.price,
    periodLabel: p.key === 'free' ? p.period : 'por mês',
    catalogBenefits: getCatalogPlanBenefits(catalog, p.key, 'pricing'),
  })), [prices, catalog])

  const catalogByKey = useMemo(() => new Map(catalog.items.map(item => [item.key, item])), [catalog])

  const hiddenApprovedFeatures = useMemo(() => {
    const hidden = new Set<FeatureId>()

    for (const feature of Object.values(FEATURES)) {
      if (!feature.catalogKey) continue
      const item = catalogByKey.get(feature.catalogKey)
      if (item && (!item.isActive || !item.showOnComparison)) hidden.add(feature.id)
    }

    for (const feature of Object.values(FEATURES)) {
      const item = catalog.items.find(candidate => candidate.name.trim().toLocaleLowerCase('pt-BR') === feature.label.trim().toLocaleLowerCase('pt-BR'))
      if (item && (!item.isActive || !item.showOnComparison)) hidden.add(feature.id)
    }

    return hidden
  }, [catalog, catalogByKey])

  // Recursos comerciais criados pelo Admin (aba "Catálogo de funcionalidades")
  // também entram na tabela de comparação — igual já acontecia em Meu Plano
  // via buildCatalogComparisonRows. Sem isso, um item novo só aparecia na
  // versão logada.
  const commercialComparisonRows = useMemo(() => catalog.items
    .filter(item => item.kind === 'commercial' && item.isActive && item.showOnComparison && item.key !== 'professional_comment_on_monthly_report')
    .map(item => ({
      id: item.key,
      label: item.name,
      values: {
        free: item.plans.free.enabled,
        essential: item.plans.essential.enabled,
        plus: item.plans.plus.enabled,
      } as Record<PlanKey, PlanCompareValue>,
    })), [catalog])

  const comparisonRows = useMemo(() => [
    ...COMPARISON_ROWS
      .filter(row => !hiddenApprovedFeatures.has(row.id))
      .map(row => ({ id: row.id, label: FEATURES[row.id].label, values: row.values })),
    ...commercialComparisonRows,
  ], [hiddenApprovedFeatures, commercialComparisonRows])

  const isFeatureVisibleOnPricing = (feature: PlanFeature) => {
    if (feature.catalogKey) {
      const item = catalog.items.find(candidate => candidate.key === feature.catalogKey)
      if (item && (!item.isActive || !item.showOnPricing)) return false
    }
    const commercial = catalog.items.find(candidate => candidate.kind === 'commercial' && candidate.name.trim().toLocaleLowerCase('pt-BR') === feature.label.trim().toLocaleLowerCase('pt-BR'))
    return !commercial || (commercial.isActive && commercial.showOnPricing)
  }

  const handlePlanAction = async (planKey: PlanKey) => {
    trackEvent('plan_click', { entity_id: planKey, entity_title: `Plano ${planKey}`, metadata: { location: 'pricing', plan: planKey } })
    const action = resolvePricingPlanAction(!!user, current, planKey)
    if (action === 'auth') {
      trackEvent('signup_click', { entity_id: planKey, metadata: { location: 'pricing', plan: planKey } })
      onNavigateAuth()
      return
    }
    if (action === 'current') return
    if (action === 'manage') {
      window.location.assign('/meu-plano')
      return
    }
    setLoadingPlan(planKey)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planKey, origin: window.location.origin },
      })
      if (fnError || !data?.url) throw new Error(fnError?.message || 'Erro ao iniciar o pagamento')
      trackEvent('checkout_started', { entity_id: planKey, entity_title: `Plano ${planKey}`, metadata: { location: 'pricing', plan: planKey } })
      window.location.href = data.url
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao redirecionar para pagamento.')
      setLoadingPlan(null)
    }
  }

  return (
    <section id="pricing" className="relative overflow-hidden bg-paper">
      <div className="pointer-events-none absolute -left-24 top-44 h-72 w-72 rounded-full bg-mint/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-20 h-80 w-80 rounded-full bg-sand-100/70 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 py-14 md:py-20">
        <div className="max-w-3xl mb-10 md:mb-12">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-forest-700 mb-3">Escolha o seu ritmo</p>
          <h1 className="font-serif text-4xl md:text-6xl leading-[1.02] text-forest-950">Cuidar de si também pode ser simples</h1>
          <p className="mt-4 text-base md:text-lg text-ink-soft leading-relaxed max-w-2xl">
            Planos pensados para acompanhar você em cada etapa da sua jornada. Mais do que funcionalidades, um espaço para se conhecer, se entender e encontrar seu próprio caminho de cuidado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
          {displayPlans.map(plan => {
            const action = resolvePricingPlanAction(!!user, current, plan.key)
            const isCurrent = action === 'current'
            const isCheckoutLoading = action === 'checkout' && loadingPlan === plan.key
            const unavailable = !isCurrent && prices[plan.key]?.active === false
            const inheritedLabel = plan.key === 'essential' ? 'Tudo do Gratuito, mais:' : plan.key === 'plus' ? 'Tudo do Essencial, mais:' : null
            const visibleFeatures = plan.features.filter(item => isFeatureVisibleOnPricing(FEATURES[item.id]))

            return (
              <article key={plan.key} className={`relative rounded-[28px] p-6 md:p-7 flex flex-col border shadow-sm ${plan.featured ? 'bg-mint/30 border-forest-300 md:-mt-2 md:mb-2 shadow-md' : plan.key === 'plus' ? 'bg-[#fbf3e8] border-[#ead8bd]' : 'bg-paper-soft border-line'}`}>
                {plan.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-forest-900 text-white text-[10px] tracking-[0.12em] uppercase font-semibold px-4 py-1.5 rounded-full whitespace-nowrap">Mais escolhido</span>}
                <div className="text-center">
                  <span className="w-14 h-14 rounded-full bg-white/70 border border-white/80 flex items-center justify-center mx-auto"><plan.Icon className="w-7 h-7 text-forest-700" /></span>
                  <h2 className="font-serif text-3xl text-forest-950 mt-4">{plan.label}</h2>
                  <p className="font-serif text-lg text-forest-900 mt-1">{plan.subtitle}</p>
                  <p className="text-sm text-ink-soft mt-2 min-h-[42px]">{plan.description}</p>
                  <div className="mt-5"><span className="font-serif text-3xl text-forest-950">{plan.price}</span><span className="block text-xs text-ink-soft mt-0.5">{plan.periodLabel}</span></div>
                </div>

                <div className="mt-5 mb-5">
                  {isCurrent ? (
                    <button disabled className="w-full py-3 rounded-2xl text-sm font-semibold bg-mint/70 text-forest-800 cursor-default">✓ Plano atual</button>
                  ) : unavailable ? (
                    <button disabled className="w-full py-3 rounded-2xl text-sm font-semibold border border-line text-ink-soft cursor-default">Indisponível agora</button>
                  ) : (
                    <button data-cta={`assinar-${plan.key}`} data-cta-location="pricing" data-cta-plan={plan.key} onClick={() => handlePlanAction(plan.key)} disabled={isCheckoutLoading} className={`w-full py-3 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-70 ${plan.key === 'free' ? 'border border-forest-800 text-forest-900 hover:bg-forest-900 hover:text-white' : 'bg-forest-900 hover:bg-forest-800 text-white'}`}>
                      {isCheckoutLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando...</> : action === 'manage' ? 'Gerenciar mudança' : plan.key === 'free' ? 'Criar conta gratuita' : user ? 'Começar agora' : 'Criar conta para assinar'}
                    </button>
                  )}
                </div>

                {inheritedLabel && <p className="text-xs font-semibold text-forest-900 mb-3">{inheritedLabel}</p>}
                <ul className="space-y-3.5 flex-1">
                  {visibleFeatures.map(item => {
                    const feature = FEATURES[item.id]
                    return (
                      <li key={`${plan.key}-${item.id}`} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-forest-700" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap"><span className="text-sm text-ink">{feature.label}{item.value ? ` — ${item.value}` : ''}</span><InfoButton feature={feature} onOpen={setInfoFeature} /></div>
                        </div>
                      </li>
                    )
                  })}
                  {plan.catalogBenefits.filter(item => !item.inheritedLabel && item.key !== 'professional_comment_on_monthly_report' && item.key.startsWith('commercial:')).map(item => (
                    <li key={`${plan.key}-${item.key}`} className="flex items-start gap-2.5"><Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-forest-700" /><span className="text-sm text-ink">{item.label}</span></li>
                  ))}
                </ul>
              </article>
            )
          })}
        </div>

        {isPaidSubscriber && <div className="mt-6 bg-mint/40 border border-line rounded-2xl p-4 max-w-2xl mx-auto text-center"><p className="text-forest-800 text-sm">Você já possui uma assinatura. Ao escolher outro plano, a mudança será concluída em Meu Plano sem criar uma segunda assinatura.</p></div>}
        {error && <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 max-w-2xl mx-auto text-center"><p className="text-red-600 text-sm">{error}</p></div>}

        <div className="mt-14 md:mt-16 rounded-[30px] border border-line bg-paper-soft/90 p-4 md:p-7 shadow-sm">
          <div className="mb-6"><h2 className="font-serif text-3xl md:text-4xl text-forest-950">Compare todos os recursos</h2><p className="text-sm text-ink-soft mt-1">Veja em detalhes o que está incluído em cada plano.</p></div>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white/45">
            <table className="w-full min-w-[760px] border-collapse">
              <thead><tr className="text-sm bg-white/60"><th className="text-left px-4 py-4 text-xs font-semibold text-forest-700">Funcionalidade</th><th className="px-4 py-4"><span className="flex items-center justify-center gap-1.5"><Sprout className="w-4 h-4 text-forest-600" /><span className="font-serif text-lg text-forest-900">Gratuito</span></span></th><th className="px-4 py-4 bg-mint/40"><span className="flex items-center justify-center gap-1.5"><LineChart className="w-4 h-4 text-forest-600" /><span className="font-serif text-lg text-forest-900">Essencial</span></span></th><th className="px-4 py-4"><span className="flex items-center justify-center gap-1.5"><Star className="w-4 h-4 text-forest-700" /><span className="font-serif text-lg text-forest-900">Plus</span></span></th></tr></thead>
              <tbody>
                {comparisonRows.map(row => {
                  const feature: PlanFeature | undefined = FEATURES[row.id as FeatureId]
                  const catalogItem = feature?.catalogKey ? catalogByKey.get(feature.catalogKey) : null
                  const rowLabel = catalogItem?.name?.trim() || row.label
                  return (
                    <tr key={row.id} className="border-t border-line align-top">
                      <td className="px-4 py-4"><div className="flex items-center gap-1.5"><span className="text-sm font-semibold text-forest-900">{rowLabel}</span>{feature && <InfoButton feature={{ ...feature, label: rowLabel }} onOpen={setInfoFeature} />}</div></td>
                      <td className="px-4 py-4 text-center text-sm"><ComparisonCell value={catalogItem?.plans.free.label?.trim() || row.values.free} /></td>
                      <td className="px-4 py-4 text-center text-sm bg-mint/25"><ComparisonCell value={catalogItem?.plans.essential.label?.trim() || row.values.essential} /></td>
                      <td className="px-4 py-4 text-center text-sm"><ComparisonCell value={catalogItem?.plans.plus.label?.trim() || row.values.plus} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-line bg-[#f8f4eb] px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><h3 className="font-serif text-2xl text-forest-950">Ainda tem dúvidas?</h3><p className="text-sm text-ink-soft mt-1">Confira as perguntas mais frequentes sobre planos, pagamentos e funcionalidades.</p></div><a href="/faq" className="inline-flex items-center justify-center rounded-2xl border border-forest-800 px-5 py-3 text-sm font-semibold text-forest-900 hover:bg-forest-900 hover:text-white transition-colors">Ver perguntas frequentes</a></div>
        <div className="mt-5 rounded-3xl bg-forest-900 px-6 py-6 md:px-8 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4"><div><p className="font-serif text-2xl">Escolha o plano que faz sentido para o seu momento.</p><p className="text-sm text-white/75 mt-1">Você pode começar gratuitamente e mudar de plano quando quiser.</p></div><button onClick={onNavigateAuth} className="rounded-2xl bg-paper px-5 py-3 text-sm font-semibold text-forest-950 hover:bg-white transition-colors">Começar agora</button></div>

        <div className="mt-8 max-w-2xl mx-auto bg-paper-soft border border-line rounded-2xl px-5 py-4 flex items-start gap-3"><span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center flex-shrink-0 text-forest-600"><ShieldCheck className="w-4 h-4" /></span><p className="text-sm text-forest-800 leading-relaxed">Todos os planos pagos são mensais e podem ser cancelados conforme as regras da assinatura. Pagamentos são processados com segurança pelo Stripe — seu plano só é ativado após a confirmação.</p></div>
        <p className="text-center text-xs text-ink-soft mt-5 max-w-2xl mx-auto leading-relaxed">Seus dados são privados e protegidos. A plataforma não substitui acompanhamento psicológico, psiquiátrico ou atendimento de emergência.</p>
      </div>

      {infoFeature?.info && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={`Informações sobre ${infoFeature.label}`}>
          <button type="button" className="absolute inset-0 bg-forest-950/35 backdrop-blur-[2px]" onClick={() => setInfoFeature(null)} aria-label="Fechar informações" />
          <div className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[28px] border border-line bg-paper shadow-2xl p-6 sm:p-7 max-h-[85vh] overflow-y-auto">
            <button type="button" onClick={() => setInfoFeature(null)} className="absolute right-5 top-5 w-8 h-8 rounded-full hover:bg-mint/60 inline-flex items-center justify-center text-ink-soft hover:text-forest-900" aria-label="Fechar"><X className="w-4 h-4" /></button>
            <div className="w-10 h-10 rounded-xl bg-mint flex items-center justify-center text-forest-700 mb-4"><Info className="w-5 h-5" /></div>
            <h3 className="font-serif text-2xl text-forest-950 pr-10">{infoFeature.info.title}</h3>
            <div className="mt-5 space-y-4 text-sm leading-relaxed">
              <div><p className="font-semibold text-forest-900">O que é?</p><p className="text-ink-soft mt-1">{infoFeature.info.what}</p></div>
              {infoFeature.info.how && <div><p className="font-semibold text-forest-900">Como funciona?</p><p className="text-ink-soft mt-1">{infoFeature.info.how}</p></div>}
              {infoFeature.info.bullets && <div><p className="font-semibold text-forest-900 mb-2">O que você encontra?</p><ul className="space-y-1.5 text-ink-soft">{infoFeature.info.bullets.map(item => <li key={item} className="flex gap-2"><span className="text-forest-700">•</span><span>{item}</span></li>)}</ul></div>}
              {infoFeature.info.note && <div className="rounded-2xl bg-mint/45 border border-line p-4 text-forest-800">{infoFeature.info.note}</div>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
