import { useEffect, useState } from 'react'
import {
  ArrowRight, BarChart3, BookOpen, CalendarDays, CheckCircle2, Clock3, History,
  Leaf, LineChart, Lock, NotebookPen, Sparkles, Sprout, X,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { normalizePlan, hasPlanAccess, type PlanKey } from '../lib/officialPlans'
import { fetchDiaryConfig } from '../lib/diaryConfig'
import { ymd } from '../lib/reportPeriods'
import { buildContinuityPrompt, type ContinuityEntry, type ContinuityPrompt } from '../lib/todayContinuity'
import { buildHomeDiscovery, type HomeDiscovery, type HomeDiscoveryEntry } from '../lib/homeDiscoveries'
import { MoodChip } from './user/ui'
import { MOODS } from './user/moods'
import RecommendedContent from './RecommendedContent'
import HomeDiscoveryCard from './HomeDiscoveryCard'

interface LoggedHomeProps {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string, articleSlug?: string) => void
}

type HomeEntry = ContinuityEntry & HomeDiscoveryEntry & {
  entry_type?: string | null
  diary_kind?: string | null
}

interface HomeStats {
  activeDays30: number
  activeDays7: number
  activeDayKeys: string[]
  checkins7: number
  reflections7: number
  diaryThisMonth: number
  diaryLimit: number | null
  todayEntries: number
  todayReflections: number
  latestMood: string | null
  latestCreatedAt: string | null
  dominantMood7: string | null
  loaded: boolean
}

const EMPTY_STATS: HomeStats = {
  activeDays30: 0,
  activeDays7: 0,
  activeDayKeys: [],
  checkins7: 0,
  reflections7: 0,
  diaryThisMonth: 0,
  diaryLimit: null,
  todayEntries: 0,
  todayReflections: 0,
  latestMood: null,
  latestCreatedAt: null,
  dominantMood7: null,
  loaded: false,
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  }).format(new Date())
}

function timeLabel(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function entryDay(entry: HomeEntry) {
  const explicit = String(entry.date ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit
  if (!entry.created_at) return ''
  const date = new Date(entry.created_at)
  return Number.isNaN(date.getTime()) ? '' : ymd(date)
}

function moodLabel(key: string | null) {
  if (!key) return null
  return MOODS.find(m => m.key === key || m.label.toLowerCase() === key.toLowerCase())?.label ?? null
}

function getLastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setHours(12, 0, 0, 0)
    date.setDate(date.getDate() - (6 - index))
    return {
      key: ymd(date),
      label: new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '').slice(0, 3),
      day: new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date),
      isToday: index === 6,
    }
  })
}

function dominantMood(entries: HomeEntry[]) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const raw = String(entry.mood ?? '')
    const mood = MOODS.find(item => item.key === raw || item.label.toLowerCase() === raw.toLowerCase())
    if (!mood) continue
    counts.set(mood.key, (counts.get(mood.key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function dismissedKey(todayKey: string, prompt: ContinuityPrompt) {
  return `avnc:continuity-dismissed:${todayKey}:${prompt.id}`
}

function dismissedDiscoveryKey(todayKey: string, discovery: HomeDiscovery) {
  return `avnc:discovery-dismissed:${todayKey}:${discovery.id}`
}

export default function LoggedHome({ user, profile, onNavigate }: LoggedHomeProps) {
  const plan: PlanKey = normalizePlan(profile?.plan)
  const name = profile?.preferred_name || profile?.display_name || profile?.full_name?.split(' ')[0] || 'você'
  const [stats, setStats] = useState<HomeStats>(EMPTY_STATS)
  const [continuity, setContinuity] = useState<ContinuityPrompt | null>(null)
  const [discovery, setDiscovery] = useState<HomeDiscovery | null>(null)
  const lastSeven = getLastSevenDays()
  const todayKey = ymd(new Date())

  useEffect(() => {
    if (!user) return
    let active = true

    ;(async () => {
      try {
        const since = new Date(Date.now() - 30 * 864e5).toISOString()
        const [{ data }, diaryCfg] = await Promise.all([
          supabase
            .from('diary_entries')
            .select('created_at,entry_type,diary_kind,date,mood,energy,anxiety_level,sleep_quality,context_tags,trigger_tags,emotional_tags')
            .eq('user_id', user.id)
            .gte('created_at', since)
            .order('created_at', { ascending: false }),
          fetchDiaryConfig(profile?.plan ?? 'free'),
        ])
        if (!active) return

        const entries = (data ?? []) as HomeEntry[]
        const keys7 = new Set(lastSeven.map(day => day.key))
        const days30 = new Set(entries.map(entryDay).filter(Boolean))
        const entries7 = entries.filter(entry => keys7.has(entryDay(entry)))
        const todayEntries = entries.filter(entry => entryDay(entry) === todayKey)
        const latest = todayEntries[0] ?? null
        const monthKey = todayKey.slice(0, 7)
        const diaryThisMonth = entries.filter(entry =>
          (entry.entry_type ?? 'diary') === 'diary' &&
          entry.diary_kind === 'basic' &&
          entryDay(entry).startsWith(monthKey),
        ).length

        setStats({
          activeDays30: days30.size,
          activeDays7: new Set(entries7.map(entryDay).filter(Boolean)).size,
          activeDayKeys: [...days30],
          checkins7: entries7.filter(entry => entry.entry_type === 'checkin').length,
          reflections7: entries7.filter(entry => (entry.entry_type ?? 'diary') === 'diary').length,
          diaryThisMonth,
          diaryLimit: diaryCfg.entriesPerMonth,
          todayEntries: todayEntries.length,
          todayReflections: todayEntries.filter(entry => (entry.entry_type ?? 'diary') === 'diary').length,
          latestMood: latest?.mood != null ? String(latest.mood) : null,
          latestCreatedAt: latest?.created_at ?? null,
          dominantMood7: dominantMood(entries7),
          loaded: true,
        })

        const nextDiscovery = buildHomeDiscovery(entries, plan)
        if (!nextDiscovery) {
          setDiscovery(null)
        } else {
          let dismissed = false
          try { dismissed = window.localStorage.getItem(dismissedDiscoveryKey(todayKey, nextDiscovery)) === '1' } catch { /* storage opcional */ }
          setDiscovery(dismissed ? null : nextDiscovery)
        }

        const prompt = buildContinuityPrompt(entries, todayKey, todayEntries.length > 0)
        if (!prompt) {
          setContinuity(null)
        } else {
          let dismissed = false
          try { dismissed = window.localStorage.getItem(dismissedKey(todayKey, prompt)) === '1' } catch { /* storage opcional */ }
          setContinuity(dismissed ? null : prompt)
        }
      } catch {
        if (active) {
          setStats(current => ({ ...current, loaded: true }))
          setContinuity(null)
          setDiscovery(null)
        }
      }
    })()

    return () => { active = false }
    // lastSeven/todayKey representam o dia em que a Home foi montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile?.plan])

  function dismissContinuity() {
    if (!continuity) return
    try { window.localStorage.setItem(dismissedKey(todayKey, continuity), '1') } catch { /* segue sem persistência local */ }
    setContinuity(null)
  }

  function dismissDiscovery() {
    if (!discovery) return
    try { window.localStorage.setItem(dismissedDiscoveryKey(todayKey, discovery), '1') } catch { /* segue sem persistência local */ }
    setDiscovery(null)
  }

  const latestMoodName = moodLabel(stats.latestMood)
  const dominantMoodName = moodLabel(stats.dominantMood7)
  const latestTime = timeLabel(stats.latestCreatedAt)
  const weeklyAccess = hasPlanAccess(plan, 'essential')
  const selfCareAccess = hasPlanAccess(plan, 'plus')

  const nextStep = !stats.loaded || stats.todayEntries === 0
    ? {
        eyebrow: '1 minuto para você',
        title: continuity ? 'Continue de onde sua história parou' : 'Faça seu primeiro registro de hoje',
        description: continuity
          ? 'Há um ponto do seu histórico recente que pode ajudar a começar sem partir do zero. Você também pode ignorá-lo e registrar qualquer outra coisa.'
          : 'Comece pelo que está acontecendo agora. Não precisa explicar tudo nem chegar a nenhuma conclusão.',
        action: 'Fazer check-in',
        target: 'diary',
        secondary: 'Quero escrever',
      }
    : stats.todayReflections === 0
      ? {
          eyebrow: 'Você já começou',
          title: 'Quer colocar esse momento em palavras?',
          description: latestMoodName
            ? `Seu registro mais recente marcou ${latestMoodName.toLowerCase()}. Se fizer sentido, você pode escrever um pouco sobre o que está por trás disso.`
            : 'Seu check-in de hoje já está salvo. Se fizer sentido, você pode escrever um pouco sobre o que está por trás dele.',
          action: 'Escrever no diário',
          target: 'diary',
          secondary: 'Ver meu mapa',
        }
      : {
          eyebrow: 'Seu momento está registrado',
          title: 'Agora você pode apenas seguir o dia — ou olhar com mais distância',
          description: 'Seu registro de hoje já faz parte da sua história. O Mapa Emocional reúne esses momentos para mostrar o que vem aparecendo ao longo do tempo.',
          action: 'Ver meus padrões',
          target: 'my-evolution',
          secondary: 'Registrar como estou agora',
        }

  const nextSecondaryTarget = stats.todayEntries === 0
    ? 'diary'
    : stats.todayReflections === 0
      ? 'my-evolution'
      : 'diary'

  const weekSummary = stats.activeDays7 === 0
    ? 'Ainda não há registros nos últimos 7 dias. O próximo registro já cria um novo ponto para você observar depois.'
    : stats.activeDays7 === 1
      ? 'Há um dia registrado nesta semana. É um começo suficiente — não existe sequência obrigatória por aqui.'
      : dominantMoodName
        ? `Você registrou algo em ${stats.activeDays7} dos últimos 7 dias. Entre os estados marcados, ${dominantMoodName.toLowerCase()} está entre os que mais apareceram.`
        : `Você registrou algo em ${stats.activeDays7} dos últimos 7 dias. Aos poucos, esses pontos deixam sua visão do período mais completa.`

  const upgrade = plan === 'free'
    ? { label: 'Conhecer o Essencial' }
    : plan === 'essential'
      ? { label: 'Conhecer o Plus' }
      : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 lg:py-8 space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-line bg-gradient-to-br from-mint via-paper-soft to-sand-50">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/50 blur-2xl" aria-hidden />
        <div className="relative grid lg:grid-cols-[1fr_300px] gap-6 p-5 sm:p-7 lg:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft mb-4">
              <span className="inline-flex items-center gap-1.5 bg-white/70 border border-line rounded-full px-3 py-1.5 capitalize">
                <CalendarDays className="w-3.5 h-3.5 text-forest-600" /> {todayLabel()}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-forest-500" /> Seu espaço de hoje
              </span>
            </div>

            <p className="text-sm font-medium text-forest-700">{greeting()}, <span className="capitalize">{name}</span>.</p>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] leading-[1.08] text-forest-900 mt-1.5 max-w-2xl">
              Como a vida colaborou hoje?
            </h1>
            <p className="text-sm sm:text-base text-ink-soft mt-3 max-w-2xl leading-relaxed">
              Não precisa estar tudo bem. Escolha o estado que mais combina com o seu momento agora e continue a partir daí.
            </p>

            <div className="flex flex-wrap gap-2 mt-5" aria-label="Como você está agora">
              {MOODS.map(mood => (
                <MoodChip
                  key={mood.key}
                  mood={mood}
                  active={Boolean(stats.latestMood && (stats.latestMood === mood.key || stats.latestMood.toLowerCase() === mood.label.toLowerCase())) && stats.todayEntries > 0}
                  onClick={() => onNavigate(`diary?mood=${mood.key}`)}
                />
              ))}
            </div>
          </div>

          <div className="lg:self-stretch rounded-3xl bg-white/80 border border-white shadow-sm p-5 flex flex-col justify-between">
            {stats.todayEntries > 0 ? (
              <>
                <div>
                  <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center mb-4"><CheckCircle2 className="w-5 h-5" /></span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest-600">Você já passou por aqui hoje</p>
                  <p className="font-serif text-xl text-forest-900 mt-1.5">{latestMoodName || 'Seu registro está salvo'}</p>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">
                    {latestTime ? `Último registro às ${latestTime}. ` : ''}Você pode voltar quantas vezes precisar — sem ter que recomeçar o dia.
                  </p>
                </div>
                <button onClick={() => onNavigate('diary')} className="mt-5 inline-flex items-center justify-between gap-3 text-sm font-medium text-forest-800 bg-mint/70 hover:bg-mint rounded-2xl px-4 py-3 transition-colors">
                  Continuar meu registro <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <div>
                  <span className="w-10 h-10 rounded-2xl bg-sand-100 text-forest-700 flex items-center justify-center mb-4"><Clock3 className="w-5 h-5" /></span>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-forest-600">Seu momento de hoje</p>
                  <p className="font-serif text-xl text-forest-900 mt-1.5">Hoje ainda está em branco</p>
                  <p className="text-sm text-ink-soft mt-2 leading-relaxed">Um check-in rápido já é suficiente. Você decide se quer parar por aí ou continuar escrevendo.</p>
                </div>
                <button onClick={() => onNavigate('diary')} className="mt-5 inline-flex items-center justify-between gap-3 text-sm font-medium text-white bg-forest-900 hover:bg-forest-800 rounded-2xl px-4 py-3 transition-colors">
                  Começar meu momento <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {continuity && (
        <section className="relative overflow-hidden rounded-3xl border border-forest-100 bg-forest-50/70 p-5 sm:p-6" aria-labelledby="continuity-title">
          <button
            type="button"
            onClick={dismissContinuity}
            aria-label="Ocultar esta retomada hoje"
            className="absolute right-4 top-4 rounded-xl p-2 text-ink-soft hover:bg-white/70 hover:text-forest-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-4 pr-8">
            <span className="w-11 h-11 rounded-2xl bg-white border border-forest-100 text-forest-700 flex items-center justify-center flex-shrink-0">
              <History className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">{continuity.eyebrow}</p>
              <h2 id="continuity-title" className="font-serif text-2xl text-forest-900 mt-1">{continuity.title}</h2>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-3xl">{continuity.description}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => onNavigate('diary')}
                  className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
                >
                  {continuity.action} <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={dismissContinuity} className="text-sm font-medium text-forest-700 px-3 py-2.5 rounded-xl hover:bg-white/70 transition-colors">Agora não</button>
              </div>
              <p className="text-[11px] text-ink-soft mt-4 leading-relaxed">
                Esta retomada usa apenas marcadores estruturados do seu histórico. Nenhum trecho do texto do Diário é exibido aqui.
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-5 lg:gap-6">
        <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6 lg:p-7">
          <div className="flex items-start gap-4">
            <span className="w-11 h-11 rounded-2xl bg-forest-900 text-white flex items-center justify-center flex-shrink-0"><Sparkles className="w-5 h-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu próximo passo</p>
              <h2 className="font-serif text-2xl text-forest-900 mt-1">{nextStep.title}</h2>
              <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-2xl">{nextStep.description}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <button onClick={() => onNavigate(nextStep.target)} className="inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors">
                  {nextStep.action} <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => onNavigate(nextSecondaryTarget)} className="inline-flex items-center gap-2 border border-line bg-white hover:bg-mint/40 text-forest-900 text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors">
                  {nextStep.secondary}
                </button>
              </div>
              <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-soft">
                <span className="inline-flex items-center gap-1.5"><NotebookPen className="w-3.5 h-3.5" /> {nextStep.eyebrow}</span>
                {plan === 'free' && stats.diaryLimit != null
                  ? <span>Diário básico: {stats.diaryThisMonth}/{stats.diaryLimit} neste mês · check-ins ilimitados</span>
                  : <span>Diário completo disponível no seu plano</span>}
              </div>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-line bg-sand-50 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Seu ritmo recente</p>
              <h2 className="font-serif text-xl text-forest-900 mt-1">{stats.activeDays7} de 7 dias</h2>
            </div>
            <span className="w-10 h-10 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mt-5">
            {lastSeven.map(day => {
              const active = stats.activeDayKeys.includes(day.key)
              return (
                <div key={day.key} className="text-center">
                  <span className="block text-[9px] uppercase text-ink-soft mb-1.5">{day.label}</span>
                  <span aria-label={`${day.key}: ${active ? 'com registro' : 'sem registro'}`} className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold border transition-colors ${active ? 'bg-forest-900 border-forest-900 text-white' : day.isToday ? 'bg-white border-forest-300 text-forest-700' : 'bg-white/70 border-line text-ink-soft'}`}>
                    {day.day}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-ink-soft mt-4 leading-relaxed">Sem sequência obrigatória. Cada retorno conta, inclusive depois de alguns dias longe.</p>
          <div className="mt-4 rounded-2xl bg-white/70 border border-line px-4 py-3 text-xs text-ink-soft">
            Últimos 30 dias: <strong className="font-semibold text-forest-900">{stats.activeDays30} dias</strong> com algum registro.
          </div>
        </aside>
      </div>

      <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-forest-600">Últimos 7 dias</p>
            <h2 className="font-serif text-2xl text-forest-900 mt-1">Uma visão simples antes das análises</h2>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">{weekSummary}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="text-xs bg-mint/60 text-forest-800 rounded-full px-3 py-1.5">{stats.checkins7} check-ins</span>
              <span className="text-xs bg-sand-100 text-forest-800 rounded-full px-3 py-1.5">{stats.reflections7} registros no diário</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:w-48 flex-shrink-0">
            <button onClick={() => onNavigate('my-evolution')} className="inline-flex items-center justify-between gap-2 border border-line bg-white hover:bg-mint/40 text-forest-900 text-sm font-medium px-4 py-3 rounded-2xl transition-colors">
              Ver meu mapa <LineChart className="w-4 h-4" />
            </button>
            <button onClick={() => onNavigate(weeklyAccess ? 'my-report' : 'pricing')} className="inline-flex items-center justify-between gap-2 border border-line bg-white hover:bg-mint/40 text-forest-900 text-sm font-medium px-4 py-3 rounded-2xl transition-colors">
              {weeklyAccess ? 'Ver relatórios' : 'Relatório semanal'}
              {weeklyAccess ? <BarChart3 className="w-4 h-4" /> : <Lock className="w-4 h-4 text-ink-soft" />}
            </button>
          </div>
        </div>
      </section>

      {discovery && (
        <HomeDiscoveryCard
          discovery={discovery}
          onOpenMap={() => onNavigate('my-evolution')}
          onDismiss={dismissDiscovery}
        />
      )}

      <section className="rounded-3xl border border-line bg-mint/25 p-5 sm:p-6">
        <RecommendedContent
          user={user}
          profile={profile}
          source="home-hoje"
          limit={2}
          title="Para o seu momento"
          description="Sugestões escolhidas a partir dos seus registros recentes. Se ainda houver poucos dados, você pode começar pelo check-in de hoje."
          variant="compact"
          showEmpty
          onOpen={(slug) => onNavigate('article', slug)}
          onCheckin={() => onNavigate('diary')}
          onDiary={() => onNavigate('diary')}
          onSeeAll={() => onNavigate('articles')}
        />
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 px-1 mb-3">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-forest-900">Quando quiser olhar com mais distância</h2>
            <p className="text-sm text-ink-soft mt-1">Essas áreas organizam o que você vem registrando — elas não precisam ser usadas todos os dias.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <ActionCard title="Mapa Emocional" description="Veja frequência, variações e padrões dos seus registros." icon={<LineChart className="w-5 h-5" />} onClick={() => onNavigate('my-evolution')} />
          <ActionCard title="Relatórios" description={weeklyAccess ? 'Leia a retrospectiva que organiza sua semana.' : 'A retrospectiva semanal está disponível no Essencial.'} icon={<BarChart3 className="w-5 h-5" />} locked={!weeklyAccess} onClick={() => onNavigate(weeklyAccess ? 'my-report' : 'pricing')} />
          <ActionCard title="Plano de Autocuidado" description={selfCareAccess ? 'Transforme a leitura do mês em pequenos próximos passos.' : 'O plano mensal de autocuidado está disponível no Plus.'} icon={<Sprout className="w-5 h-5" />} locked={!selfCareAccess} onClick={() => onNavigate(selfCareAccess ? 'self-care' : 'pricing')} />
        </div>
      </section>

      <div className="rounded-3xl border border-line bg-sand-50 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 rounded-2xl bg-white border border-line text-forest-700 flex items-center justify-center flex-shrink-0"><BookOpen className="w-5 h-5" /></span>
          <div>
            <p className="text-sm font-medium text-forest-900">A vida talvez não tenha colaborado. Você ainda pode colaborar com você hoje.</p>
            <p className="text-xs text-ink-soft mt-0.5">Sem cobrança, sem ranking e sem precisar “compensar” dias em que você não entrou.</p>
          </div>
        </div>
        {upgrade && (
          <button onClick={() => onNavigate('pricing')} className="inline-flex items-center justify-center gap-2 text-sm font-medium text-forest-800 hover:bg-white border border-line rounded-2xl px-4 py-2.5 transition-colors flex-shrink-0">
            {upgrade.label} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function ActionCard({ title, description, icon, locked = false, onClick }: {
  title: string
  description: string
  icon: React.ReactNode
  locked?: boolean
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="group text-left rounded-2xl border border-line bg-paper-soft p-4 sm:p-5 hover:border-forest-200 hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300">
      <div className="flex items-start justify-between gap-3">
        <span className="w-10 h-10 rounded-2xl bg-mint text-forest-700 flex items-center justify-center">{icon}</span>
        {locked && <Lock className="w-4 h-4 text-ink-soft" />}
      </div>
      <h3 className="font-serif text-lg text-forest-900 mt-4">{title}</h3>
      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">{description}</p>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 mt-3">
        {locked ? 'Conhecer plano' : 'Abrir'} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </button>
  )
}
