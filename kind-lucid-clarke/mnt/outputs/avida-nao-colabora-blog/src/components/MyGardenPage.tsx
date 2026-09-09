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
  growth_model_version?: number
}
type GardenTheme = {
  name: string
  subtitle: string
  skyTop: string
  skyBottom: string
  hillBack: string
  hillMid: string
  lawn: string
  lawnDark: string
  flowerA: string
  flowerB: string
  flowerC: string
  water: string
  trunk: string
  canopy: string
  canopyLight: string
  glow: string
}

const EMPTY: GardenState = { stage: 0, active_days: 0, diversity: 0, signals: {}, garden_index: 0, garden_progress: 0, completed_gardens: 0, total_growth: 0 }
const THEMES: GardenTheme[] = [
  { name: 'Clareira Serena', subtitle: 'Um espaço aberto, claro e leve para recomeçar.', skyTop: '#d8e8e5', skyBottom: '#f5efdf', hillBack: '#b6c4a4', hillMid: '#91a87c', lawn: '#769362', lawnDark: '#56734f', flowerA: '#d99d8b', flowerB: '#f0d4a0', flowerC: '#c4a4b4', water: '#6fa3a0', trunk: '#725039', canopy: '#3f6546', canopyLight: '#66855c', glow: '#efd396' },
  { name: 'Jardim do Lago', subtitle: 'Água, folhas e caminhos ganham mais presença.', skyTop: '#d2e5e3', skyBottom: '#f1efdc', hillBack: '#a9bca4', hillMid: '#879d78', lawn: '#708d67', lawnDark: '#4f6f54', flowerA: '#d5b088', flowerB: '#ecd1b4', flowerC: '#b7a3bd', water: '#63999f', trunk: '#6c4e3a', canopy: '#476b4c', canopyLight: '#6b8963', glow: '#e9d09a' },
  { name: 'Bosque de Luz', subtitle: 'Sombras suaves e pontos de luz criam um novo ritmo.', skyTop: '#e4e6d2', skyBottom: '#f1e7d5', hillBack: '#a7b294', hillMid: '#7c916b', lawn: '#667f5b', lawnDark: '#425f47', flowerA: '#c79da9', flowerB: '#e3c69d', flowerC: '#d49583', water: '#789e99', trunk: '#6a4c38', canopy: '#365a3f', canopyLight: '#5f7c54', glow: '#f0c86e' },
  { name: 'Jardim Silvestre', subtitle: 'Flores menos simétricas deixam o espaço mais espontâneo.', skyTop: '#dce9dc', skyBottom: '#f1ead9', hillBack: '#b3bd9b', hillMid: '#8da170', lawn: '#789462', lawnDark: '#56734d', flowerA: '#cc958c', flowerB: '#e7cc91', flowerC: '#b99bb0', water: '#72a09a', trunk: '#75543e', canopy: '#4f704c', canopyLight: '#718c5e', glow: '#edcf90' },
  { name: 'Recanto do Entardecer', subtitle: 'A paisagem fica mais quente e acolhedora.', skyTop: '#eadbca', skyBottom: '#f5e5cf', hillBack: '#b7af8b', hillMid: '#8b906c', lawn: '#71845b', lawnDark: '#516b4c', flowerA: '#c88468', flowerB: '#e0b28d', flowerC: '#b998a6', water: '#77979a', trunk: '#6e4d39', canopy: '#486343', canopyLight: '#6f8056', glow: '#f0b96d' },
  { name: 'Jardim das Folhas', subtitle: 'Texturas verdes e pequenos caminhos ocupam o cenário.', skyTop: '#dce7d7', skyBottom: '#f0ebd8', hillBack: '#aab99c', hillMid: '#849878', lawn: '#6d8b62', lawnDark: '#4a684d', flowerA: '#d0a47d', flowerB: '#e4c89f', flowerC: '#c29caf', water: '#6c9692', trunk: '#6b4f3b', canopy: '#3f6044', canopyLight: '#628056', glow: '#e8cc84' },
  { name: 'Jardim de Brisa', subtitle: 'Um novo espaço com mais respiro entre árvores e canteiros.', skyTop: '#d5e6e4', skyBottom: '#eef0dd', hillBack: '#b0c0a7', hillMid: '#8ca17c', lawn: '#78956d', lawnDark: '#557552', flowerA: '#c89dab', flowerB: '#ead0ae', flowerC: '#d09a82', water: '#70a19d', trunk: '#77573f', canopy: '#506f4d', canopyLight: '#718d64', glow: '#eed696' },
  { name: 'Jardim de Luz Baixa', subtitle: 'Luz suave, água e vegetação formam um canto mais íntimo.', skyTop: '#dddcd4', skyBottom: '#ede4d5', hillBack: '#9ea98f', hillMid: '#758369', lawn: '#61775b', lawnDark: '#3f5e49', flowerA: '#c5917d', flowerB: '#d9bd96', flowerC: '#aa91a6', water: '#668f90', trunk: '#654937', canopy: '#36563f', canopyLight: '#56704f', glow: '#e5b565' },
]
const ELEMENTS = [
  { stage: 1, name: 'Primeiros brotos', why: 'Alguns momentos de cuidado começaram a deixar uma marca visível.', Icon: Sprout },
  { stage: 2, name: 'Canteiro de flores', why: 'A presença recorrente trouxe mais variedade e cor ao jardim.', Icon: Flower2 },
  { stage: 3, name: 'Árvore de cuidado', why: 'A continuidade criou raízes e um ponto permanente de acolhimento.', Icon: TreePine },
  { stage: 4, name: 'Visitantes', why: 'Com abrigo e flores, pequenas companhias começaram a chegar.', Icon: Bird },
  { stage: 5, name: 'Recanto de água', why: 'O jardim ganhou profundidade e um novo canto de pausa.', Icon: Waves },
  { stage: 6, name: 'Luz do jardim', why: 'O espaço amadureceu e ganhou uma atmosfera própria.', Icon: Sparkles },
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
  const mirror = gardenIndex % 2 === 1
  const variant = gardenIndex % 4
  const unlocked = ELEMENTS.filter(e => stage >= e.stage)
  const detail = selected ? ELEMENTS.find(e => e.stage === selected) : unlocked[unlocked.length - 1]
  const memories = memoryIndexes(Math.max(0, state.completed_gardens || 0))

  return <main className="min-h-full bg-[#faf6ee] px-4 py-7 text-forest-950 sm:px-6">
    <style>{`@keyframes bird-rest{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-1deg)}}@keyframes butterfly-path{0%,100%{transform:translate(0,0) rotate(-4deg)}35%{transform:translate(24px,-16px) rotate(4deg)}70%{transform:translate(48px,2px) rotate(-2deg)}}@keyframes leaf-sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.8deg)}}@keyframes firefly{0%,100%{opacity:.25}50%{opacity:1}}.garden-bird{animation:bird-rest 4.8s ease-in-out infinite}.garden-butterfly{animation:butterfly-path 9s ease-in-out infinite}.garden-crown{transform-origin:50% 90%;animation:leaf-sway 7s ease-in-out infinite}.garden-firefly{animation:firefly 3.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.garden-bird,.garden-butterfly,.garden-crown,.garden-firefly{animation:none!important}}`}</style>
    <div className="mx-auto max-w-[1180px]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Seu espaço vivo</p><h1 className="font-serif text-4xl sm:text-5xl">Meu Jardim</h1><p className="mt-2 text-sm text-ink-soft">Sua trajetória ganha forma aos poucos, sem pressa e sem perder o que já foi construído.</p></div><p className="max-w-sm font-serif italic text-forest-700">“Não existe último jardim por aqui.”</p></header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_270px]">
        <section className="overflow-hidden rounded-[34px] border border-[#d7cebf] bg-white shadow-[0_30px_80px_rgba(41,66,46,.16)]" aria-label={`Jardim atual: ${theme.name}`}>
          <div className="relative min-h-[570px] sm:min-h-[640px]">
            <GardenScene stage={stage} theme={theme} mirror={mirror} variant={variant}/>
            <div className="absolute left-4 top-4 z-30 max-w-[285px] rounded-[24px] border border-white/70 bg-[#fffdf8]/90 px-5 py-4 shadow-[0_14px_35px_rgba(43,60,45,.15)] backdrop-blur-md sm:left-6 sm:top-6"><p className="text-[10px] uppercase tracking-[.18em] text-forest-600">Jardim atual</p><p className="mt-1 font-serif text-[22px] text-forest-950">{theme.name}</p><p className="mt-1 text-xs leading-5 text-ink-soft">{theme.subtitle}</p>{gardenIndex>0&&stage===0&&<p className="mt-2 text-[11px] font-semibold text-forest-700">Um novo jardim começou, sem apagar os anteriores.</p>}</div>
            {stage===0&&<div className="absolute bottom-5 left-4 right-4 z-30 max-w-sm rounded-[22px] border border-white/70 bg-[#fffdf8]/88 p-4 shadow-lg backdrop-blur-md sm:bottom-7 sm:left-auto sm:right-7"><p className="font-serif text-lg text-forest-950">O solo está se preparando</p><p className="mt-1 text-xs leading-5 text-ink-soft">Um Check-in isolado não cria uma transformação. O jardim responde quando alguns momentos de cuidado começam a formar uma trajetória.</p></div>}
          </div>
        </section>

        <aside className="space-y-4"><section className="rounded-[26px] border border-line bg-white p-5"><h2 className="font-serif text-xl">Sua jornada</h2><Stat Icon={Heart} value={state.active_days} label="dias de cuidado"/><Stat Icon={Sparkles} value={state.diversity} label="formas de cuidado"/><Stat Icon={Sprout} value={unlocked.length} label="mudanças neste jardim"/>{state.completed_gardens>0&&<Stat Icon={TreePine} value={state.completed_gardens} label={state.completed_gardens===1?'jardim preservado':'jardins preservados'}/>}</section><section className="rounded-[26px] border border-[#e6dcc8] bg-[#fff8e9] p-5"><Sprout className="h-5 w-5"/><p className="mt-3 font-medium">Um ritmo mais equilibrado.</p><p className="mt-2 text-xs leading-5 text-ink-soft">O crescimento voltou a um ciclo mais longo, próximo da lógica original. Pequenas mudanças continuam acessíveis, mas completar um jardim exige uma trajetória consistente.</p></section></aside>
      </div>

      <section className="mt-6 rounded-[30px] border border-line bg-white p-5 sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-widest text-forest-600">Crescimento contínuo</p><h2 className="font-serif text-2xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com atmosfera e composição diferentes.</p></div><div className="mt-5 flex flex-wrap gap-2">{unlocked.map(e=><button key={e.stage} onClick={()=>setSelected(e.stage)} className="rounded-full border border-line bg-paper-soft px-3 py-2 text-xs text-forest-800 transition hover:border-forest-300">{e.name}</button>)}{stage<6&&<span className="rounded-full border border-dashed border-forest-200 px-3 py-2 text-xs text-ink-soft">A próxima transformação está se formando</span>}</div></section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">O que ganhou vida</p>{detail?<><div className="mt-4 flex gap-4"><div className="rounded-2xl bg-[#eef4ea] p-4"><detail.Icon className="h-8 w-8"/></div><div><h3 className="font-serif text-xl">{detail.name}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{detail.why}</p></div></div></>:<p className="mt-4 text-sm text-ink-soft">As primeiras mudanças aparecem depois de alguns momentos de cuidado, sem transformar uma ação isolada em recompensa.</p>}</section><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">Como ele entende sua jornada</p><h3 className="mt-2 font-serif text-xl">Cuidado, não desempenho</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Dias com Check-ins ou Diário formam a base. Relatórios, marcos, questionários, conteúdos e o Plano de Autocuidado também ajudam, mas com limites para que o jardim não seja concluído rápido demais.</p><div className="mt-5 grid grid-cols-2 gap-3"><Mini Icon={CheckCircle2} label="Sem streak"/><Mini Icon={Heart} label="Sem punição"/><Mini Icon={BookOpen} label="Diversidade ajuda"/><Mini Icon={Sparkles} label="Sem placar"/></div></section></div>

      {memories.length>0&&<section className="mt-5 rounded-[30px] border border-line bg-white p-5 sm:p-7"><p className="text-xs uppercase tracking-widest text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-2xl">Espaços que já amadureceram</h2><p className="mt-1 text-sm text-ink-soft">Eles não desaparecem quando um novo jardim começa.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{memories.map(index=>{const t=themeFor(index);return <article key={index} className="overflow-hidden rounded-2xl border border-line bg-[#faf8f3]"><div className="h-32 overflow-hidden"><MiniGarden theme={t} mirror={index%2===1}/></div><div className="p-4"><p className="text-[10px] uppercase tracking-wider text-forest-600">Memória {index+1}</p><p className="font-serif text-lg text-forest-900">{t.name}</p><p className="mt-1 text-xs text-ink-soft">Jardim amadurecido e preservado.</p></div></article>})}</div></section>}

      <p className="mt-6 text-center text-xs text-ink-soft">Seu jardim não mede produtividade. Ele acompanha sua trajetória e sempre pode abrir um novo espaço.</p>
    </div>
  </main>
}

function GardenScene({ stage, theme, mirror, variant }: { stage: number; theme: GardenTheme; mirror: boolean; variant: number }) {
  const flip = mirror ? -1 : 1
  const treeX = mirror ? 700 : 92
  const bedX = mirror ? 560 : 92
  const pondX = mirror ? 118 : 650
  const benchX = mirror ? 500 : 420
  return <svg viewBox="0 0 940 640" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" role="img" aria-label="Paisagem ilustrada do Meu Jardim">
    <defs>
      <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor={theme.skyTop}/><stop offset="1" stopColor={theme.skyBottom}/></linearGradient>
      <linearGradient id="g-lawn" x1="0" y1="0" x2="0" y2="1"><stop stopColor={theme.lawn}/><stop offset="1" stopColor={theme.lawnDark}/></linearGradient>
      <linearGradient id="g-water" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b9d7d1"/><stop offset=".45" stopColor={theme.water}/><stop offset="1" stopColor="#4f7e7c"/></linearGradient>
      <radialGradient id="g-glow"><stop stopColor={theme.glow} stopOpacity=".88"/><stop offset="1" stopColor={theme.glow} stopOpacity="0"/></radialGradient>
      <filter id="g-shadow"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#27422f" floodOpacity=".22"/></filter>
      <filter id="g-soft"><feGaussianBlur stdDeviation="12"/></filter>
    </defs>
    <rect width="940" height="640" fill="url(#g-sky)"/>
    <circle cx={mirror?165:775} cy={variant===2?108:92} r="112" fill="url(#g-glow)" opacity=".9"/>
    <g fill="#fffdf7" opacity=".68"><ellipse cx="150" cy="126" rx="64" ry="18"/><ellipse cx="205" cy="126" rx="52" ry="14"/><ellipse cx="700" cy="156" rx="74" ry="18"/><ellipse cx="758" cy="154" rx="50" ry="13"/></g>
    <path d="M0 310 C135 244 242 240 356 292 C482 350 570 332 674 274 C780 215 850 220 940 254 V640 H0Z" fill={theme.hillBack}/>
    <path d="M0 382 C145 322 270 334 382 377 C510 425 620 386 740 333 C822 296 884 302 940 332 V640 H0Z" fill={theme.hillMid}/>
    <g opacity=".28" fill="#31543c">{[28,76,126,804,850,895].map((x,i)=><g key={x} transform={`translate(${x} ${342+(i%3)*7})`}><path d="M0 82 L20 30 L34 82Z"/><path d="M20 82 L40 16 L57 82Z"/><path d="M45 82 L64 27 L82 82Z"/></g>)}</g>
    <path d="M0 445 C160 418 275 440 390 467 C522 497 655 450 770 432 C846 420 904 425 940 438 V640 H0Z" fill="url(#g-lawn)"/>
    <path d="M0 561 C145 530 250 551 345 578 C464 611 585 567 688 548 C796 529 865 538 940 556 V640 H0Z" fill="#3f6348" opacity=".42"/>
    <g opacity=".3" stroke="#dfe7cf" strokeWidth="2">{[90,145,205,742,802,862].map((x,i)=><path key={x} d={`M${x} 548 q6 -22 12 0 M${x+12} 548 q4 -17 9 0`} />)}</g>

    {stage>=3&&<g transform={`translate(${treeX} 0)`} aria-label="Árvore de cuidado" filter="url(#g-shadow)"><ellipse cx="94" cy="550" rx="125" ry="20" fill="#274b35" opacity=".24"/><path d="M78 535 C91 484 77 430 84 380 C90 337 109 302 126 273 C128 323 123 357 128 394 C152 367 169 338 183 309 C181 352 162 390 134 422 C141 468 146 506 154 541 Z" fill={theme.trunk}/><path d="M113 417 C88 386 69 366 43 348 M127 391 C153 357 174 338 204 322" stroke="#5b4232" strokeWidth="13" strokeLinecap="round"/><g className="garden-crown"><ellipse cx="86" cy="280" rx="92" ry="73" fill={theme.canopy}/><ellipse cx="160" cy="270" rx="94" ry="74" fill={theme.canopyLight}/><ellipse cx="130" cy="211" rx="82" ry="68" fill={theme.canopy}/><ellipse cx="215" cy="323" rx="70" ry="58" fill={theme.canopy}/><ellipse cx="42" cy="335" rx="74" ry="60" fill={theme.canopyLight}/><ellipse cx="124" cy="330" rx="96" ry="68" fill={theme.canopy}/><g fill="#91a77a" opacity=".5"><circle cx="94" cy="230" r="8"/><circle cx="164" cy="221" r="7"/><circle cx="202" cy="294" r="8"/><circle cx="54" cy="304" r="7"/><circle cx="128" cy="303" r="6"/></g></g></g>}

    {stage>=3&&<g aria-label="Caminho do jardim" transform={`translate(470 0) scale(${flip} 1) translate(-470 0)`}><path d="M480 640 C476 584 540 556 550 506 C560 457 531 429 510 398" fill="none" stroke="#c9b18a" strokeWidth="96" strokeLinecap="round" opacity=".55"/><path d="M480 640 C476 584 540 556 550 506 C560 457 531 429 510 398" fill="none" stroke="#e5d2b2" strokeWidth="70" strokeLinecap="round"/><path d="M480 640 C476 584 540 556 550 506 C560 457 531 429 510 398" fill="none" stroke="#f0e2c8" strokeWidth="42" strokeLinecap="round" opacity=".82"/></g>}

    {stage>=1&&<g aria-label="Primeiros brotos" transform={`translate(${bedX} 0)`}>{[0,35,70,108,148,185].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i%2?6:0})`}><path d="M0 551 Q5 516 12 548" fill="none" stroke="#345d3d" strokeWidth="5" strokeLinecap="round"/><ellipse cx="5" cy="526" rx="12" ry="5" transform="rotate(-30 5 526)" fill="#5c7e50"/><ellipse cx="16" cy="519" rx="12" ry="5" transform="rotate(28 16 519)" fill="#7b9667"/></g>)}</g>}

    {stage>=2&&<g aria-label="Canteiro de flores" transform={`translate(${bedX-20} 0)`}><ellipse cx="116" cy="571" rx="142" ry="34" fill="#4f704b"/><ellipse cx="116" cy="579" rx="136" ry="23" fill="#365d43" opacity=".33"/>{[6,34,64,95,126,157,188,220].map((dx,i)=><g key={dx} transform={`translate(${dx} ${i%3===1?5:0})`}><path d="M0 564 Q2 522 7 503" stroke="#3c6744" strokeWidth="4" fill="none"/><ellipse cx="-2" cy="506" rx="10" ry="7" fill={[theme.flowerA,theme.flowerB,theme.flowerC][i%3]}/><ellipse cx="9" cy="499" rx="10" ry="7" fill={[theme.flowerA,theme.flowerB,theme.flowerC][i%3]}/><ellipse cx="17" cy="508" rx="10" ry="7" fill={[theme.flowerA,theme.flowerB,theme.flowerC][i%3]}/><circle cx="8" cy="506" r="5" fill="#c99645"/></g>)}<g fill="#b7aa8d">{[20,58,104,168,213].map((x,i)=><ellipse key={x} cx={x} cy={582+(i%2)*3} rx="13" ry="7"/>)}</g></g>}

    {stage>=4&&<g aria-label="Visitantes"><g className="garden-bird" transform={`translate(${mirror?710:245} 290)`} filter="url(#g-shadow)"><ellipse cx="28" cy="22" rx="31" ry="21" fill="#f4f1e8"/><circle cx="53" cy="11" r="15" fill="#fbf8ef"/><path d="M66 12 l21 7 -21 7z" fill="#b96d43"/><circle cx="58" cy="8" r="3" fill="#203a2b"/><path d="M6 20 q19 -26 38 -3 q-19 10 -38 3z" fill="#7d9279"/><path d="M1 26 l-22 11 20 4z" fill="#627b68"/><path d="M25 43 v15 M41 42 v16" stroke="#735d45" strokeWidth="2.5"/><path d="M10 59 h28 M30 59 h28" stroke="#5b4938" strokeWidth="3.5" strokeLinecap="round"/></g><g className="garden-bird" transform={`translate(${mirror?610:345} 345) scale(.86)`}><ellipse cx="28" cy="22" rx="30" ry="20" fill="#d8dfd5"/><circle cx="52" cy="12" r="14" fill="#edf0e8"/><path d="M65 13 l19 6 -19 7z" fill="#ad6744"/><circle cx="57" cy="9" r="3" fill="#203a2b"/><path d="M7 21 q18 -23 36 -2 q-18 9 -36 2z" fill="#6e856f"/></g><g className="garden-butterfly" transform={`translate(${mirror?360:555} 470)`}><ellipse cx="-12" cy="0" rx="17" ry="23" transform="rotate(-28)" fill="#c87952"/><ellipse cx="14" cy="0" rx="17" ry="23" transform="rotate(28)" fill="#e0a052"/><ellipse cx="-11" cy="16" rx="10" ry="14" fill="#d59061"/><ellipse cx="12" cy="16" rx="10" ry="14" fill="#edba6f"/><rect x="-2.5" y="-11" width="5" height="29" rx="3" fill="#4a453c"/><path d="M0 -8 q-8 -11 -15 -11 M0 -8 q8 -11 15 -11" stroke="#4a453c" strokeWidth="2" fill="none"/></g></g>}

    {stage>=5&&<g aria-label="Recanto de água" transform={`translate(${pondX} 0)`} filter="url(#g-shadow)"><ellipse cx="72" cy="563" rx="142" ry="51" fill="#506f55" opacity=".55"/><ellipse cx="72" cy="554" rx="128" ry="41" fill="url(#g-water)"/><ellipse cx="45" cy="544" rx="58" ry="8" fill="#d7eeea" opacity=".38"/><path d="M-44 550 q10 -46 19 0 M-32 550 q12 -57 22 0 M178 550 q-8 -43 -18 0 M162 550 q-11 -55 -21 0" stroke="#466e50" strokeWidth="5" fill="none"/><g fill="#456f58"><ellipse cx="20" cy="555" rx="24" ry="9"/><ellipse cx="118" cy="561" rx="28" ry="10"/></g><circle cx="19" cy="550" r="8" fill={theme.flowerB}/><circle cx="120" cy="555" r="8" fill={theme.flowerA}/></g>}

    {stage>=5&&<g aria-label="Banco junto ao caminho" transform={`translate(${benchX} 438)`} filter="url(#g-shadow)"><rect x="0" y="18" width="142" height="18" rx="6" fill="#8f6748"/><rect x="9" y="-4" width="124" height="17" rx="6" fill="#aa7a54"/><path d="M20 36 v54 M120 36 v54" stroke="#57412f" strokeWidth="9" strokeLinecap="round"/><path d="M4 92 h43 M95 92 h43" stroke="#57412f" strokeWidth="8" strokeLinecap="round"/></g>}

    {stage>=6&&<g aria-label="Luz do jardim"><g transform={`translate(${mirror?520:612} 448)`} filter="url(#g-shadow)"><path d="M0 85 v-82" stroke="#554737" strokeWidth="8"/><path d="M-16 5 h32 l-5 33 h-22z" fill="#675646"/><rect x="-8" y="11" width="16" height="20" rx="4" fill={theme.glow}/><circle cx="0" cy="20" r="34" fill="url(#g-glow)"/></g>{[[600,392],[670,360],[735,410],[540,350],[805,380]].map(([x,y],i)=><circle key={`${x}-${y}`} cx={mirror?940-x:x} cy={y} r={i%2?4:3} fill={theme.glow} className="garden-firefly" style={{animationDelay:`${i*.55}s`}}/>)}</g>}
  </svg>
}

function MiniGarden({ theme, mirror }: { theme: GardenTheme; mirror: boolean }) {
  return <svg viewBox="0 0 260 128" className="h-full w-full" aria-hidden="true"><defs><linearGradient id={`mini-${theme.name.replace(/\s/g,'-')}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={theme.skyTop}/><stop offset="1" stopColor={theme.skyBottom}/></linearGradient></defs><rect width="260" height="128" fill={`url(#mini-${theme.name.replace(/\s/g,'-')})`}/><path d="M0 72 Q66 39 132 70 T260 59 V128 H0Z" fill={theme.hillBack}/><path d="M0 89 Q72 64 142 88 T260 78 V128 H0Z" fill={theme.lawn}/><g transform={`translate(${mirror?166:40} 0)`}><rect x="30" y="54" width="12" height="55" rx="5" fill={theme.trunk}/><circle cx="36" cy="48" r="34" fill={theme.canopy}/><circle cx="60" cy="52" r="27" fill={theme.canopyLight}/></g><ellipse cx={mirror?58:202} cy="105" rx="37" ry="12" fill={theme.water}/><g fill={theme.flowerA}><circle cx="110" cy="105" r="5"/><circle cx="126" cy="101" r="5"/><circle cx="142" cy="106" r="5"/></g></svg>
}

function Stat({ Icon, value, label }: { Icon: typeof Sprout; value: number; label: string }) { return <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#faf8f3] p-3"><Icon className="h-4 w-4"/><div><p className="font-serif text-xl">{value}</p><p className="text-[11px] text-ink-soft">{label}</p></div></div> }
function Mini({ Icon, label }: { Icon: typeof Sprout; label: string }) { return <div className="flex items-center gap-2 rounded-xl bg-[#faf8f3] p-3 text-xs"><Icon className="h-4 w-4"/>{label}</div> }
