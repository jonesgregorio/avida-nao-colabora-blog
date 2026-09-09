import { useEffect, useState } from 'react'
import { Bird, BookOpen, CheckCircle2, ChevronRight, Flower2, Heart, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'

interface Props { userId:string; profile?:Profile|null; onNavigatePricing?:()=>void }
type GardenState={stage:number;active_days:number;diversity:number;signals:{checkin_days:number;diary_days:number;questionnaire_days:number;content_days:number;care_days:number;helped:number;milestones:number;reports:number}}
const EMPTY:GardenState={stage:0,active_days:0,diversity:0,signals:{checkin_days:0,diary_days:0,questionnaire_days:0,content_days:0,care_days:0,helped:0,milestones:0,reports:0}}
const CHAPTERS=[
 ['Primeiros brotos','O solo começa a guardar sinais da sua presença.'],
 ['O jardim ganha forma','Pequenos cuidados começam a encontrar lugar.'],
 ['Um espaço acolhedor','Flores e caminhos revelam uma jornada mais diversa.'],
 ['O jardim recebe vida','Quando há abrigo e flores, os visitantes chegam naturalmente.'],
 ['Novos cantos','O espaço ganha profundidade, sombra e lugares de pausa.'],
 ['Jardim de luz','Seu jardim amadurece sem deixar de ser leve.'],
 ['Um jardim que é seu','O cuidado virou paisagem — e ela continua crescendo com você.'],
] as const
const ELEMENTS=[
 {stage:1,name:'Primeiros brotos',why:'Sua presença voltou em dias diferentes e por mais de uma forma.',Icon:Sprout},
 {stage:2,name:'Canteiro de flores',why:'Registros e momentos de reflexão trouxeram variedade ao seu jardim.',Icon:Flower2},
 {stage:3,name:'Árvore de cuidado',why:'A constância criou raízes e um ponto permanente de acolhimento.',Icon:TreePine},
 {stage:4,name:'Visitantes',why:'Um jardim com abrigo e flores começa a receber pequenas companhias.',Icon:Bird},
 {stage:5,name:'Recanto de água',why:'Diferentes formas de cuidado abriram espaço para um novo canto de pausa.',Icon:Waves},
 {stage:6,name:'Luz do jardim',why:'Sua jornada ganhou continuidade, variedade e novas camadas.',Icon:Sparkles},
]
function sumSignals(s:GardenState['signals']){return Object.values(s).reduce((a,b)=>a+b,0)}

export default function MyGardenPage({userId,profile,onNavigatePricing}:Props){
 const access=hasPlanAccess(getEffectivePlan(profile),'essential')
 const[state,setState]=useState<GardenState>(EMPTY)
 const[loading,setLoading]=useState(true)
 const[selected,setSelected]=useState<number|null>(null)
 useEffect(()=>{if(!access){setLoading(false);return}let alive=true;supabase.rpc('get_my_garden_state').then(({data})=>{if(alive&&data)setState(data as GardenState)}).finally(()=>alive&&setLoading(false));return()=>{alive=false}},[userId,access])
 if(!access)return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10"><section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center"><LockKeyhole className="mx-auto h-9 w-9 text-forest-500"/><h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1><p className="mx-auto mt-3 max-w-xl text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>{onNavigatePricing&&<button onClick={onNavigatePricing} className="mt-6 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm font-medium text-white">Ver planos</button>}</section></div>
 const stage=Math.max(0,Math.min(6,state.stage||0)), chapter=CHAPTERS[stage], unlocked=ELEMENTS.filter(e=>stage>=e.stage), detail=selected?ELEMENTS.find(e=>e.stage===selected):unlocked.at(-1)
 const meaningful=sumSignals(state.signals)
 return <div className="min-h-full bg-[#faf6ee] text-forest-950"><style>{`
 @keyframes leafSway{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1.5deg)}}
 @keyframes butterflyHop{0%,18%{transform:translate(0,0) rotate(-8deg)}45%{transform:translate(54px,-26px) rotate(8deg)}72%,100%{transform:translate(92px,2px) rotate(-5deg)}}
 @keyframes waterGlow{0%,100%{opacity:.45}50%{opacity:.8}}
 .garden-tree{transform-origin:50% 100%;animation:leafSway 7s ease-in-out infinite}.garden-butterfly{animation:butterflyHop 12s ease-in-out infinite alternate}.garden-water{animation:waterGlow 5s ease-in-out infinite}
 @media(prefers-reduced-motion:reduce){.garden-tree,.garden-butterfly,.garden-water{animation:none!important}}
 `}</style><main className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8">
  <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Seu espaço vivo</p><h1 className="mt-1 font-serif text-4xl sm:text-5xl text-forest-900">Meu Jardim</h1><p className="mt-2 text-sm text-ink-soft">Um espaço que cresce junto com a sua jornada.</p></div><p className="max-w-sm font-serif italic text-forest-700 sm:text-right">“Cada pequeno cuidado de hoje ajuda a construir um amanhã mais leve.”</p></header>

  <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
   <section className="relative min-h-[520px] overflow-hidden rounded-[34px] border border-[#d8d0c2] bg-[linear-gradient(#dfeceb_0%,#eef2df_42%,#b9ce9d_43%,#8eaf72_100%)] shadow-[0_18px_50px_rgba(36,70,49,.10)]" aria-label={`Capítulo atual: ${chapter[0]}`}>
    <div className="absolute inset-x-0 top-0 h-[44%] bg-[radial-gradient(circle_at_78%_25%,rgba(255,245,193,.9),transparent_14%),linear-gradient(180deg,rgba(255,255,255,.55),transparent)]"/>
    <div className="absolute left-5 top-5 z-30 rounded-2xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm backdrop-blur"><p className="text-[10px] uppercase tracking-[.16em] text-forest-600">Capítulo atual</p><p className="mt-1 font-serif text-xl text-forest-900">{chapter[0]}</p><p className="mt-1 max-w-[250px] text-xs text-ink-soft">{chapter[1]}</p></div>
    <div className="absolute inset-x-0 bottom-0 h-[58%] rounded-t-[48%] bg-[radial-gradient(ellipse_at_50%_90%,#9fbc7f_0%,#89aa6d_55%,#78985f_100%)]"/>
    {stage>=1&&<><div className="absolute bottom-[7%] left-[4%] right-[4%] h-[18%] rounded-[50%] bg-[#77965f]/45"/><div className="absolute bottom-[9%] left-[8%] flex gap-2"><i className="h-7 w-3 rounded-full bg-[#42633e]"/><i className="mt-2 h-6 w-3 rounded-full bg-[#55764b]"/><i className="h-8 w-3 rounded-full bg-[#3f6842]"/></div></>}
    {stage>=2&&<div className="absolute bottom-[8%] left-[13%] z-10 flex items-end gap-2" aria-label="Canteiro de flores"><span className="h-16 w-16 rounded-[55%_45%_55%_45%] bg-[#f2e2c0] shadow-[18px_-8px_0_#d7b9a5,36px_3px_0_#eee6d1,-18px_4px_0_#d9c6a7]"/><span className="h-10 w-10 rounded-full bg-[#c8a6b8] shadow-[14px_-12px_0_#e8d7c5]"/></div>}
    {stage>=3&&<div className="garden-tree absolute bottom-[20%] left-[8%] z-10 h-[310px] w-[270px]" aria-label="Árvore de cuidado"><div className="absolute bottom-0 left-[118px] h-[185px] w-12 rounded-[55%_45%_30%_30%] bg-[#74543b] shadow-[inset_10px_0_0_rgba(255,255,255,.12)]"/><div className="absolute left-5 top-3 h-44 w-44 rounded-full bg-[#496c48] shadow-[75px_20px_0_#55794e,35px_-35px_0_#66865a,100px_75px_0_#3f6544]"/></div>}
    {stage>=3&&<div className="absolute bottom-[8%] left-[34%] h-16 w-[42%] rotate-[-5deg] rounded-[50%] bg-[#d8c9a7] opacity-90" aria-label="Caminho do jardim"/>}
    {stage>=4&&<><Bird className="absolute left-[23%] top-[34%] z-20 h-6 w-6 text-[#324f40]"/><div className="garden-butterfly absolute bottom-[29%] left-[48%] z-20 h-4 w-5 rotate-12 rounded-[80%_20%] bg-[#c27a48] shadow-[7px_0_0_#d89a56]" aria-label="Borboleta entre os canteiros"/></>}
    {stage>=5&&<div className="garden-water absolute bottom-[7%] right-[8%] z-10 h-24 w-[30%] rounded-[50%] border-4 border-white/35 bg-[#79aaa3] shadow-[inset_0_8px_20px_rgba(255,255,255,.28)]" aria-label="Recanto de água"><span className="absolute left-[30%] top-[30%] h-3 w-16 rounded-full bg-white/40"/></div>}
    {stage>=5&&<div className="absolute bottom-[16%] left-[43%] z-20 h-14 w-28 rounded-t-xl border-b-[7px] border-[#684c38] bg-[#9a7351]" aria-label="Banco junto ao caminho"/>}
    {stage>=6&&<><div className="absolute bottom-[20%] right-[25%] z-20 h-24 w-2 bg-[#554a3c]"/><div className="absolute bottom-[38%] right-[23.5%] z-20 h-10 w-8 rounded-lg border-2 border-[#65513c] bg-[#f1d48b]/80 shadow-[0_0_24px_#f1d48b]"/></>}
    {stage===0&&<div className="absolute inset-x-0 bottom-[17%] z-20 mx-auto w-[min(86%,430px)] rounded-3xl border border-white/70 bg-white/85 p-6 text-center backdrop-blur"><Sprout className="mx-auto h-8 w-8 text-forest-600"/><p className="mt-3 font-serif text-xl text-forest-900">Seu jardim está preparando o solo</p><p className="mt-2 text-sm leading-6 text-ink-soft">Ele não cresce por um gesto isolado. Com o tempo, diferentes formas de cuidado deixam marcas por aqui.</p></div>}
   </section>

   <aside className="space-y-4"><section className="rounded-[26px] border border-line bg-white p-5"><h2 className="font-serif text-xl text-forest-900">Sua jornada</h2><div className="mt-4 space-y-3"><Stat Icon={Heart} value={state.active_days} label="dias de cuidado"/><Stat Icon={Sparkles} value={state.diversity} label="formas de cuidado"/><Stat Icon={Sprout} value={unlocked.length} label="elementos no jardim"/></div></section><section className="rounded-[26px] border border-[#e6dcc8] bg-[#fff8e9] p-5"><Sprout className="h-5 w-5 text-forest-700"/><p className="mt-3 font-medium text-forest-900">Seu jardim cresce sem pressa.</p><p className="mt-2 text-xs leading-5 text-ink-soft">Não há sequência para manter nem pontos para conquistar. Constância e variedade ajudam o espaço a ganhar vida — e nada aqui murcha se você precisar se afastar.</p></section></aside>
  </div>

  <section className="mt-6 rounded-[30px] border border-line bg-white p-5 sm:p-7"><div className="flex items-end justify-between gap-4"><div><h2 className="font-serif text-2xl text-forest-900">Evolução do seu jardim</h2><p className="mt-1 text-sm text-ink-soft">Veja como o mesmo espaço ganha novas camadas ao longo da sua jornada.</p></div><span className="hidden text-xs text-ink-soft sm:block">Capítulo {stage+1} de {CHAPTERS.length}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">{CHAPTERS.map((c,i)=><div key={c[0]} className={`rounded-2xl border p-3 ${i===stage?'border-forest-600 bg-[#eef4ea]':i<stage?'border-[#d7e3d2] bg-white':'border-line bg-[#faf8f3] opacity-55'}`}><div className="mb-3 flex h-14 items-end rounded-xl bg-gradient-to-b from-[#e6efea] to-[#a9c18f] p-2">{i<=stage?<Sprout className="h-5 w-5 text-forest-800"/>:<LockKeyhole className="h-4 w-4 text-ink-soft"/>}</div><p className="text-[11px] font-semibold leading-4 text-forest-900">{i+1}. {c[0]}</p></div>)}</div></section>

  <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-[.16em] text-forest-600">O que ganhou vida</p>{detail?<><div className="mt-4 flex items-start gap-4"><div className="rounded-2xl bg-[#eef4ea] p-4"><detail.Icon className="h-8 w-8 text-forest-700"/></div><div><div className="flex items-center gap-2"><h3 className="font-serif text-xl text-forest-900">{detail.name}</h3>{detail.stage===stage&&<span className="rounded-full bg-[#dfeee0] px-2 py-1 text-[10px] font-semibold text-forest-800">Mais recente</span>}</div><p className="mt-2 text-sm leading-6 text-ink-soft">{detail.why}</p></div></div><div className="mt-5 flex flex-wrap gap-2">{unlocked.map(e=><button key={e.stage} onClick={()=>setSelected(e.stage)} className={`rounded-full border px-3 py-1.5 text-xs ${selected===e.stage?'border-forest-700 bg-forest-900 text-white':'border-line text-forest-800'}`}>{e.name}</button>)}</div></>:<p className="mt-4 text-sm leading-6 text-ink-soft">Continue usando o AVNC do seu jeito. Quando houver uma combinação de presença e diferentes formas de cuidado, o primeiro broto aparecerá.</p>}</section>
   <section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-[.16em] text-forest-600">Como ele entende sua jornada</p><h3 className="mt-2 font-serif text-xl text-forest-900">Cuidado, não desempenho</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Check-ins, Diário, questionários, conteúdos, Plano Vivo, marcos e relatórios podem contribuir. Mas uma ação sozinha nunca cria um elemento: o jardim observa dias diferentes e variedade de cuidado.</p><div className="mt-5 grid grid-cols-2 gap-3"><Mini Icon={CheckCircle2} label="Sem streak"/><Mini Icon={Heart} label="Sem punição"/><Mini Icon={BookOpen} label="Diversidade importa"/><Mini Icon={Sparkles} label={`${meaningful} sinais acolhidos`}/></div></section>
  </div>
  <p className="mt-6 text-center text-xs text-ink-soft">Seu jardim não mede produtividade. Ele é uma representação gentil da sua trajetória de cuidado.</p>
 </main></div>
}
function Stat({Icon,value,label}:{Icon:typeof Sprout;value:number;label:string}){return <div className="flex items-center gap-3 rounded-2xl bg-[#faf8f3] p-3"><span className="rounded-xl bg-[#e4efe2] p-2"><Icon className="h-4 w-4 text-forest-700"/></span><div><p className="font-serif text-xl leading-none text-forest-900">{value}</p><p className="mt-1 text-[11px] text-ink-soft">{label}</p></div></div>}
function Mini({Icon,label}:{Icon:typeof Sprout;label:string}){return <div className="flex items-center gap-2 rounded-xl bg-[#faf8f3] p-3 text-xs text-forest-800"><Icon className="h-4 w-4 shrink-0"/><span>{label}</span><ChevronRight className="ml-auto h-3 w-3 opacity-40"/></div>}
