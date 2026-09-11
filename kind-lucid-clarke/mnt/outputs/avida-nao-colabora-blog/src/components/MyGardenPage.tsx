import { useEffect, useRef, useState } from 'react'
import { Bird, BookOpen, CheckCircle2, Flower2, Heart, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'
import { gardenThemeFor, gardenVisualProgress } from '../lib/gardenThemes'
import LivingGarden from './garden/LivingGarden'
import GardenCelebration from './garden/GardenCelebration'

interface Props { userId: string; profile?: Profile | null; onNavigatePricing?: () => void }
type GardenState = { stage:number; active_days:number; diversity:number; signals:Record<string,number>; garden_index:number; garden_progress:number; completed_gardens:number; total_growth:number; growth_model_version?:number }

const EMPTY:GardenState={stage:0,active_days:0,diversity:0,signals:{},garden_index:0,garden_progress:0,completed_gardens:0,total_growth:0}
const ELEMENTS=[
  {stage:1,name:'Primeiros brotos',why:'Alguns momentos de cuidado começaram a deixar uma marca visível.',preview:'Quando alguns momentos de cuidado se acumularem, os primeiros brotos aparecem.',Icon:Sprout},
  {stage:2,name:'Flores',why:'A presença recorrente trouxe mais variedade e cor ao jardim.',preview:'Com mais presença e variedade, flores começam a colorir o jardim.',Icon:Flower2},
  {stage:3,name:'Árvore',why:'A continuidade criou raízes e um ponto permanente de acolhimento.',preview:'A continuidade faz nascer uma árvore — um ponto permanente de acolhimento.',Icon:TreePine},
  {stage:4,name:'Vida',why:'Com abrigo e flores, pequenas companhias começaram a chegar.',preview:'Com abrigo e flores, pequenas companhias vão chegar ao jardim.',Icon:Bird},
  {stage:5,name:'Recanto',why:'O jardim ganhou profundidade e um novo canto de pausa.',preview:'O jardim ganha profundidade com um novo canto de pausa junto à água.',Icon:Waves},
  {stage:6,name:'Luz',why:'O espaço amadureceu e ganhou uma atmosfera própria.',preview:'No auge, o espaço amadurece e ganha uma atmosfera própria de luz.',Icon:Sparkles}
] as const
// limiar de garden_progress (0..59, ver migration garden_balanced_growth_v4) em que cada
// elemento acima aparece — mesmos números do CASE que calcula `stage` na RPC.
const STAGE_THRESHOLDS:Record<number,number>={1:3,2:10,3:18,4:28,5:39,6:50}
const LAST_GARDEN_KEY_PREFIX='avnc:garden:lastIndex:'

function themeFor(index:number){return gardenThemeFor(index)}
function memoryIndexes(completed:number){return Array.from({length:Math.max(0,completed)},(_,i)=>completed-1-i)}

export default function MyGardenPage({userId,profile,onNavigatePricing}:Props){
  const access=hasPlanAccess(getEffectivePlan(profile),'essential')
  const [state,setState]=useState<GardenState>(EMPTY)
  const [selected,setSelected]=useState<number|null>(null)
  const [showAllMemories,setShowAllMemories]=useState(false)
  const [celebrateIndex,setCelebrateIndex]=useState<number|null>(null)
  const memoriesRef=useRef<HTMLDivElement|null>(null)

  useEffect(()=>{
    if(!access)return
    let alive=true
    ;(async()=>{
      const {data}=await supabase.rpc('get_my_garden_state')
      if(!alive||!data)return
      const next=data as GardenState
      setState(next)
      // um jardim "vira" quando garden_index sobe — comparamos com o último índice visto
      // (guardado no navegador) pra celebrar só uma vez, no momento da conclusão.
      try{
        const key=LAST_GARDEN_KEY_PREFIX+userId
        const prevRaw=window.localStorage.getItem(key)
        const prev=prevRaw==null?null:Number(prevRaw)
        const nextIndex=Math.max(0,next.garden_index||0)
        if(prev!=null&&!Number.isNaN(prev)&&nextIndex>prev)setCelebrateIndex(nextIndex-1)
        window.localStorage.setItem(key,String(nextIndex))
      }catch{/* localStorage indisponível (modo privado etc.) — só não celebra, sem quebrar a página */}
    })().catch(()=>{})
    return()=>{alive=false}
  },[userId,access])

  if(!access)return <div className="mx-auto max-w-4xl px-4 py-10"><section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-forest-500"/><h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1><p className="mt-3 text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>{onNavigatePricing&&<button onClick={onNavigatePricing} className="mt-6 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm text-white">Ver planos</button>}</section></div>

  const stage=Math.max(0,Math.min(6,state.stage||0))
  const gardenIndex=Math.max(0,state.garden_index||0)
  const theme=themeFor(gardenIndex)
  const unlocked=ELEMENTS.filter(e=>stage>=e.stage)
  const detail=selected?ELEMENTS.find(e=>e.stage===selected):unlocked[unlocked.length-1]
  const detailLocked=!!detail&&stage<detail.stage
  const next=ELEMENTS.find(e=>e.stage>stage)
  const NextIcon=next?.Icon??Sparkles
  const remainingToNext=next?Math.max(0,STAGE_THRESHOLDS[next.stage]-(state.garden_progress||0)):0
  const completedGardens=Math.max(0,state.completed_gardens||0)
  const allMemories=memoryIndexes(completedGardens)
  const memories=showAllMemories?allMemories:allMemories.slice(0,8)
  const visualProgress=Math.max(0,Math.min(100,Math.round((state.garden_progress||0)/60*100)))
  const gardenProgress=gardenVisualProgress(state.garden_progress||0)
  const celebrationTheme=celebrateIndex!=null?themeFor(celebrateIndex):null

  function goToHistory(){
    setCelebrateIndex(null)
    memoriesRef.current?.scrollIntoView({behavior:'smooth',block:'start'})
  }

  return <main className="min-h-full bg-[#f7f0e5] text-forest-950">
    {celebrationTheme&&<GardenCelebration theme={celebrationTheme} onViewHistory={goToHistory} onClose={()=>setCelebrateIndex(null)}/>}

    <section className="relative overflow-hidden border-b border-[#ded3c3] bg-[#efe4d4]">
      <LivingGarden theme={theme} progress={gardenProgress}/>
      <div className="relative z-10 mx-auto flex min-h-[420px] max-w-[1240px] items-start px-5 py-8 sm:px-8 sm:py-10 lg:min-h-[480px] lg:px-10">
        <div className="max-w-[460px] rounded-[26px] border border-white/35 bg-[#fffaf1]/[0.68] p-6 shadow-[0_20px_60px_rgba(47,62,43,.14)] backdrop-blur-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-forest-700">Meu Jardim</p>
          <h1 className="mt-2 font-serif text-4xl leading-[1.02] text-[#173e2d] sm:text-5xl">Um espaço que cresce com você</h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-[#5f655f]">Sua trajetória ganha forma aos poucos. Cada pequeno cuidado importa e, com o tempo, transforma este espaço em vida, beleza e presença.</p>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[28px] border border-[#e0d8ca] bg-[#fffaf3] p-6 shadow-[0_14px_40px_rgba(47,61,43,.07)] sm:p-7">
        <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e8eadf]"><Sprout className="h-5 w-5 text-forest-700"/></div><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Jardim atual</p><p className="mt-1 font-serif text-2xl">{theme.label}</p><p className="mt-1 text-xs text-ink-soft">{stage===6?'Maduro — todo progresso, por menor que pareça, também floresce.':'Em evolução'}</p></div></div><div className="shrink-0 rounded-full border border-[#dde2d6] bg-[#f1f3ec] px-3 py-1.5 text-[10px] font-medium text-forest-700">Crescimento contínuo</div></div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7e3d8]"><div className="h-full rounded-full bg-gradient-to-r from-[#315d3f] to-[#8da37c] transition-[width] duration-700" style={{width:`${visualProgress}%`}}/></div>
        <div className="relative mt-6">
          <div className="absolute left-[8.34%] right-[8.34%] top-[22px] h-0.5 bg-[#e7e3d8]"/>
          <div className="absolute left-[8.34%] top-[22px] h-0.5 bg-gradient-to-r from-[#315d3f] to-[#8da37c] transition-[width] duration-700" style={{width:`${(visualProgress*0.8334).toFixed(2)}%`}}/>
          <div className="relative grid grid-cols-6 gap-2">{ELEMENTS.map(({stage:itemStage,name,Icon})=>{
            const achieved=stage>itemStage
            const current=stage>=itemStage&&!achieved
            const active=stage>=itemStage
            const isSelected=(selected??unlocked[unlocked.length-1]?.stage)===itemStage
            return <button key={itemStage} type="button" onClick={()=>setSelected(itemStage)} className="group text-center" aria-label={active?`Ver ${name}, já presente no jardim`:`Ver prévia de ${name}, ainda por vir`}>
              <span className={`mx-auto grid h-11 w-11 place-items-center rounded-full border-2 bg-[#fffdf9] transition ${current?'border-forest-700 text-forest-700 shadow-[0_0_0_4px_rgba(49,93,63,.12)]':active?'border-[#a9b89c] text-forest-700':'border-dashed border-[#d9d2c2] text-[#bbb9ad]'} ${isSelected?'ring-2 ring-offset-2 ring-[#315d3f]/40':''}`}><Icon className="h-4 w-4"/></span>
              <span className={`mt-2 block text-[10px] ${active?'text-forest-800':'text-[#aaa79d]'}`}>{name}</span>
            </button>
          })}</div>
        </div>
        <p className="mt-5 text-center font-serif text-sm italic text-[#74766f]">{detail?(detailLocked?`Em breve: ${detail.preview}`:detail.why):'O jardim está começando a criar raízes.'}</p>
        <p className="mt-1 text-center text-[10px] text-[#a6a48f]">Toque em qualquer etapa para ver o que já floresceu ou o que ainda está por vir.</p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[28px] border border-[#e0d8ca] bg-[#fffaf3] p-6 shadow-[0_14px_40px_rgba(47,61,43,.07)]">
          <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Ações que fazem seu jardim crescer</h2><p className="mt-1 text-xs text-ink-soft">Diferentes áreas do AVNC contribuem para o jardim. Sem streak, sem placar e sem punição.</p></div><Heart className="hidden h-6 w-6 text-forest-500 sm:block"/></div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6"><ActionItem Icon={CheckCircle2} label="Check-in"/><ActionItem Icon={BookOpen} label="Diário"/><ActionItem Icon={Sparkles} label="Relatórios"/><ActionItem Icon={Sprout} label="Plano de Autocuidado"/><ActionItem Icon={Flower2} label="Conteúdos"/><ActionItem Icon={TreePine} label="Marcos"/></div>
          <div className="mt-6 rounded-[22px] border border-[#e3ddcf] bg-[#f7f3ea] p-4"><p className="font-serif text-lg text-forest-900">Um ritmo mais equilibrado</p><p className="mt-1 text-xs leading-5 text-ink-soft">Dias com Check-ins ou Diário formam a base. Relatórios, marcos e outras formas de cuidado complementam o crescimento. Um Check-in isolado não cria uma transformação e o jardim não mede produtividade.</p><div className="mt-4 grid grid-cols-3 gap-2"><JourneyMetric value={state.active_days||0} label="dias de cuidado"/><JourneyMetric value={state.diversity||0} label="formas de cuidado"/><JourneyMetric value={unlocked.length} label="mudanças neste jardim"/></div></div>
        </section>

        <section className="rounded-[28px] border border-[#355c41] bg-[#315b3e] p-6 text-white shadow-[0_18px_45px_rgba(40,70,48,.18)]">
          <p className="text-[10px] uppercase tracking-[.22em] text-white/60">Próximo elemento</p>
          <div className="mt-5 flex items-center gap-5"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"><NextIcon className="h-10 w-10"/></div><div><h2 className="font-serif text-3xl">{next?.name??'Um novo jardim'}</h2><p className="mt-2 text-sm leading-6 text-white/70">{next?next.preview:'Este jardim amadureceu. O próximo surgirá automaticamente e será visualmente diferente.'}</p></div></div>
          {next&&<p className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-xs leading-5 text-white/70">{remainingToNext>0?`Ainda restam cerca de ${remainingToNext} sinais de cuidado até aqui — sem pressa, sem prazo.`:'Este passo já está próximo de aparecer.'}</p>}
        </section>
      </div>

      <section ref={memoriesRef} className="mt-7 scroll-mt-6 border-t border-[#dfd4c4] pt-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-3xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm leading-6 text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com atmosfera e composição diferentes. Não existe último jardim por aqui.</p></div>
        {completedGardens>0&&<p className="mt-4 text-xs text-forest-600">Você já completou <strong className="font-semibold text-forest-800">{completedGardens}</strong> {completedGardens===1?'jardim':'jardins'}. Cada um fica guardado aqui, na ordem em que aconteceu.</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{memories.map(index=><MemoryCard key={index} index={index}/>) }<div className="flex min-h-[190px] flex-col items-center justify-center rounded-[24px] border border-[#d8cebd] bg-[#f3eadc] p-5 text-center"><Sprout className="h-7 w-7 text-forest-700"/><p className="mt-3 font-serif text-lg">{state.completed_gardens>0?'Novo jardim em andamento':'Seu primeiro jardim está crescendo'}</p><p className="mt-1 text-xs text-ink-soft">Mais histórias para viver.</p></div></div>
        {allMemories.length>8&&<div className="mt-5 text-center"><button type="button" onClick={()=>setShowAllMemories(v=>!v)} className="rounded-2xl border border-[#d8cebd] bg-[#fffaf3] px-5 py-2.5 text-xs font-medium text-forest-700 transition hover:bg-[#f3eadc]">{showAllMemories?'Mostrar menos':`Ver todos os ${allMemories.length} jardins`}</button></div>}
      </section>
    </div>
  </main>
}

function ActionItem({Icon,label}:{Icon:typeof Sprout;label:string}){return <div className="text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#edf0e7] text-forest-700"><Icon className="h-5 w-5"/></div><p className="mt-2 text-[11px] font-medium text-forest-900">{label}</p></div>}
function JourneyMetric({value,label}:{value:number;label:string}){return <div className="rounded-2xl bg-white/70 px-3 py-3 text-center"><p className="font-serif text-xl text-forest-900">{value}</p><p className="mt-1 text-[10px] leading-4 text-ink-soft">{label}</p></div>}
function MemoryCard({index}:{index:number}){const t=themeFor(index);return <article className="overflow-hidden rounded-[22px] border border-[#ddd3c3] bg-[#fffaf3] shadow-sm"><div className="relative h-28 overflow-hidden"><img src={t.stages[3]} alt={t.label} loading="lazy" className="h-full w-full object-cover"/><span className="absolute left-2.5 top-2.5 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">Jardim nº {index+1}</span></div><div className="p-4"><p className="font-serif text-lg">{t.label}</p><p className="mt-1 text-xs text-ink-soft">Jardim preservado na sua história</p></div></article>}
