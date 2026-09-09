import { useEffect, useState } from 'react'
import { Bird, BookOpen, CheckCircle2, Flower2, Heart, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'

interface Props { userId: string; profile?: Profile | null; onNavigatePricing?: () => void }
type GardenState = {
  stage: number
  active_days: number
  diversity: number
  signals: Record<string, number>
  garden_index: number
  garden_progress: number
  completed_gardens: number
  total_growth: number
}
type GardenTheme = {
  name: string
  subtitle: string
  skyTop: string
  skyBottom: string
  hillBack: string
  hillFront: string
  flowerA: string
  flowerB: string
  water: string
  trunk: string
  canopy: string
  canopyLight: string
  glow: string
}

const EMPTY: GardenState = { stage: 0, active_days: 0, diversity: 0, signals: {}, garden_index: 0, garden_progress: 0, completed_gardens: 0, total_growth: 0 }
const THEMES: GardenTheme[] = [
  { name: 'Clareira Serena', subtitle: 'Um espaço aberto, claro e leve para recomeçar.', skyTop: '#dce9e7', skyBottom: '#f5f0df', hillBack: '#a9bea0', hillFront: '#78966a', flowerA: '#d8a894', flowerB: '#f1d6a8', water: '#72a2a1', trunk: '#76543d', canopy: '#496b4c', canopyLight: '#67845d', glow: '#f0d596' },
  { name: 'Jardim do Lago', subtitle: 'Água, folhas e caminhos ganham mais presença.', skyTop: '#d4e5e4', skyBottom: '#eff0da', hillBack: '#9fb9a4', hillFront: '#738e6c', flowerA: '#d5b694', flowerB: '#e9cdb8', water: '#67979e', trunk: '#6e503d', canopy: '#52704f', canopyLight: '#708c65', glow: '#ecd59e' },
  { name: 'Bosque de Luz', subtitle: 'Sombras suaves e pontos de luz criam um novo ritmo.', skyTop: '#e5e7d3', skyBottom: '#f2ead6', hillBack: '#98ad8b', hillFront: '#66805f', flowerA: '#c8a6af', flowerB: '#e2c9aa', water: '#7da3a0', trunk: '#6d503a', canopy: '#405f43', canopyLight: '#637c55', glow: '#f3d27b' },
  { name: 'Jardim Silvestre', subtitle: 'Flores menos simétricas deixam o espaço mais espontâneo.', skyTop: '#dfe9df', skyBottom: '#f0edda', hillBack: '#a4b796', hillFront: '#7a9566', flowerA: '#cc9f96', flowerB: '#e9d39d', water: '#78a09c', trunk: '#755640', canopy: '#58724e', canopyLight: '#758e63', glow: '#efd397' },
  { name: 'Recanto do Entardecer', subtitle: 'A paisagem fica mais quente e acolhedora.', skyTop: '#eadfcf', skyBottom: '#f5e9d4', hillBack: '#a8ae88', hillFront: '#72835d', flowerA: '#c98e73', flowerB: '#ddb99b', water: '#75979b', trunk: '#6f503d', canopy: '#4d6748', canopyLight: '#70805a', glow: '#f1bd73' },
  { name: 'Jardim das Folhas', subtitle: 'Texturas verdes e pequenos caminhos ocupam o cenário.', skyTop: '#dfe8da', skyBottom: '#f1eedc', hillBack: '#9eb195', hillFront: '#6f8b62', flowerA: '#d1ac88', flowerB: '#e7caa5', water: '#6f9895', trunk: '#6d513d', canopy: '#466348', canopyLight: '#657f56', glow: '#ebd18b' },
  { name: 'Jardim de Brisa', subtitle: 'Um novo espaço com mais respiro entre árvores e canteiros.', skyTop: '#d7e7e6', skyBottom: '#eff2df', hillBack: '#a9bca1', hillFront: '#7f9b70', flowerA: '#c9a3ae', flowerB: '#e8ceb4', water: '#72a19f', trunk: '#785941', canopy: '#557250', canopyLight: '#748d67', glow: '#efd89a' },
  { name: 'Jardim de Luz Baixa', subtitle: 'Luz suave, água e vegetação formam um canto mais íntimo.', skyTop: '#deddd5', skyBottom: '#eee7d8', hillBack: '#8ea18a', hillFront: '#61765e', flowerA: '#c79b89', flowerB: '#dbc2a1', water: '#688f92', trunk: '#684b39', canopy: '#3d5a43', canopyLight: '#597052', glow: '#e6b969' },
]
const ELEMENTS = [
  { stage: 1, name: 'Primeiros brotos', why: 'Alguns momentos de cuidado já começaram a deixar uma marca visível.', Icon: Sprout },
  { stage: 2, name: 'Canteiro de flores', why: 'Sua presença voltou a aparecer e trouxe mais cor ao jardim.', Icon: Flower2 },
  { stage: 3, name: 'Árvore de cuidado', why: 'A continuidade criou raízes e um ponto permanente de acolhimento.', Icon: TreePine },
  { stage: 4, name: 'Visitantes', why: 'Com abrigo e flores, pequenas companhias começaram a chegar.', Icon: Bird },
  { stage: 5, name: 'Recanto de água', why: 'Diferentes formas de cuidado abriram espaço para um novo canto de pausa.', Icon: Waves },
  { stage: 6, name: 'Luz do jardim', why: 'O jardim amadureceu e ganhou uma camada de luz própria.', Icon: Sparkles },
] as const

function themeFor(index: number) { return THEMES[((index % THEMES.length) + THEMES.length) % THEMES.length] }
function memoryIndexes(completed: number) { const first = Math.max(0, completed - 6); return Array.from({ length: completed - first }, (_, i) => first + i) }

export default function MyGardenPage({ userId, profile, onNavigatePricing }: Props) {
  const access = hasPlanAccess(getEffectivePlan(profile), 'essential')
  const [state, setState] = useState<GardenState>(EMPTY)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    if (!access) return
    let alive = true
    ;(async () => {
      const { data } = await supabase.rpc('get_my_garden_state')
      if (alive && data) setState(data as GardenState)
    })().catch(() => {})
    return () => { alive = false }
  }, [userId, access])

  if (!access) return <div className="mx-auto max-w-4xl px-4 py-10"><section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-forest-500"/><h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1><p className="mt-3 text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>{onNavigatePricing&&<button onClick={onNavigatePricing} className="mt-6 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm text-white">Ver planos</button>}</section></div>

  const stage = Math.max(0, Math.min(6, state.stage || 0))
  const gardenIndex = Math.max(0, state.garden_index || 0)
  const theme = themeFor(gardenIndex)
  const variant = gardenIndex % 6
  const mirror = gardenIndex % 2 === 1
  const unlocked = ELEMENTS.filter(e => stage >= e.stage)
  const detail = selected ? ELEMENTS.find(e => e.stage === selected) : unlocked[unlocked.length - 1]
  const memories = memoryIndexes(Math.max(0, state.completed_gardens || 0))

  return <main className="min-h-full bg-[#faf6ee] px-4 py-7 text-forest-950 sm:px-6">
    <style>{`@keyframes garden-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}@keyframes garden-fly{0%,100%{transform:translate(0,0) rotate(-4deg)}40%{transform:translate(28px,-12px) rotate(3deg)}70%{transform:translate(54px,4px) rotate(-2deg)}}@keyframes garden-glow{0%,100%{opacity:.5}50%{opacity:.9}}@keyframes garden-sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.8deg)}}.garden-bird{animation:garden-bob 4.8s ease-in-out infinite}.garden-butterfly{animation:garden-fly 8s ease-in-out infinite}.garden-glow{animation:garden-glow 4.5s ease-in-out infinite}.garden-tree-crown{transform-origin:50% 90%;animation:garden-sway 7s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.garden-bird,.garden-butterfly,.garden-glow,.garden-tree-crown{animation:none!important}}`}</style>
    <div className="mx-auto max-w-[1180px]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Seu espaço vivo</p><h1 className="font-serif text-4xl sm:text-5xl">Meu Jardim</h1><p className="mt-2 text-sm text-ink-soft">Pequenos cuidados deixam marcas. Jardins completos viram memórias e um novo sempre começa.</p></div><p className="max-w-sm font-serif italic text-forest-700">“Não existe último jardim por aqui.”</p></header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_270px]">
        <section className="overflow-hidden rounded-[34px] border border-[#d9d0c0] bg-white shadow-[0_28px_70px_rgba(54,75,58,.16)]" aria-label={`Jardim atual: ${theme.name}`}>
          <div className="relative min-h-[560px] sm:min-h-[610px]">
            <GardenScene stage={stage} theme={theme} mirror={mirror} variant={variant}/>
            <div className="absolute left-4 top-4 z-30 max-w-[280px] rounded-[22px] border border-white/70 bg-white/82 px-5 py-4 shadow-lg backdrop-blur-md sm:left-6 sm:top-6"><p className="text-[10px] uppercase tracking-[.18em] text-forest-600">Jardim atual</p><p className="mt-1 font-serif text-xl">{theme.name}</p><p className="mt-1 text-xs leading-5 text-ink-soft">{theme.subtitle}</p>{gardenIndex>0&&stage===0&&<p className="mt-2 text-[11px] font-semibold text-forest-700">Um novo jardim acabou de começar.</p>}</div>
            {stage===0&&<div className="absolute inset-x-4 bottom-5 z-30 mx-auto max-w-md rounded-[26px] border border-white/70 bg-white/88 p-5 text-center shadow-xl backdrop-blur-md sm:bottom-7"><Sprout className="mx-auto h-8 w-8 text-forest-700"/><p className="mt-2 font-serif text-xl">{gardenIndex>0?'Um novo espaço está criando raízes':'Seu jardim está preparando o solo'}</p><p className="mt-2 text-sm leading-6 text-ink-soft">Uma ação isolada não muda tudo. Mas bastam alguns momentos de cuidado para as primeiras diferenças começarem a aparecer.</p></div>}
          </div>
        </section>

        <aside className="space-y-4"><section className="rounded-[26px] border border-line bg-white p-5"><h2 className="font-serif text-xl">Sua jornada</h2><Stat Icon={Heart} value={state.active_days} label="dias de cuidado"/><Stat Icon={Sparkles} value={state.diversity} label="formas de cuidado"/><Stat Icon={Sprout} value={unlocked.length} label="mudanças neste jardim"/>{state.completed_gardens>0&&<Stat Icon={TreePine} value={state.completed_gardens} label={state.completed_gardens===1?'jardim preservado':'jardins preservados'}/>}</section><section className="rounded-[26px] border border-[#e6dcc8] bg-[#fff8e9] p-5"><Sprout className="h-5 w-5"/><p className="mt-3 font-medium">Mudanças mais próximas.</p><p className="mt-2 text-xs leading-5 text-ink-soft">O jardim responde a pequenos conjuntos de cuidado, geralmente depois de poucas interações significativas. Não há streak, punição nem obrigação de usar todos os recursos.</p></section></aside>
      </div>

      <section className="mt-6 rounded-[30px] border border-line bg-white p-5 sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-widest text-forest-600">Crescimento contínuo</p><h2 className="font-serif text-2xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com paisagem, atmosfera e composição diferentes.</p></div><div className="mt-5 flex flex-wrap gap-2">{unlocked.map(e=><button key={e.stage} onClick={()=>setSelected(e.stage)} className="rounded-full border border-line bg-paper-soft px-3 py-2 text-xs text-forest-800 transition hover:border-forest-300">{e.name}</button>)}{stage<6&&<span className="rounded-full border border-dashed border-forest-200 px-3 py-2 text-xs text-ink-soft">A próxima transformação está se formando</span>}</div></section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">O que ganhou vida</p>{detail?<><div className="mt-4 flex gap-4"><div className="rounded-2xl bg-[#eef4ea] p-4"><detail.Icon className="h-8 w-8"/></div><div><h3 className="font-serif text-xl">{detail.name}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{detail.why}</p></div></div></>:<p className="mt-4 text-sm text-ink-soft">As primeiras mudanças aparecem depois de alguns momentos de cuidado — sem exigir uma longa sequência.</p>}</section><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">Como ele entende sua jornada</p><h3 className="mt-2 font-serif text-xl">Cuidado, não desempenho</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Check-ins, Diário, questionários, conteúdos, Plano de Autocuidado, marcos e relatórios podem contribuir. Um Check-in isolado não cria sozinho um novo elemento, mas poucos momentos significativos já podem produzir uma pequena mudança.</p><div className="mt-5 grid grid-cols-2 gap-3"><Mini Icon={CheckCircle2} label="Sem streak"/><Mini Icon={Heart} label="Sem punição"/><Mini Icon={BookOpen} label="Diversidade ajuda"/><Mini Icon={Sparkles} label="Sem placar"/></div></section></div>

      {memories.length>0&&<section className="mt-5 rounded-[30px] border border-line bg-white p-5 sm:p-7"><p className="text-xs uppercase tracking-widest text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-2xl">Espaços que já amadureceram</h2><p className="mt-1 text-sm text-ink-soft">Eles não desaparecem quando um novo jardim começa.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{memories.map(index=>{const t=themeFor(index);return <article key={index} className="overflow-hidden rounded-2xl border border-line bg-[#faf8f3]"><div className="relative h-28 overflow-hidden"><svg viewBox="0 0 220 112" className="h-full w-full" aria-hidden="true"><defs><linearGradient id={`m-sky-${index}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={t.skyTop}/><stop offset="1" stopColor={t.skyBottom}/></linearGradient></defs><rect width="220" height="112" fill={`url(#m-sky-${index})`}/><path d="M0 65 Q55 34 112 62 T220 52 V112 H0Z" fill={t.hillBack}/><path d="M0 77 Q62 58 125 76 T220 70 V112 H0Z" fill={t.hillFront}/><rect x="54" y="47" width="9" height="42" rx="4" fill={t.trunk}/><circle cx="58" cy="40" r="25" fill={t.canopy}/><ellipse cx="167" cy="89" rx="34" ry="10" fill={t.water}/></svg></div><div className="p-4"><p className="text-[10px] uppercase tracking-wider text-forest-600">Memória {index+1}</p><p className="font-serif text-lg text-forest-900">{t.name}</p><p className="mt-1 text-xs text-ink-soft">Jardim amadurecido e preservado.</p></div></article>})}</div></section>}

      <p className="mt-6 text-center text-xs text-ink-soft">Seu jardim não mede produtividade. Ele acompanha sua trajetória e sempre pode abrir um novo espaço.</p>
    </div>
  </main>
}

function GardenScene({ stage, theme, mirror, variant }: { stage: number; theme: GardenTheme; mirror: boolean; variant: number }) {
  const treeX = mirror ? 650 : 128
  const bedX = mirror ? 430 : 110
  const pondX = mirror ? 125 : 635
  const benchX = mirror ? 540 : 455
  const pathFlip = mirror ? -1 : 1
  return <svg viewBox="0 0 900 610" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Paisagem ilustrada do Meu Jardim">
    <defs>
      <linearGradient id="garden-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor={theme.skyTop}/><stop offset="1" stopColor={theme.skyBottom}/></linearGradient>
      <linearGradient id="garden-water" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#a8cfca"/><stop offset="1" stopColor={theme.water}/></linearGradient>
      <radialGradient id="garden-sun"><stop stopColor={theme.glow} stopOpacity=".85"/><stop offset="1" stopColor={theme.glow} stopOpacity="0"/></radialGradient>
      <filter id="garden-soft"><feGaussianBlur stdDeviation="10"/></filter>
      <filter id="garden-shadow"><feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#2e4634" floodOpacity=".18"/></filter>
    </defs>
    <rect width="900" height="610" fill="url(#garden-sky)"/>
    <circle cx={mirror?165:730} cy="95" r="92" fill="url(#garden-sun)" className="garden-glow"/>
    <g opacity=".5"><ellipse cx="150" cy="135" rx="88" ry="21" fill="#fff"/><ellipse cx="215" cy="130" rx="68" ry="17" fill="#fff"/><ellipse cx="700" cy="155" rx="92" ry="20" fill="#fff"/></g>
    <path d="M0 285 Q145 210 290 276 T580 254 T900 235 V610 H0Z" fill={theme.hillBack}/>
    <path d="M0 355 Q170 286 335 342 T650 322 T900 304 V610 H0Z" fill={theme.hillFront}/>
    <path d="M0 430 Q170 380 330 430 T620 408 T900 390 V610 H0Z" fill="#638158" opacity=".56"/>
    <g opacity=".35" fill="#294c3a">{[60,105,780,820,860].map((x,i)=><path key={x} d={`M${x} 410 q12 -42 24 0 q12 -56 22 0 q8 -35 18 0 v44 h-84z`} transform={`translate(0 ${i%2?5:0})`}/>)}</g>

    {stage>=3&&<g aria-label="Árvore de cuidado" transform={`translate(${treeX} 0)`} filter="url(#garden-shadow)"><ellipse cx="46" cy="527" rx="98" ry="17" fill="#365637" opacity=".24"/><path d="M39 504 C52 438 34 382 48 318 C58 273 78 245 98 223 C80 268 78 303 79 340 C103 316 127 284 143 253 C139 296 118 337 86 373 C91 421 94 465 101 510 Z" fill={theme.trunk}/><g className="garden-tree-crown"><ellipse cx="64" cy="224" rx="91" ry="70" fill={theme.canopy}/><ellipse cx="136" cy="214" rx="88" ry="68" fill={theme.canopyLight}/><ellipse cx="101" cy="161" rx="79" ry="62" fill={theme.canopy}/><ellipse cx="171" cy="264" rx="68" ry="55" fill={theme.canopy}/><ellipse cx="36" cy="283" rx="72" ry="56" fill={theme.canopyLight}/><g fill="#8ca277" opacity=".55"><circle cx="70" cy="183" r="8"/><circle cx="135" cy="168" r="7"/><circle cx="160" cy="228" r="6"/><circle cx="44" cy="246" r="7"/></g></g></g>}

    {stage>=1&&<g aria-label="Primeiros brotos" transform={`translate(${bedX} 0)`}>{[0,36,72,110,146].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i%2?8:0})`}><path d="M0 520 Q6 487 13 520" fill="none" stroke="#365f40" strokeWidth="5" strokeLinecap="round"/><ellipse cx="5" cy="500" rx="11" ry="5" transform="rotate(-28 5 500)" fill="#5c7c51"/><ellipse cx="15" cy="493" rx="11" ry="5" transform="rotate(25 15 493)" fill="#759063"/></g>)}</g>}

    {stage>=2&&<g aria-label="Canteiro de flores" transform={`translate(${bedX-18} 0)`}><ellipse cx="95" cy="538" rx="112" ry="28" fill="#527047" opacity=".85"/>{[10,40,72,104,137,170].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i%2?4:0})`}><path d="M0 530 Q1 497 5 478" stroke="#406846" strokeWidth="4" fill="none"/><circle cx="5" cy="475" r="10" fill={i%2?theme.flowerB:theme.flowerA}/><circle cx="-4" cy="479" r="8" fill={i%2?theme.flowerB:theme.flowerA}/><circle cx="13" cy="482" r="8" fill={i%2?theme.flowerB:theme.flowerA}/><circle cx="5" cy="479" r="4" fill="#d8aa55"/></g>)}</g>}

    {stage>=3&&<g aria-label="Caminho do jardim" transform={`translate(450 0) scale(${pathFlip} 1) translate(-450 0)`}><path d="M435 610 C435 548 510 530 525 470 C538 416 493 393 472 362" fill="none" stroke="#d7c6a6" strokeWidth="72" strokeLinecap="round" opacity=".96"/><path d="M435 610 C435 548 510 530 525 470 C538 416 493 393 472 362" fill="none" stroke="#eee0c8" strokeWidth="50" strokeLinecap="round" opacity=".9"/></g>}

    {stage>=4&&<g aria-label="Visitantes"><g className="garden-bird" transform={`translate(${mirror?640:205} 235)`} filter="url(#garden-shadow)"><ellipse cx="25" cy="20" rx="25" ry="17" fill="#e9eee7"/><circle cx="45" cy="11" r="12" fill="#f4f1e9"/><path d="M55 12 l16 5 -16 5z" fill="#b66f48"/><circle cx="48" cy="8" r="2.6" fill="#21372a"/><path d="M10 16 q13 -20 29 0 q-14 7 -29 0z" fill="#83957d"/><path d="M5 22 l-15 8 14 3z" fill="#6d8270"/><path d="M22 35 v12 M34 34 v13" stroke="#7d654a" strokeWidth="2"/><path d="M11 48 h18 M27 48 h18" stroke="#634f3b" strokeWidth="3" strokeLinecap="round"/></g><g className="garden-bird" transform={`translate(${mirror?720:285} 290) scale(.82)`}><ellipse cx="25" cy="20" rx="24" ry="16" fill="#cbd5cb"/><circle cx="44" cy="11" r="11" fill="#dde4dc"/><path d="M54 12 l14 5 -14 5z" fill="#ae6846"/><circle cx="47" cy="8" r="2.4" fill="#21372a"/><path d="M8 18 q14 -17 28 -2 q-14 7 -28 2z" fill="#708576"/></g><g className="garden-butterfly" transform={`translate(${mirror?340:520} 430)`}><ellipse cx="-9" cy="0" rx="13" ry="18" transform="rotate(-25)" fill="#c97f55"/><ellipse cx="11" cy="0" rx="13" ry="18" transform="rotate(25)" fill="#e4a65d"/><rect x="-2" y="-9" width="4" height="22" rx="2" fill="#4f493e"/><path d="M0 -7 q-7 -9 -12 -9 M0 -7 q7 -9 12 -9" stroke="#4f493e" strokeWidth="1.5" fill="none"/></g></g>}

    {stage>=5&&<g aria-label="Recanto de água" transform={`translate(${pondX} 0)`} filter="url(#garden-shadow)"><ellipse cx="65" cy="530" rx="120" ry="42" fill="#6d8062" opacity=".32"/><ellipse cx="65" cy="522" rx="108" ry="35" fill="url(#garden-water)"/><ellipse cx="43" cy="514" rx="44" ry="6" fill="#d7efea" opacity=".45"/><g fill="#4f7658"><ellipse cx="-12" cy="510" rx="19" ry="7" transform="rotate(-14)"/><ellipse cx="120" cy="518" rx="23" ry="8" transform="rotate(12)"/></g><circle cx="-6" cy="504" r="7" fill={theme.flowerB}/><circle cx="118" cy="511" r="7" fill={theme.flowerA}/></g>}

    {stage>=5&&<g aria-label="Banco junto ao caminho" transform={`translate(${benchX} 405)`} filter="url(#garden-shadow)"><rect x="0" y="14" width="124" height="16" rx="5" fill="#9b7452"/><rect x="7" y="-4" width="110" height="15" rx="5" fill="#ac825c"/><path d="M18 30 v45 M105 30 v45" stroke="#604936" strokeWidth="8" strokeLinecap="round"/><path d="M2 77 h37 M87 77 h37" stroke="#604936" strokeWidth="7" strokeLinecap="round"/></g>}

    {stage>=6&&<g aria-label="Luz do jardim"><g transform={`translate(${mirror?350:665} 365)`} filter="url(#garden-shadow)"><path d="M20 20 v120" stroke="#5f513f" strokeWidth="5"/><rect x="1" y="0" width="38" height="48" rx="6" fill="#645642"/><rect x="7" y="6" width="26" height="34" rx="4" fill={theme.glow} className="garden-glow"/><circle cx="20" cy="21" r="60" fill="url(#garden-sun)" opacity=".34"/></g>{[0,1,2,3,4,5].map(i=><circle key={i} cx={120+i*126+(variant%2)*18} cy={110+(i%3)*36} r={3+(i%2)} fill={theme.glow} className="garden-glow" opacity=".7"/>)}</g>}

    <g opacity=".28" fill="#274c38"><ellipse cx="90" cy="575" rx="155" ry="34"/><ellipse cx="810" cy="570" rx="150" ry="31"/></g>
  </svg>
}

function Stat({ Icon, value, label }: { Icon: typeof Sprout; value: number; label: string }) { return <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#faf8f3] p-3"><Icon className="h-4 w-4"/><div><p className="font-serif text-xl">{value}</p><p className="text-[11px] text-ink-soft">{label}</p></div></div> }
function Mini({ Icon, label }: { Icon: typeof Sprout; label: string }) { return <div className="flex items-center gap-2 rounded-xl bg-[#faf8f3] p-3 text-xs"><Icon className="h-4 w-4"/>{label}</div> }
