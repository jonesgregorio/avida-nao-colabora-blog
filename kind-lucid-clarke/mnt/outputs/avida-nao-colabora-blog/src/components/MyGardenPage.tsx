import { useEffect, useMemo, useState } from 'react'
import {
  Bird,
  BookOpen,
  CheckCircle2,
  FileText,
  Flower2,
  LockKeyhole,
  Sparkles,
  Sprout,
  Star,
  TreePine,
  Waves,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'

interface Props {
  userId: string
  profile?: Profile | null
  onNavigatePricing?: () => void
}

type GardenState = {
  stage: number
  active_days: number
  diversity: number
  signals: Record<string, number>
  garden_index: number
  garden_progress: number
  completed_gardens: number
  total_growth: number
  growth_model_version?: number
}

type GardenTheme = {
  name: string
  subtitle: string
  skyA: string
  skyB: string
  mountainA: string
  mountainB: string
  lawnA: string
  lawnB: string
  foliageA: string
  foliageB: string
  flowerA: string
  flowerB: string
  flowerC: string
  waterA: string
  waterB: string
  trunk: string
  glow: string
}

const EMPTY: GardenState = {
  stage: 0,
  active_days: 0,
  diversity: 0,
  signals: {},
  garden_index: 0,
  garden_progress: 0,
  completed_gardens: 0,
  total_growth: 0,
}

const THEMES: GardenTheme[] = [
  {
    name: 'Jardim da Clareira',
    subtitle: 'Um espaço aberto, quente e acolhedor para crescer no seu ritmo.',
    skyA: '#f9e5c1',
    skyB: '#f7f0e5',
    mountainA: '#8f9183',
    mountainB: '#6f786d',
    lawnA: '#698057',
    lawnB: '#3f5f46',
    foliageA: '#254d39',
    foliageB: '#54734c',
    flowerA: '#f4f1e5',
    flowerB: '#c89aa7',
    flowerC: '#d8aa73',
    waterA: '#789b98',
    waterB: '#395f60',
    trunk: '#70503b',
    glow: '#f1c775',
  },
  {
    name: 'Jardim das Primeiras Folhas',
    subtitle: 'Folhagens delicadas começam a ocupar os caminhos.',
    skyA: '#f1dfc7',
    skyB: '#eef2e4',
    mountainA: '#879486',
    mountainB: '#627469',
    lawnA: '#758b61',
    lawnB: '#46654c',
    foliageA: '#31533e',
    foliageB: '#617b54',
    flowerA: '#f2eee0',
    flowerB: '#d4a28e',
    flowerC: '#c5a7bb',
    waterA: '#7ba0a0',
    waterB: '#41666a',
    trunk: '#73523d',
    glow: '#eac882',
  },
  {
    name: 'Jardim da Montanha',
    subtitle: 'A paisagem ganha horizonte, sombra e novas camadas de verde.',
    skyA: '#eadfcb',
    skyB: '#edf0df',
    mountainA: '#7d8981',
    mountainB: '#586b61',
    lawnA: '#6c825b',
    lawnB: '#3c5a43',
    foliageA: '#294a37',
    foliageB: '#5a774f',
    flowerA: '#f4eedf',
    flowerB: '#d1a394',
    flowerC: '#d8bb7e',
    waterA: '#72989a',
    waterB: '#3d6268',
    trunk: '#6f4e39',
    glow: '#ecc47b',
  },
  {
    name: 'Jardim das Flores',
    subtitle: 'Canteiros mais vivos deixam a paisagem mais colorida.',
    skyA: '#f2dec7',
    skyB: '#eff0df',
    mountainA: '#8b8d7e',
    mountainB: '#637066',
    lawnA: '#74885c',
    lawnB: '#476146',
    foliageA: '#2f513a',
    foliageB: '#62794f',
    flowerA: '#f7f0df',
    flowerB: '#cf8f9f',
    flowerC: '#d59d67',
    waterA: '#789b97',
    waterB: '#436467',
    trunk: '#73503a',
    glow: '#f0c16d',
  },
  {
    name: 'Recanto do Entardecer',
    subtitle: 'A luz baixa deixa o jardim mais íntimo e contemplativo.',
    skyA: '#f3d5ae',
    skyB: '#f2e7da',
    mountainA: '#817f78',
    mountainB: '#5a685f',
    lawnA: '#6b7e54',
    lawnB: '#405a40',
    foliageA: '#2c4b35',
    foliageB: '#5a704a',
    flowerA: '#f3ead8',
    flowerB: '#bd8998',
    flowerC: '#d18f61',
    waterA: '#72908f',
    waterB: '#3c5d61',
    trunk: '#694936',
    glow: '#e9ad5e',
  },
  {
    name: 'Jardim do Lago',
    subtitle: 'Água e vegetação formam um novo canto de pausa.',
    skyA: '#eadfc8',
    skyB: '#edf0e2',
    mountainA: '#809087',
    mountainB: '#596c64',
    lawnA: '#6b8560',
    lawnB: '#3e604c',
    foliageA: '#2a503d',
    foliageB: '#5c7855',
    flowerA: '#f5efe1',
    flowerB: '#c79cab',
    flowerC: '#d7ad70',
    waterA: '#6f9ca0',
    waterB: '#385f68',
    trunk: '#6f503c',
    glow: '#e8c77f',
  },
]

const STAGES = [
  { stage: 0, label: 'Semente', Icon: Sprout },
  { stage: 1, label: 'Brotos', Icon: Sprout },
  { stage: 2, label: 'Flores', Icon: Flower2 },
  { stage: 3, label: 'Árvore', Icon: TreePine },
  { stage: 4, label: 'Vida', Icon: Bird },
  { stage: 5, label: 'Recanto', Icon: Waves },
  { stage: 6, label: 'Luz', Icon: Sparkles },
] as const

const ELEMENTS = [
  { stage: 1, name: 'Primeiros brotos', why: 'Alguns momentos de cuidado começaram a deixar uma marca visível.', Icon: Sprout },
  { stage: 2, name: 'Canteiro de flores', why: 'A presença recorrente trouxe mais variedade e cor ao jardim.', Icon: Flower2 },
  { stage: 3, name: 'Árvore de cuidado', why: 'A continuidade criou raízes e um ponto permanente de acolhimento.', Icon: TreePine },
  { stage: 4, name: 'Visitantes', why: 'Com abrigo e flores, pequenas companhias começaram a chegar.', Icon: Bird },
  { stage: 5, name: 'Recanto de água', why: 'O jardim ganhou profundidade e um novo canto de pausa.', Icon: Waves },
  { stage: 6, name: 'Luz do jardim', why: 'O espaço amadureceu e ganhou uma atmosfera própria.', Icon: Sparkles },
] as const

const CONTRIBUTIONS = [
  { label: 'Check-in', hint: 'presença no dia', Icon: CheckCircle2 },
  { label: 'Diário', hint: 'dias de registro', Icon: BookOpen },
  { label: 'Relatórios', hint: 'retrospectivas', Icon: FileText },
  { label: 'Plano de Autocuidado', hint: 'ações e ciclos', Icon: Sprout },
  { label: 'Conteúdos', hint: 'leituras concluídas', Icon: BookOpen },
  { label: 'Marcos', hint: 'momentos importantes', Icon: Star },
] as const

function themeFor(index: number) {
  return THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length]
}

function memoryIndexes(completed: number) {
  const first = Math.max(0, completed - 3)
  return Array.from({ length: completed - first }, (_, i) => first + i)
}

export default function MyGardenPage({ userId, profile, onNavigatePricing }: Props) {
  const access = hasPlanAccess(getEffectivePlan(profile), 'essential')
  const [state, setState] = useState<GardenState>(EMPTY)
  const [selectedStage, setSelectedStage] = useState<number | null>(null)

  useEffect(() => {
    if (!access) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.rpc('get_my_garden_state')
      if (alive && data) setState(data as GardenState)
    })().catch(() => {})
    return () => {
      alive = false
    }
  }, [userId, access])

  if (!access) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center">
          <LockKeyhole className="mx-auto h-9 w-9 text-forest-500" />
          <h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1>
          <p className="mt-3 text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>
          {onNavigatePricing && (
            <button onClick={onNavigatePricing} className="mt-6 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm text-white">
              Ver planos
            </button>
          )}
        </section>
      </div>
    )
  }

  const stage = Math.max(0, Math.min(6, state.stage || 0))
  const gardenIndex = Math.max(0, state.garden_index || 0)
  const theme = themeFor(gardenIndex)
  const memories = memoryIndexes(Math.max(0, state.completed_gardens || 0))
  const nextElement = ELEMENTS.find((item) => item.stage > stage)
  const currentElement = selectedStage
    ? ELEMENTS.find((item) => item.stage === selectedStage)
    : [...ELEMENTS].reverse().find((item) => item.stage <= stage)
  const visualProgress = useMemo(() => Math.min(100, Math.max(3, ((state.garden_progress || 0) / 60) * 100)), [state.garden_progress])

  return (
    <main className="min-h-full bg-[#f7f0e5] text-[#183a2d]">
      <style>{`
        @keyframes garden-bird-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes garden-butterfly { 0%,100% { transform: translate(0,0) rotate(-5deg) } 45% { transform: translate(28px,-12px) rotate(5deg) } 75% { transform: translate(44px,4px) rotate(-2deg) } }
        @keyframes garden-leaf { 0%,100% { transform: rotate(-0.4deg) } 50% { transform: rotate(0.7deg) } }
        @keyframes garden-glow { 0%,100% { opacity: .45 } 50% { opacity: 1 } }
        .garden-birds { animation: garden-bird-float 5.5s ease-in-out infinite; }
        .garden-butterfly { animation: garden-butterfly 8s ease-in-out infinite; }
        .garden-tree { transform-origin: 41% 82%; animation: garden-leaf 7s ease-in-out infinite; }
        .garden-glow { animation: garden-glow 3.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .garden-birds,.garden-butterfly,.garden-tree,.garden-glow { animation: none !important; }
        }
      `}</style>

      <section className="relative overflow-hidden border-b border-[#dfd4c3] bg-[#f8f1e7]">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 14% 24%, ${theme.glow}55 0, transparent 26%), radial-gradient(circle at 80% 16%, white 0, transparent 30%)` }} />
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 pb-8 pt-9 sm:px-8 lg:grid-cols-[1fr_360px] lg:items-start lg:pb-10">
          <div className="relative z-10 max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[.28em] text-[#446954]">Meu Jardim</p>
            <h1 className="mt-3 max-w-[680px] font-serif text-5xl leading-[.98] tracking-[-.025em] text-[#17372b] sm:text-6xl lg:text-[72px]">
              Um espaço<br />que cresce com você
            </h1>
            <p className="mt-5 max-w-[560px] text-[15px] leading-7 text-[#5d685f] sm:text-base">
              Cada pequeno cuidado importa. Aqui, suas ações se transformam em vida, beleza e presença. Sua trajetória ganha forma aos poucos, sem pressa e sem perder o que já foi construído.
            </p>
            <p className="mt-6 max-w-xl font-serif text-xl italic text-[#355a47]">Cuidar de si também é construir um lugar melhor para ficar.</p>
          </div>

          <aside className="relative z-10 rounded-[28px] border border-white/80 bg-[#fffaf2]/82 p-7 shadow-[0_22px_55px_rgba(54,61,43,.12)] backdrop-blur-md">
            <div className="font-serif text-5xl leading-none text-[#466b50]">“</div>
            <p className="mt-1 text-center font-serif text-[22px] leading-8 text-[#284838]">Todo progresso, por menor que pareça, também floresce.</p>
            <Sprout className="ml-auto mt-4 h-6 w-6 text-[#315b43]" />
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 py-7 sm:px-8">
        <section className="relative overflow-hidden rounded-[36px] border border-[#d6cbbb] bg-[#dfe4d7] shadow-[0_28px_80px_rgba(47,65,48,.18)]" aria-label={`Jardim atual: ${theme.name}`}>
          <GardenScene stage={stage} theme={theme} variant={gardenIndex % 4} />

          <div className="absolute left-5 top-5 z-30 max-w-[300px] rounded-[24px] border border-white/80 bg-[#fffaf3]/92 px-5 py-4 shadow-[0_16px_35px_rgba(35,50,37,.12)] backdrop-blur-md sm:left-7 sm:top-7">
            <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-[#52705d]">Jardim atual</p>
            <p className="mt-1 font-serif text-2xl text-[#183a2d]">{theme.name}</p>
            <p className="mt-1 text-xs leading-5 text-[#687168]">{theme.subtitle}</p>
            {stage === 0 && <p className="mt-2 text-xs font-semibold text-[#355c45]">O jardim está só começando.</p>}
          </div>

          <div className="relative z-30 mx-4 mb-4 mt-[420px] rounded-[30px] border border-white/80 bg-[#fffaf4]/94 p-5 shadow-[0_20px_60px_rgba(35,50,37,.16)] backdrop-blur-md sm:mx-auto sm:mb-7 sm:mt-[460px] sm:max-w-[720px] sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e9eadf] text-[#315b43]"><Sprout className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-serif text-2xl text-[#204333]">{theme.name}</h2>
                    <p className="text-xs text-[#667067]">Em evolução</p>
                  </div>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] uppercase tracking-[.2em] text-[#899486]">Etapa visual</p>
                <p className="mt-1 font-serif text-lg text-[#315b43]">{stage} de 6</p>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e9e4d8]" aria-label="Progresso visual do jardim">
              <div className="h-full rounded-full bg-gradient-to-r from-[#315b43] via-[#527651] to-[#82966b] transition-[width] duration-700" style={{ width: `${visualProgress}%` }} />
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-7">
              {STAGES.map(({ stage: itemStage, label, Icon }) => {
                const reached = stage >= itemStage
                const active = stage === itemStage
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => itemStage > 0 && reached && setSelectedStage(itemStage)}
                    disabled={!reached || itemStage === 0}
                    className={`group flex flex-col items-center gap-1.5 rounded-2xl px-2 py-2 text-center transition ${active ? 'bg-[#315b43] text-white shadow-sm' : reached ? 'bg-[#f2eee5] text-[#47624f] hover:bg-[#e8e6db]' : 'text-[#a2aa9f]'}`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-white/12' : reached ? 'bg-white' : 'bg-[#efece4]'}`}><Icon className="h-4 w-4" /></span>
                    <span className="text-[10px] font-medium">{label}</span>
                  </button>
                )
              })}
            </div>

            <p className="mt-5 text-center font-serif text-[16px] italic text-[#526356]">
              {stage === 0 ? 'Seu espaço ainda está em preparação — e tudo bem começar devagar.' : currentElement?.why || 'Seu jardim continua ganhando forma.'}
            </p>
          </div>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-[30px] border border-[#ded4c4] bg-[#fffaf3] p-6 shadow-[0_15px_38px_rgba(52,66,50,.08)]">
            <h2 className="font-serif text-[26px] text-[#234333]">Ações que fazem seu jardim crescer</h2>
            <p className="mt-1 text-sm text-[#70776f]">Diferentes áreas do AVNC contribuem para o jardim. Nenhuma ação simples, sozinha, completa uma transformação.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {CONTRIBUTIONS.map(({ label, hint, Icon }) => (
                <div key={label} className="rounded-[20px] border border-[#e7dfd1] bg-[#fbf8f1] p-3 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#e8eadf] text-[#315b43]"><Icon className="h-5 w-5" /></span>
                  <p className="mt-2 text-[11px] font-semibold leading-4 text-[#315040]">{label}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#858c83]">{hint}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[30px] border border-[#375d43] bg-[#2f5a3d] p-6 text-[#fffaf2] shadow-[0_18px_45px_rgba(42,72,49,.18)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-white/5" />
            <div className="relative flex gap-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/30 bg-[#426b4d] shadow-inner">
                {nextElement ? <nextElement.Icon className="h-10 w-10 text-[#f1e5bd]" /> : <Sparkles className="h-10 w-10 text-[#f1e5bd]" />}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] text-[#cdd9c7]">{nextElement ? 'Próximo elemento' : 'Jardim maduro'}</p>
                <h2 className="mt-2 font-serif text-3xl">{nextElement?.name || 'Um novo jardim virá depois'}</h2>
                <p className="mt-3 text-sm leading-6 text-[#dce6da]">
                  {nextElement ? 'Ele aparecerá quando novos momentos de cuidado se somarem à sua trajetória.' : 'Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente.'}
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-7 border-t border-[#ded4c5] pt-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl border border-[#d7d0c3] bg-[#fffaf3]"><TreePine className="h-4 w-4 text-[#315b43]" /></span><h2 className="font-serif text-2xl text-[#234333]">Memórias do Jardim</h2></div>
              <p className="mt-2 text-sm text-[#727a72]">Cada jardim concluído fica salvo aqui, como parte da sua história. Não existe último jardim por aqui.</p>
            </div>
            {memories.length > 0 && <span className="text-xs font-semibold text-[#315b43]">{state.completed_gardens} {state.completed_gardens === 1 ? 'jardim preservado' : 'jardins preservados'}</span>}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {memories.map((index) => <GardenMemoryCard key={index} index={index} />)}
            <div className="min-h-[185px] rounded-[24px] border border-[#dcd3c5] bg-[#f1eadf] p-5 text-center">
              <div className="mx-auto mt-4 grid h-12 w-12 place-items-center rounded-full bg-[#e1e5da] text-[#315b43]"><Sprout className="h-5 w-5" /></div>
              <p className="mt-4 font-serif text-lg text-[#315040]">Novo jardim em andamento…</p>
              <p className="mt-1 text-xs text-[#858b84]">Mais histórias para viver.</p>
            </div>
          </div>
        </section>

        <section className="mt-7 rounded-[28px] border border-[#e0d6c7] bg-[#fbf7ef] px-6 py-5 text-sm leading-6 text-[#69736b]">
          O jardim não funciona como uma recompensa por cliques. Ele observa momentos de cuidado ao longo do tempo. Um Check-in isolado não muda tudo; pequenas mudanças aparecem com alguma continuidade, e completar um jardim exige uma trajetória mais consistente. O jardim jamais termina.
        </section>
      </div>
    </main>
  )
}

function GardenScene({ stage, theme, variant }: { stage: number; theme: GardenTheme; variant: number }) {
  const treeLeft = variant % 2 === 0
  const treeX = treeLeft ? 330 : 690
  const lakeX = treeLeft ? 760 : 245
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1100 690" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Paisagem do Meu Jardim">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={theme.skyA} /><stop offset="1" stopColor={theme.skyB} /></linearGradient>
        <linearGradient id="lawn" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={theme.lawnA} /><stop offset="1" stopColor={theme.lawnB} /></linearGradient>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={theme.waterA} /><stop offset="1" stopColor={theme.waterB} /></linearGradient>
        <radialGradient id="sun"><stop offset="0" stopColor={theme.glow} stopOpacity=".95" /><stop offset="1" stopColor={theme.glow} stopOpacity="0" /></radialGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="18" /></filter>
      </defs>

      <rect width="1100" height="690" fill="url(#sky)" />
      <circle cx="150" cy="130" r="145" fill="url(#sun)" opacity=".74" filter="url(#soft)" />
      <path d="M0 334 C120 246 210 285 320 225 C440 158 548 282 664 210 C792 130 910 200 1100 142 V430 H0Z" fill={theme.mountainA} opacity=".72" />
      <path d="M0 390 C155 285 315 362 440 290 C570 215 690 340 815 270 C930 207 1000 242 1100 221 V470 H0Z" fill={theme.mountainB} opacity=".88" />
      <path d="M0 415 C140 370 260 430 390 382 C520 334 680 399 810 347 C925 301 1010 334 1100 321 V690 H0Z" fill="url(#lawn)" />

      <path d="M500 690 C520 635 545 590 582 548 C615 511 647 488 686 466" fill="none" stroke="#d8c7a7" strokeWidth="74" strokeLinecap="round" opacity=".9" />
      <path d="M500 690 C520 635 545 590 582 548 C615 511 647 488 686 466" fill="none" stroke="#eadfc8" strokeWidth="47" strokeLinecap="round" strokeDasharray="20 17" opacity=".95" />

      <g opacity=".96">
        <path d="M0 497 C55 442 111 453 163 480 C99 484 60 515 0 548Z" fill={theme.foliageA} />
        <path d="M1100 481 C1040 438 983 446 933 480 C996 484 1041 520 1100 546Z" fill={theme.foliageA} />
        <g fill={theme.foliageB} opacity=".88">
          {[70,105,142,955,995,1035].map((x, i) => <ellipse key={x} cx={x} cy={476 + (i % 2) * 7} rx="25" ry="69" />)}
        </g>
      </g>

      {stage >= 1 && (
        <g>
          {[160,205,252,807,850,900].map((x, i) => (
            <g key={x} transform={`translate(${x} ${548 + (i % 2) * 11})`}>
              <path d="M0 32 Q-6 14 -13 1 M0 32 Q7 13 16 2" fill="none" stroke="#365d43" strokeWidth="4" strokeLinecap="round" />
              <ellipse cx="-13" cy="3" rx="8" ry="4" fill="#6f915e" transform="rotate(-24 -13 3)" />
              <ellipse cx="16" cy="4" rx="8" ry="4" fill="#819d68" transform="rotate(25 16 4)" />
            </g>
          ))}
        </g>
      )}

      {stage >= 2 && (
        <g>
          <path d="M66 613 C141 562 243 560 319 608 C238 646 140 646 66 613Z" fill="#365d43" opacity=".55" />
          {[105,140,173,209,245,277].map((x, i) => <Flower key={x} x={x} y={580 + (i % 3) * 13} color={[theme.flowerA, theme.flowerB, theme.flowerC][i % 3]} />)}
          {[818,852,888,925,960].map((x, i) => <Flower key={x} x={x} y={560 + (i % 2) * 17} color={[theme.flowerC, theme.flowerA, theme.flowerB][i % 3]} />)}
        </g>
      )}

      {stage >= 3 && (
        <g className="garden-tree">
          <ellipse cx={treeX} cy="590" rx="132" ry="24" fill="#183c2b" opacity=".18" />
          <path d={`M${treeX - 23} 586 C${treeX - 9} 516 ${treeX - 15} 448 ${treeX - 2} 372 C${treeX + 4} 334 ${treeX + 15} 296 ${treeX + 21} 261 C${treeX + 14} 331 ${treeX + 20} 392 ${treeX + 38} 459 C${treeX + 49} 505 ${treeX + 42} 552 ${treeX + 36} 586Z`} fill={theme.trunk} />
          <path d={`M${treeX + 2} 404 C${treeX - 60} 351 ${treeX - 92} 316 ${treeX - 126} 276 M${treeX + 10} 358 C${treeX + 66} 319 ${treeX + 92} 286 ${treeX + 122} 251 M${treeX + 18} 321 C${treeX - 19} 279 ${treeX - 28} 242 ${treeX - 36} 203`} fill="none" stroke={theme.trunk} strokeWidth="15" strokeLinecap="round" />
          <g fill={theme.foliageA}>
            <circle cx={treeX - 88} cy="268" r="78" /><circle cx={treeX - 25} cy="222" r="91" /><circle cx={treeX + 67} cy="255" r="89" /><circle cx={treeX + 16} cy="303" r="98" />
          </g>
          <g fill={theme.foliageB} opacity=".86">
            <circle cx={treeX - 71} cy="242" r="47" /><circle cx={treeX + 3} cy="196" r="52" /><circle cx={treeX + 75} cy="238" r="50" /><circle cx={treeX + 32} cy="285" r="48" />
          </g>
        </g>
      )}

      {stage >= 4 && (
        <g>
          <g className="garden-birds" fill="#223e3a" stroke="#f5ede0" strokeWidth="3">
            <path d="M745 196 q23 -25 43 0 q-18 -9 -22 9 q-5 -17 -21 -9Z" />
            <path d="M807 165 q21 -22 40 0 q-17 -8 -21 8 q-5 -15 -19 -8Z" />
          </g>
          <g className="garden-butterfly" transform="translate(250 468)">
            <ellipse cx="-8" cy="0" rx="12" ry="19" fill={theme.flowerB} transform="rotate(-25)" />
            <ellipse cx="8" cy="0" rx="12" ry="19" fill={theme.flowerC} transform="rotate(25)" />
            <rect x="-2" y="-10" width="4" height="23" rx="2" fill="#31483d" />
          </g>
        </g>
      )}

      {stage >= 5 && (
        <g>
          <ellipse cx={lakeX} cy="595" rx="185" ry="82" fill="#244d46" opacity=".18" />
          <ellipse cx={lakeX} cy="584" rx="177" ry="71" fill="url(#water)" />
          <ellipse cx={lakeX - 18} cy="565" rx="132" ry="35" fill="#b9d0c4" opacity=".17" />
          {[lakeX - 91, lakeX - 23, lakeX + 46, lakeX + 99].map((x, i) => <g key={x}><ellipse cx={x} cy={589 + (i % 2) * 16} rx="27" ry="10" fill="#557b58" /><circle cx={x + 3} cy={582 + (i % 2) * 16} r="7" fill={i % 2 ? theme.flowerB : theme.flowerA} /></g>)}
          <path d={`M${lakeX - 165} 523 Q${lakeX - 143} 489 ${lakeX - 126} 524 M${lakeX + 145} 523 Q${lakeX + 132} 485 ${lakeX + 119} 526`} stroke="#42684b" strokeWidth="7" fill="none" strokeLinecap="round" />
          <g transform={`translate(${treeLeft ? 470 : 545} 526)`}>
            <ellipse cx="0" cy="56" rx="76" ry="13" fill="#243e30" opacity=".22" />
            <rect x="-61" y="20" width="122" height="18" rx="5" fill="#78563f" />
            <rect x="-53" y="38" width="11" height="55" rx="3" fill="#684935" /><rect x="42" y="38" width="11" height="55" rx="3" fill="#684935" />
            <rect x="-67" y="-2" width="12" height="47" rx="3" fill="#684935" /><rect x="55" y="-2" width="12" height="47" rx="3" fill="#684935" />
            <rect x="-55" y="2" width="110" height="12" rx="4" fill="#8b674c" />
          </g>
        </g>
      )}

      {stage >= 6 && (
        <g>
          <circle cx="194" cy="474" r="84" fill="url(#sun)" opacity=".48" />
          {[188,286,690,868,940].map((x, i) => <circle key={x} className="garden-glow" cx={x} cy={455 + (i % 3) * 42} r="5" fill={theme.glow} />)}
          <g transform={`translate(${treeLeft ? 470 : 620} 471)`}>
            <path d="M0 0 V70" stroke="#5d4935" strokeWidth="6" /><rect x="-13" y="15" width="26" height="36" rx="5" fill="#423e32" /><rect x="-8" y="20" width="16" height="24" rx="3" fill={theme.glow} opacity=".92" />
          </g>
        </g>
      )}

      {stage === 0 && (
        <g transform="translate(530 548)">
          <ellipse cx="0" cy="28" rx="60" ry="19" fill="#365a43" opacity=".22" />
          <path d="M0 30 Q-3 15 2 0" stroke="#466d4e" strokeWidth="4" fill="none" strokeLinecap="round" />
          <ellipse cx="-5" cy="6" rx="9" ry="5" fill="#78956d" transform="rotate(-24 -5 6)" />
        </g>
      )}
    </svg>
  )
}

function Flower({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 31 V10" stroke="#345b40" strokeWidth="3" strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="0" cy="3" rx="5" ry="10" fill={color} transform={`rotate(${r}) translate(0 -7)`} />)}
      <circle cx="0" cy="0" r="4" fill="#d7ae62" />
    </g>
  )
}

function GardenMemoryCard({ index }: { index: number }) {
  const theme = themeFor(index)
  return (
    <article className="overflow-hidden rounded-[24px] border border-[#ddd4c6] bg-[#fffaf3] shadow-[0_10px_24px_rgba(48,62,47,.08)]">
      <div className="relative h-[112px] overflow-hidden" style={{ background: `linear-gradient(180deg, ${theme.skyA}, ${theme.skyB})` }}>
        <div className="absolute bottom-0 h-[58%] w-full" style={{ background: `linear-gradient(165deg, ${theme.mountainA} 0 48%, ${theme.lawnA} 49% 100%)` }} />
        <div className="absolute bottom-3 left-7 h-14 w-14 rounded-full" style={{ background: theme.foliageA }} />
        <div className="absolute bottom-1 right-4 h-9 w-24 rounded-[50%]" style={{ background: theme.waterA }} />
        <div className="absolute bottom-4 left-20 h-2 w-2 rounded-full" style={{ background: theme.flowerB }} />
        <div className="absolute bottom-6 left-24 h-2 w-2 rounded-full" style={{ background: theme.flowerC }} />
      </div>
      <div className="p-4">
        <p className="font-serif text-[17px] text-[#294939]">{theme.name}</p>
        <p className="mt-1 text-[11px] text-[#858b84]">Jardim preservado</p>
      </div>
    </article>
  )
}
