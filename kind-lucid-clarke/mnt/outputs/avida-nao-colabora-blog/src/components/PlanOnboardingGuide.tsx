import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { ArrowRight, BookOpen, Check, ChevronDown, ChevronUp, Compass, Flower2, HeartHandshake, Map, NotebookPen, Sparkles, X } from 'lucide-react'

type Item = {
  id: string
  title: string
  description: string
  route: string
  Icon: typeof Sparkles
  realDone?: boolean
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  plus: 'Plus',
  therapeutic: 'Plus',
  'therapeutic-plus': 'Plus',
}

const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000
const WINDOW_MS = 21 * 24 * 60 * 60 * 1000

function canonicalPlan(plan?: string | null): 'free' | 'essential' | 'plus' {
  if (plan === 'essential') return 'essential'
  if (plan === 'plus' || plan === 'therapeutic' || plan === 'therapeutic-plus') return 'plus'
  return 'free'
}

export default function PlanOnboardingGuide({ user, profile, onNavigate, checkinSaved = false }: {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
  checkinSaved?: boolean
}) {
  const plan = canonicalPlan(profile?.plan)
  const planLabel = PLAN_LABEL[profile?.plan ?? 'free'] ?? 'Gratuito'
  const storagePrefix = user ? `avnc_onboarding_v1:${user.id}:${plan}` : 'avnc_onboarding_v1:anon'
  const [loaded, setLoaded] = useState(false)
  const [checkinDone, setCheckinDone] = useState(checkinSaved)
  const [diaryDone, setDiaryDone] = useState(false)
  const [planActivatedAt, setPlanActivatedAt] = useState<string | null>(null)
  const [seen, setSeen] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => { if (checkinSaved) setCheckinDone(true) }, [checkinSaved])

  useEffect(() => {
    if (!user || !profile) return
    let active = true
    try {
      const rawDismiss = localStorage.getItem(`${storagePrefix}:dismissed_until`)
      if (rawDismiss && Number(rawDismiss) > Date.now()) setDismissed(true)
      const rawSeen = localStorage.getItem(`${storagePrefix}:seen`)
      if (rawSeen) setSeen(new Set(JSON.parse(rawSeen) as string[]))
    } catch { /* localStorage indisponível não impede o guia */ }

    void Promise.all([
      supabase.from('diary_entries').select('entry_type').eq('user_id', user.id).in('entry_type', ['checkin', 'diary']).limit(200),
      supabase.from('profiles').select('plan_activated_at').eq('user_id', user.id).maybeSingle(),
    ]).then(([entriesRes, profileRes]) => {
      if (!active) return
      const rows = (entriesRes.data ?? []) as { entry_type?: string | null }[]
      setCheckinDone(current => current || rows.some(row => row.entry_type === 'checkin'))
      setDiaryDone(rows.some(row => row.entry_type === 'diary'))
      const activation = profileRes.data as { plan_activated_at?: string | null } | null
      setPlanActivatedAt(activation?.plan_activated_at ?? null)
      setLoaded(true)
    }).catch(() => { if (active) setLoaded(true) })

    return () => { active = false }
  }, [user, profile, storagePrefix])

  const items = useMemo<Item[]>(() => {
    const basics: Item[] = [
      { id: 'first-checkin', title: 'Fazer um Check-in', description: 'Um registro rápido de como o dia está sendo. Leva menos de um minuto.', route: 'home', Icon: HeartHandshake, realDone: checkinDone },
      { id: 'first-diary', title: 'Conhecer o Diário', description: 'Para os dias em que você quiser colocar um pouco mais em palavras.', route: 'diary', Icon: NotebookPen, realDone: diaryDone },
    ]
    if (plan === 'free') return [
      ...basics,
      { id: 'questionnaires', title: 'Explorar um questionário', description: 'Use quando quiser observar um tema com um pouco mais de estrutura.', route: 'questionarios', Icon: Compass },
      { id: 'contents', title: 'Encontrar uma leitura', description: 'Artigos e conteúdos para consultar sem transformar autocuidado em obrigação.', route: 'articles', Icon: BookOpen },
    ]
    if (plan === 'essential') return [
      ...basics,
      { id: 'emotional-map', title: 'Conhecer o Mapa Emocional', description: 'Veja como seus registros vão se distribuindo ao longo do tempo.', route: 'my-evolution', Icon: Map },
      { id: 'discoveries', title: 'Ver Descobertas', description: 'Perceba recorrências que começam a aparecer nos seus registros.', route: 'descobertas', Icon: Sparkles },
      { id: 'garden', title: 'Visitar Meu Jardim', description: 'Uma forma leve de acompanhar a constância que você vem cultivando.', route: 'my-garden', Icon: Flower2 },
      { id: 'weekly-report', title: 'Entender o Relatório Semanal', description: 'Ele ganha contexto quando já existem registros suficientes da sua semana.', route: 'my-report', Icon: Compass },
    ]
    return [
      ...basics,
      { id: 'deepening', title: 'Experimentar um Aprofundamento', description: 'Quando quiser ir além de um registro comum no Diário.', route: 'diary', Icon: NotebookPen },
      { id: 'care-plan', title: 'Entender o Plano de Autocuidado', description: 'Ele se forma com o uso e aparece quando houver registros suficientes.', route: 'self-care', Icon: HeartHandshake },
      { id: 'monthly-report', title: 'Conhecer o Relatório Mensal', description: 'Uma leitura mais ampla do período, construída a partir do histórico disponível.', route: 'my-report', Icon: Compass },
      { id: 'guidance', title: 'Como funciona a Orientação Mensal', description: 'Veja quando fica elegível e como enviar sua mensagem no mês seguinte ao período fechado.', route: 'monthly-guidance', Icon: Sparkles },
    ]
  }, [plan, checkinDone, diaryDone])

  const isRecent = useMemo(() => {
    const created = profile?.created_at ? new Date(profile.created_at).getTime() : 0
    const recentAccount = created > 0 && Date.now() - created <= WINDOW_MS
    const activated = planActivatedAt ? new Date(planActivatedAt).getTime() : 0
    const recentPlan = plan !== 'free' && activated > 0 && Date.now() - activated <= WINDOW_MS
    return recentAccount || recentPlan
  }, [profile?.created_at, planActivatedAt, plan])

  if (!user || !profile || !loaded || dismissed || !isRecent) return null

  const isDone = (item: Item) => item.realDone === true || seen.has(item.id)
  const doneCount = items.filter(isDone).length
  const pending = items.filter(item => !isDone(item))
  const visible = expanded ? items : (pending.length ? pending.slice(0, 3) : items.slice(0, 3))

  function rememberSeen(id: string) {
    const next = new Set(seen)
    next.add(id)
    setSeen(next)
    try { localStorage.setItem(`${storagePrefix}:seen`, JSON.stringify([...next])) } catch { /* noop */ }
  }

  function open(item: Item) {
    rememberSeen(item.id)
    if (item.route === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    onNavigate(item.route)
  }

  function dismissForNow() {
    setDismissed(true)
    try { localStorage.setItem(`${storagePrefix}:dismissed_until`, String(Date.now() + DISMISS_FOR_MS)) } catch { /* noop */ }
  }

  const paid = plan !== 'free'
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8" aria-label="Onboarding do seu espaço">
      <div className="rounded-[26px] border border-line bg-white/75 overflow-hidden shadow-sm">
        <div className="p-5 sm:p-6 flex items-start justify-between gap-4 border-b border-line">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{paid ? `Novidades do seu ${planLabel}` : 'Conheça seu espaço'}</p>
            <h2 className="font-serif text-2xl text-forest-900 mt-1">{paid ? 'Explore aos poucos, no seu ritmo.' : 'Você não precisa descobrir tudo hoje.'}</h2>
            <p className="text-sm text-ink-soft mt-2 max-w-3xl leading-relaxed">{paid
              ? 'Seu plano abriu novos caminhos. Algumas áreas ficam mais úteis conforme seus registros criam histórico — não existe nada para colocar em dia.'
              : 'Comece pelo que fizer sentido. Conforme você usa o espaço, este guia vai ficando menor sozinho.'}</p>
          </div>
          <button type="button" onClick={dismissForNow} className="p-2 rounded-xl text-ink-soft hover:bg-paper-soft" aria-label="Ocultar onboarding por 7 dias"><X className="w-4 h-4" /></button>
        </div>

        <div className="divide-y divide-line">
          {visible.map(item => {
            const done = isDone(item)
            const Icon = item.Icon
            return <button key={item.id} type="button" onClick={() => open(item)} className="w-full flex items-center gap-3.5 p-4 sm:px-6 text-left hover:bg-mint/20 transition-colors group">
              <span className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${done ? 'bg-mint text-forest-800' : 'bg-paper-soft text-forest-700'}`}>
                {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${done ? 'text-forest-700' : 'text-forest-900'}`}>{item.title}</span>
                <span className="block text-xs sm:text-sm text-ink-soft mt-1 leading-relaxed">{item.description}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-forest-600 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
            </button>
          })}
        </div>

        <div className="px-5 sm:px-6 py-4 bg-paper-soft/60 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-soft"><strong className="text-forest-800">{doneCount} de {items.length}</strong> caminhos já conhecidos. Isso não é uma meta — é só um mapa do que existe por aqui.</p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onNavigate('my-plan')} className="text-xs font-semibold text-forest-700 hover:text-forest-900">Ver tudo do meu plano</button>
            {items.length > 3 && <button type="button" onClick={() => setExpanded(value => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:text-forest-900">{expanded ? 'Mostrar menos' : 'Mostrar todos'} {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</button>}
          </div>
        </div>
      </div>
    </section>
  )
}
