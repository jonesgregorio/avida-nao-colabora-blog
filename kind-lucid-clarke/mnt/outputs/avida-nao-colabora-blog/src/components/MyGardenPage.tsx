import { useEffect, useState } from 'react'
import { Bird, BookOpen, CheckCircle2, Flower2, Heart, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'
import { gardenThemeFor, gardenVisualProgress } from '../lib/gardenThemes'
import LivingGarden from './garden/LivingGarden'

interface Props { userId: string; profile?: Profile | null; onNavigatePricing?: () => void }
type GardenState = { stage:number; active_days:number; diversity:number; signals:Record<string,number>; garden_index:number; garden_progress:number; completed_gardens:number; total_growth:number; growth_model_version?:number }

const EMPTY:GardenState={stage:0,active_days:0,diversity:0,signals:{},garden_index:0,garden_progress:0,completed_gardens:0,total_growth:0}
const ELEMENTS=[
  {stage:1,name:'Primeiros brotos',why:'Alguns momentos de cuidado começaram a deixar uma marca visível.',Icon:Sprout},
  {stage:2,name:'Flores',why:'A presença recorrente trouxe mais variedade e cor ao jardim.',Icon:Flower2},
  {stage:3,name:'Árvore',why:'A continuidade criou raízes e um ponto permanente de acolhimento.',Icon:TreePine},
  {stage:4,name:'Vida',why:'Com abrigo e flores, pequenas companhias começaram a chegar.',Icon:Bird},
  {stage:5,name:'Recanto',why:'O jardim ganhou profundidade e um novo canto de pausa.',Icon:Waves},
  {stage:6,name:'Luz',why:'O espaço amadureceu e ganhou uma atmosfera própria.',Icon:Sparkles}
] as const

function themeFor(index:number){return gardenThemeFor(index)}
function memoryIndexes(completed:number){const first=Math.max(0,completed-5);return Array.from({length:completed-first},(_,i)=>first+i)}

export default function MyGardenPage({userId,profile,onNavigatePricing}:Props){
  const access=hasPlanAccess(getEffectivePlan(profile),'essential')
  const [state,setState]=useState<GardenState>(EMPTY)
  const [selected,setSelected]=useState<number|null>(null)

  useEffect(()=>{if(!access)return;let alive=true;(async()=>{const {data}=await supabase.rpc('get_my_garden_state');if(alive&&data)setState(data as GardenState)})().catch(()=>{});return()=>{alive=false}},[userId,access])

  if(!access)return <div className="mx-auto max-w-4xl px-4 py-10"><section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-forest-500"/><h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1><p className="mt-3 text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>{onNavigatePricing&&<button onClick={onNavigatePricing} className="mt-6 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm text-white">Ver planos</button>}</section></div>

  const stage=Math.max(0,Math.min(6,state.stage||0))
  const gardenIndex=Math.max(0,state.garden_index||0)
  const theme=themeFor(gardenIndex)
  const unlocked=ELEMENTS.filter(e=>stage>=e.stage)
  const detail=selected?ELEMENTS.find(e=>e.stage===selected):unlocked[unlocked.length-1]
  const next=ELEMENTS.find(e=>e.stage>stage)
  const NextIcon=next?.Icon??Sparkles
  const memories=memoryIndexes(Math.max(0,state.completed_gardens||0))
  const visualProgress=Math.max(0,Math.min(100,Math.round((state.garden_progress||0)/60*100)))
  const gardenProgress=gardenVisualProgress(state.garden_progress||0)

  return <main className="min-h-full bg-[#f7f0e5] text-forest-950">
    <section className="relative overflow-hidden border-b border-[#ded3c3] bg-[#efe4d4]">
      <LivingGarden theme={theme} progress={gardenProgress}/>
      <div className="relative z-10 mx-auto min-h-[760px] max-w-[1240px] px-5 py-10 sm:px-8 lg:min-h-[820px] lg:px-10 lg:py-12">
        <div className="max-w-[520px] rounded-[30px] border border-white/35 bg-[#fffaf1]/72 p-7 shadow-[0_24px_80px_rgba(47,62,43,.12)] backdrop-blur-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-forest-700">Meu Jardim</p>
          <h1 className="mt-3 font-serif text-5xl leading-[.98] text-[#173e2d] sm:text-6xl">Um espaço<br/>que cresce com você</h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-[#5f655f]">Sua trajetória ganha forma aos poucos. Cada pequeno cuidado importa e, com o tempo, transforma este espaço em vida, beleza e presença.</p>
          <p className="mt-6 font-serif text-xl italic text-forest-700">Cuidar de si também é construir um lugar melhor para ficar.</p>
        </div>

        <div className="absolute right-5 top-10 hidden w-[330px] rounded-[28px] border border-white/65 bg-[#fffdf8]/88 p-6 shadow-[0_24px_70px_rgba(41,60,45,.14)] backdrop-blur-md md:block lg:right-10">
          <Sparkles className="h-7 w-7 text-forest-700"/><p className="mt-6 text-center font-serif text-xl leading-8 text-forest-950">Todo progresso,<br/>por menor que pareça,<br/>também floresce.</p>
        </div>

        <div className="absolute bottom-8 left-5 right-5 lg:left-auto lg:right-10 lg:w-[500px]">
          <section className="rounded-[30px] border border-white/70 bg-[#fffdf9]/94 p-6 shadow-[0_28px_80px_rgba(35,52,38,.18)] backdrop-blur-md sm:p-7">
            <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#e8eadf]"><Sprout className="h-5 w-5 text-forest-700"/></div><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-500">Jardim atual</p><p className="mt-1 font-serif text-2xl">{theme.label}</p><p className="mt-1 text-xs text-ink-soft">{stage===6?'Maduro':'Em evolução'}</p></div></div><div className="rounded-full border border-[#dde2d6] bg-[#f1f3ec] px-3 py-1.5 text-[10px] font-medium text-forest-700">Crescimento contínuo</div></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7e3d8]"><div className="h-full rounded-full bg-gradient-to-r from-[#315d3f] to-[#8da37c] transition-[width] duration-700" style={{width:`${visualProgress}%`}}/></div>
            <div className="mt-5 grid grid-cols-6 gap-2">{ELEMENTS.map(({stage:itemStage,name,Icon})=>{const active=stage>=itemStage;return <button key={itemStage} type="button" onClick={()=>{if(active)setSelected(itemStage)}} className="group text-center" aria-label={active?`Ver ${name}`:`${name} ainda não apareceu`}><span className={`mx-auto grid h-11 w-11 place-items-center rounded-full border transition ${active?'border-[#d9ddcf] bg-[#eef0e8] text-forest-700':'border-[#e9e4d9] bg-[#f8f5ef] text-[#bbb9ad]'}`}><Icon className="h-4 w-4"/></span><span className={`mt-2 block text-[10px] ${active?'text-forest-800':'text-[#aaa79d]'}`}>{name}</span></button>})}</div>
            <p className="mt-5 text-center font-serif text-sm italic text-[#74766f]">{detail?.why??'O jardim está começando a criar raízes.'}</p>
          </section>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[28px] border border-[#e0d8ca] bg-[#fffaf3] p-6 shadow-[0_14px_40px_rgba(47,61,43,.07)]">
          <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Ações que fazem seu jardim crescer</h2><p className="mt-1 text-xs text-ink-soft">Diferentes áreas do AVNC contribuem para o jardim. Sem streak, sem placar e sem punição.</p></div><Heart className="hidden h-6 w-6 text-forest-500 sm:block"/></div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6"><ActionItem Icon={CheckCircle2} label="Check-in"/><ActionItem Icon={BookOpen} label="Diário"/><ActionItem Icon={Sparkles} label="Relatórios"/><ActionItem Icon={Sprout} label="Plano de Autocuidado"/><ActionItem Icon={Flower2} label="Conteúdos"/><ActionItem Icon={TreePine} label="Marcos"/></div>
          <div className="mt-6 rounded-[22px] border border-[#e3ddcf] bg-[#f7f3ea] p-4"><p className="font-serif text-lg text-forest-900">Um ritmo mais equilibrado</p><p className="mt-1 text-xs leading-5 text-ink-soft">Dias com Check-ins ou Diário formam a base. Relatórios, marcos e outras formas de cuidado complementam o crescimento. Um Check-in isolado não cria uma transformação e o jardim não mede produtividade.</p><div className="mt-4 grid grid-cols-3 gap-2"><JourneyMetric value={state.active_days||0} label="dias de cuidado"/><JourneyMetric value={state.diversity||0} label="formas de cuidado"/><JourneyMetric value={unlocked.length} label="mudanças neste jardim"/></div></div>
        </section>

        <section className="rounded-[28px] border border-[#355c41] bg-[#315b3e] p-6 text-white shadow-[0_18px_45px_rgba(40,70,48,.18)]">
          <p className="text-[10px] uppercase tracking-[.22em] text-white/60">Próximo elemento</p>
          <div className="mt-5 flex items-center gap-5"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10"><NextIcon className="h-10 w-10"/></div><div><h2 className="font-serif text-3xl">{next?.name??'Um novo jardim'}</h2><p className="mt-2 text-sm leading-6 text-white/70">{next?'Seu jardim ainda está criando espaço para essa transformação.':'Este jardim amadureceu. O próximo surgirá automaticamente e será visualmente diferente.'}</p></div></div>
        </section>
      </div>

      <section className="mt-7 border-t border-[#dfd4c4] pt-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-3xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm leading-6 text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com atmosfera e composição diferentes. Não existe último jardim por aqui.</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{memories.map(index=><MemoryCard key={index} index={index}/>) }<div className="flex min-h-[190px] flex-col items-center justify-center rounded-[24px] border border-[#d8cebd] bg-[#f3eadc] p-5 text-center"><Sprout className="h-7 w-7 text-forest-700"/><p className="mt-3 font-serif text-lg">{state.completed_gardens>0?'Novo jardim em andamento':'Seu primeiro jardim está crescendo'}</p><p className="mt-1 text-xs text-ink-soft">Mais histórias para viver.</p></div></div>
      </section>
    </div>
  </main>
}

function ActionItem({Icon,label}:{Icon:typeof Sprout;label:string}){return <div className="text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#edf0e7] text-forest-700"><Icon className="h-5 w-5"/></div><p className="mt-2 text-[11px] font-medium text-forest-900">{label}</p></div>}
function JourneyMetric({value,label}:{value:number;label:string}){return <div className="rounded-2xl bg-white/70 px-3 py-3 text-center"><p className="font-serif text-xl text-forest-900">{value}</p><p className="mt-1 text-[10px] leading-4 text-ink-soft">{label}</p></div>}
function MemoryCard({index}:{index:number}){const t=themeFor(index);return <article className="overflow-hidden rounded-[22px] border border-[#ddd3c3] bg-[#fffaf3] shadow-sm"><div className="relative h-28 overflow-hidden"><img src={t.stages[3]} alt={t.label} loading="lazy" className="h-full w-full object-cover"/></div><div className="p-4"><p className="font-serif text-lg">{t.label}</p><p className="mt-1 text-xs text-ink-soft">Jardim preservado na sua história</p></div></article>}
