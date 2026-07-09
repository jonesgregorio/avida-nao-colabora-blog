import { useState, useEffect } from 'react'
import {
  NotebookPen, LineChart, BookOpen, Sprout, MessageCircle, CreditCard,
  BarChart3, ClipboardList, ArrowRight, Sparkles, CheckCircle2, HeartHandshake, Leaf,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { supabase } from '../lib/supabase'
import { normalizePlan } from '../lib/officialPlans'
import { MoodChip } from './user/ui'
import { MOODS } from './user/moods'

interface LoggedHomeProps {
  user: User | null
  profile: Profile | null
  onNavigate: (section: string) => void
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Atalhos — SOMENTE funções que existem nos planos oficiais.
const QUICK = [
  { title: 'Diário',               desc: 'Escreva, desabafe e registre seus sentimentos.', to: 'diary',                        Icon: NotebookPen },
  { title: 'Questionários',        desc: 'Autopercepção guiada, no seu tempo.',            to: 'questionarios',                Icon: ClipboardList },
  { title: 'Mapa Emocional',       desc: 'Visualize seus padrões e emoções.',              to: 'my-evolution',                 Icon: LineChart },
  { title: 'Conteúdos Guiados',    desc: 'Práticas e leituras para o seu momento.',        to: 'articles',                     Icon: BookOpen },
  { title: 'Relatórios',           desc: 'Veja sua evolução ao longo do tempo.',           to: 'my-report',                    Icon: BarChart3 },
  { title: 'Plano de Autocuidado', desc: 'Ações práticas para cuidar de você.',            to: 'my-evolution?tab=autocuidado', Icon: Sprout },
  { title: 'Orientação',           desc: 'Orientação mensal por mensagem.',                to: 'monthly-guidance',             Icon: MessageCircle },
  { title: 'Meu Plano',            desc: 'Veja seu plano e o que cada um inclui.',         to: 'my-plan',                      Icon: CreditCard },
]

export default function LoggedHome({ user, profile, onNavigate }: LoggedHomeProps) {
  const plan = normalizePlan(profile?.plan)
  const name = profile?.preferred_name || profile?.display_name || profile?.full_name?.split(' ')[0] || 'você'
  const [stats, setStats] = useState({ presence: 0, checkins: 0, reflections: 0, loaded: false })

  useEffect(() => {
    if (!user) return
    let active = true
    ;(async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString()
      const { data } = await supabase.from('diary_entries').select('created_at').eq('user_id', user.id).gte('created_at', since)
      if (!active) return
      const entries = data ?? []
      const days = new Set(entries.map(e => String((e as { created_at?: string }).created_at ?? '').slice(0, 10)))
      setStats({
        presence: Math.min(100, Math.round((days.size / 30) * 100)),
        checkins: days.size,
        reflections: entries.length,
        loaded: true,
      })
    })()
    return () => { active = false }
  }, [user])

  const upgrade =
    plan === 'free'
      ? { text: 'Desbloqueie o Mapa emocional completo, os conteúdos guiados e o relatório semanal.', cta: 'Conhecer o Essencial' }
      : plan === 'essential'
        ? { text: 'Ative o Plano de autocuidado, o Relatório aprofundado e a Orientação profissional.', cta: 'Conhecer o Plus' }
        : null

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 lg:gap-6">
        {/* ─── Coluna principal ─── */}
        <div className="space-y-5 min-w-0">
          {/* Boas-vindas */}
          <div className="grid sm:grid-cols-2 bg-paper-soft border border-line rounded-3xl overflow-hidden">
            <div className="p-6 sm:p-7 flex flex-col justify-center">
              <h1 className="font-serif text-2xl sm:text-3xl text-forest-900 flex items-center gap-2">
                {greeting()}, <span className="capitalize">{name}</span>! <Leaf className="w-5 h-5 text-forest-400" />
              </h1>
              <p className="mt-2 text-sm text-ink-soft leading-relaxed">
                Que bom ter você aqui. Que tal reservar alguns minutos hoje para cuidar de você com gentileza e presença?
              </p>
              <button
                onClick={() => onNavigate('diary')}
                className="mt-5 self-start inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors"
              >
                Começar meu momento <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <div className="hidden sm:block bg-mint min-h-[200px]">
              <img
                src="https://images.unsplash.com/photo-1495197359483-d092478c170a?w=700&q=80"
                alt=""
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          </div>

          {/* Check-in */}
          <section className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6">
            <h2 className="font-serif text-lg sm:text-xl text-forest-900">Como você está se sentindo hoje?</h2>
            <p className="text-sm text-ink-soft mt-1 mb-4">Faça um check-in rápido e registre como está se sentindo agora.</p>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(m => (
                <MoodChip key={m.key} mood={m} active={false} onClick={() => onNavigate(`diary?mood=${m.key}`)} />
              ))}
            </div>
          </section>

          {/* Acesso rápido */}
          <section>
            <h2 className="font-serif text-lg sm:text-xl text-forest-900 mb-3 px-1">Acesso rápido</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {QUICK.map(q => (
                <button
                  key={q.title}
                  onClick={() => onNavigate(q.to)}
                  className="group text-left bg-paper-soft border border-line rounded-2xl p-4 hover:shadow-md hover:border-forest-200 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
                >
                  <span className="w-10 h-10 rounded-full bg-mint flex items-center justify-center text-forest-600 mb-3">
                    <q.Icon className="w-5 h-5" />
                  </span>
                  <p className="font-serif text-base text-forest-900 leading-tight">{q.title}</p>
                  <p className="text-xs text-ink-soft mt-1 leading-snug line-clamp-2">{q.desc}</p>
                  <ArrowRight className="w-4 h-4 text-ink-soft mt-2 group-hover:translate-x-0.5 group-hover:text-forest-700 transition-all" />
                </button>
              ))}
              {/* Novo check-in — destaque */}
              <button
                onClick={() => onNavigate('diary')}
                className="group text-left bg-forest-900 text-white rounded-2xl p-4 hover:bg-forest-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"
              >
                <span className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center mb-3">
                  <NotebookPen className="w-5 h-5" />
                </span>
                <p className="font-serif text-base leading-tight">Novo check-in</p>
                <p className="text-xs text-white/70 mt-1 leading-snug">Como você está agora? Registre e acompanhe.</p>
                <ArrowRight className="w-4 h-4 text-white/80 mt-2 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </section>

          {/* Convite de upgrade */}
          {upgrade && (
            <div className="bg-forest-900 rounded-3xl px-6 py-6 text-white flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </span>
              <p className="flex-1 text-sm leading-relaxed text-forest-50">{upgrade.text}</p>
              <button
                onClick={() => onNavigate('pricing')}
                className="inline-flex items-center gap-2 bg-white text-forest-900 hover:bg-mint text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors whitespace-nowrap"
              >
                {upgrade.cta} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ─── Coluna lateral ─── */}
        <aside className="space-y-5">
          {/* Minha evolução */}
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-forest-900">Minha evolução</h2>
              <button onClick={() => onNavigate('my-report')} className="text-xs text-forest-700 hover:underline flex items-center gap-1">
                Ver relatório <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-4">
              <ProgressRing value={stats.presence} />
              <div className="space-y-2 text-sm">
                <StatLine icon={<CheckCircle2 className="w-4 h-4" />} value={stats.checkins} label="Check-ins" />
                <StatLine icon={<NotebookPen className="w-4 h-4" />} value={stats.reflections} label="Reflexões no diário" />
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-soft bg-mint/50 rounded-xl px-3 py-2.5 leading-relaxed">
              {stats.loaded && stats.checkins > 0
                ? 'Você está evoluindo com consistência e isso já faz toda a diferença. 🌿'
                : 'Um pequeno registro por dia já é um ato de cuidado. Comece quando quiser. 🌿'}
            </p>
          </div>

          {/* Frase */}
          <div className="bg-paper-soft border border-line rounded-3xl p-5">
            <p className="font-serif text-lg text-forest-900 leading-snug">
              "Você não precisa dar conta de tudo hoje. Um passo de cada vez já é progresso."
            </p>
            <p className="text-xs text-ink-soft mt-3">A Vida Não Colabora</p>
          </div>

          {/* Sugestão */}
          <button
            onClick={() => onNavigate('articles')}
            className="group block w-full text-left bg-paper-soft border border-line rounded-3xl overflow-hidden hover:shadow-md hover:border-forest-200 transition-all"
          >
            <div className="aspect-[16/9] bg-mint overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=600&q=80"
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
            <div className="p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-forest-600">Sugestão para você</span>
              <p className="font-serif text-lg text-forest-900 mt-1 leading-snug">Conteúdos que acolhem o seu momento</p>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed">Práticas e leituras curtas para atravessar o dia com mais leveza.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-700">
                Explorar conteúdos <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </button>
        </aside>
      </div>

      {/* Banner acolhedor */}
      <div className="mt-6 rounded-3xl border border-line bg-mint/40 px-5 sm:px-6 py-4 flex items-center gap-4">
        <span className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-forest-600">
          <HeartHandshake className="w-5 h-5" />
        </span>
        <p className="text-sm text-forest-800 leading-relaxed">
          <strong className="font-medium">Você encontra apoio aqui.</strong> Este é um espaço seguro para você se ouvir, se cuidar e seguir no seu tempo.
        </p>
      </div>
    </div>
  )
}

function StatLine({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-forest-500 flex-shrink-0">{icon}</span>
      <span className="font-semibold text-forest-900">{value}</span>
      <span className="text-ink-soft text-xs">{label}</span>
    </div>
  )
}

function ProgressRing({ value }: { value: number }) {
  const r = 34
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(100, Math.max(0, value)) / 100)
  return (
    <div className="relative w-[92px] h-[92px] flex-shrink-0">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#E8F0EB" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke="#1c4a37" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-xl text-forest-900 leading-none">{value}%</span>
        <span className="text-[9px] text-ink-soft mt-0.5">presença</span>
      </div>
    </div>
  )
}
