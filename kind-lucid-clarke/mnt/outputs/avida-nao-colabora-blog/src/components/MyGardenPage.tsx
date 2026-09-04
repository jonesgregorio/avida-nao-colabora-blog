import { useEffect, useMemo, useState, type ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import { Bird, ChevronLeft, ChevronRight, Flower2, Leaf, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'

interface Props { userId:string; profile?: Profile | null; onNavigatePricing?: () => void }
type Counts={activeDays:number;reports:number;milestones:number}
type GardenKind='Plantas'|'Visitantes'|'Detalhes'
type GardenItem={icon:string;label:string;at:number;kind:GardenKind}

const CYCLE_SIZE=60
const UNLOCK_STEPS=[1,7,14,21,29,37,46,55]
const THEMES=[
  {name:'Primeiros brotos',subtitle:'Um pequeno espaço começa a ganhar vida.',ground:'from-[#f8f2e7] via-[#edf3e8] to-[#dce8cf]'},
  {name:'Jardim florido',subtitle:'Novas cores encontram lugar no seu caminho.',ground:'from-[#fbf3e9] via-[#f3eee1] to-[#dce7cf]'},
  {name:'Jardim dos visitantes',subtitle:'O jardim começa a receber pequenas companhias.',ground:'from-[#f4f1e8] via-[#e8f0e5] to-[#d6e3c9]'},
  {name:'Caminhos de calma',subtitle:'Novos cantos aparecem entre folhas e caminhos.',ground:'from-[#f8f0e5] via-[#eaf0e6] to-[#cedfc8]'},
  {name:'Bosque leve',subtitle:'Árvores e sombras criam um novo pedaço do jardim.',ground:'from-[#f5efe6] via-[#e5eee5] to-[#c9ddc4]'},
  {name:'Jardim de luz',subtitle:'A paisagem muda, mas continua sendo sua.',ground:'from-[#fbf5e8] via-[#edf1df] to-[#d7e1c4]'},
]
const PLANTS=[['🌱','Broto'],['🌼','Margaridas'],['🌿','Folhagens'],['🌷','Tulipas'],['🌳','Árvore'],['🌸','Flores'],['🌻','Girassóis'],['🌾','Capim dourado'],['🪻','Flores silvestres'],['🍀','Trevos']]
const VISITORS=[['🦋','Borboleta'],['🐦','Pássaro'],['🐝','Abelha'],['🐞','Joaninha'],['🕊️','Ave branca'],['🪶','Visitante alado']]
const DETAILS=[['🪨','Pedras do caminho'],['🪵','Banco do jardim'],['🍄','Cogumelos'],['💧','Pequeno lago'],['🏮','Lanterna'],['🌙','Luz da noite'],['☀️','Raio de sol'],['🍂','Folhas no caminho']]

function pick<T>(items:T[],seed:number){return items[((seed%items.length)+items.length)%items.length]}
function cycleLabel(index:number){return index===0?'Seu primeiro jardim':`Jardim ${index+1}`}
function buildCycleItems(index:number):GardenItem[]{
  const rows:Array<{pool:string[][];kind:GardenKind}>=[
    {pool:PLANTS,kind:'Plantas'},{pool:PLANTS,kind:'Plantas'},{pool:DETAILS,kind:'Detalhes'},{pool:VISITORS,kind:'Visitantes'},
    {pool:PLANTS,kind:'Plantas'},{pool:DETAILS,kind:'Detalhes'},{pool:VISITORS,kind:'Visitantes'},{pool:DETAILS,kind:'Detalhes'},
  ]
  return rows.map((row,i)=>{const [icon,base]=pick(row.pool,index*3+i*2);return{icon,label:index===0?base:`${base} · ${cycleLabel(index)}`,at:UNLOCK_STEPS[i],kind:row.kind}})
}
async function countRows(table:string,userId:string,extra?:{column:string;value:string}){let q=supabase.from(table).select('id',{count:'exact',head:true}).eq('user_id',userId);if(extra)q=q.eq(extra.column,extra.value);const{count}=await q;return count??0}
async function loadCounts(userId:string):Promise<Counts>{const[{data:diary},reports,milestones]=await Promise.all([supabase.from('diary_entries').select('date,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(5000),countRows('reports',userId),countRows('user_history_items',userId,{column:'item_type',value:'milestone'})]);const rows=(diary??[]) as Array<{date:string|null;created_at:string}>;return{activeDays:new Set(rows.map(r=>r.date||r.created_at.slice(0,10))).size,reports,milestones}}

export default function MyGardenPage({userId,profile,onNavigatePricing}:Props){
  const hasAccess=hasPlanAccess(getEffectivePlan(profile),'essential')
  const[counts,setCounts]=useState<Counts>({activeDays:0,reports:0,milestones:0})
  const[collection,setCollection]=useState(false)
  const[history,setHistory]=useState(false)
  const[selectedCycle,setSelectedCycle]=useState<number|null>(null)
  useEffect(()=>{if(!hasAccess)return;let alive=true;loadCounts(userId).then(v=>alive&&setCounts(v)).catch(()=>{});return()=>{alive=false}},[userId,hasAccess])

  const growth=counts.activeDays+counts.reports*2+counts.milestones*3
  const currentCycle=Math.floor(growth/CYCLE_SIZE)
  const cycleProgress=growth%CYCLE_SIZE
  const theme=THEMES[currentCycle%THEMES.length]
  const items=useMemo(()=>buildCycleItems(currentCycle),[currentCycle])
  const unlocked=useMemo(()=>items.filter(item=>cycleProgress>=item.at),[items,cycleProgress])
  const latest=unlocked.length?unlocked[unlocked.length-1]:items[0]

  if(!hasAccess){
    return <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10"><section className="rounded-[30px] border border-line bg-paper-soft p-8 text-center"><Sprout className="mx-auto h-10 w-10 text-forest-500"/><h1 className="mt-4 font-serif text-3xl text-forest-900">Meu Jardim</h1><p className="mx-auto mt-3 max-w-xl text-sm text-ink-soft">Seu espaço cresce junto com sua jornada. Disponível a partir do plano Essencial.</p>{onNavigatePricing&&<button type="button" onClick={onNavigatePricing} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-forest-900 px-5 py-2.5 text-sm font-medium text-white">Ver planos</button>}</section></div>
  }
  const lush=Math.min(5,Math.floor(cycleProgress/12)+1)
  const stats:Array<[ComponentType<LucideProps>,GardenKind,number,number]>=[[Sprout,'Plantas',unlocked.filter(i=>i.kind==='Plantas').length,items.filter(i=>i.kind==='Plantas').length],[Bird,'Visitantes',unlocked.filter(i=>i.kind==='Visitantes').length,items.filter(i=>i.kind==='Visitantes').length],[Sparkles,'Detalhes',unlocked.filter(i=>i.kind==='Detalhes').length,items.filter(i=>i.kind==='Detalhes').length]]
  const viewedCycle=selectedCycle??currentCycle
  const viewedItems=buildCycleItems(viewedCycle)
  const viewedProgress=viewedCycle<currentCycle?CYCLE_SIZE:viewedCycle===currentCycle?cycleProgress:0
  const viewedTheme=THEMES[viewedCycle%THEMES.length]
  const sceneItems=unlocked.filter(item=>item.kind!=='Visitantes').slice(0,6)
  const visitor=unlocked.find(item=>item.kind==='Visitantes')
  const secondaryVisitor=unlocked.filter(item=>item.kind==='Visitantes')[1]
  const sceneSeed=currentCycle*37+11

  return <div className="min-h-full bg-[#fbf7ef] text-forest-950"><style>{`
    @keyframes garden-sway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
    @keyframes garden-float{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(8px,-9px,0)}}
    @keyframes garden-fly{0%{transform:translate3d(-12vw,12px,0) rotate(-6deg)}35%{transform:translate3d(18vw,-28px,0) rotate(5deg)}70%{transform:translate3d(38vw,8px,0) rotate(-3deg)}100%{transform:translate3d(58vw,-16px,0) rotate(4deg)}}
    @keyframes garden-ripple{0%,100%{transform:scale(.96);opacity:.5}50%{transform:scale(1.04);opacity:.9}}
    @keyframes garden-glow{0%,100%{opacity:.25;transform:scale(.95)}50%{opacity:.75;transform:scale(1.08)}}
    .garden-sway{transform-origin:50% 100%;animation:garden-sway 5.5s ease-in-out infinite}
    .garden-float{animation:garden-float 4.8s ease-in-out infinite}
    .garden-fly{animation:garden-fly 14s ease-in-out infinite alternate}
    .garden-ripple{animation:garden-ripple 4s ease-in-out infinite}
    .garden-glow{animation:garden-glow 5s ease-in-out infinite}
    @media (prefers-reduced-motion: reduce){.garden-sway,.garden-float,.garden-fly,.garden-ripple,.garden-glow{animation:none!important;transform:none!important}}
  `}</style><div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 lg:px-8">
    <header className="text-center"><p className="text-xs uppercase tracking-[.2em] text-forest-600">Seu espaço vivo</p><h1 className="mt-1 font-serif text-4xl sm:text-5xl text-forest-900">Meu Jardim</h1><p className="mt-2 text-sm text-ink-soft">Cada cuidado deixa uma marca.</p></header>

    <section className={`relative mt-6 min-h-[470px] overflow-hidden rounded-[34px] border border-[#dcd3c4] bg-gradient-to-b ${theme.ground} shadow-[0_18px_50px_rgba(36,70,49,.10)]`} aria-label={`${cycleLabel(currentCycle)}: ${theme.name}`}>
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.95),transparent_70%)]"/>
      <div className="garden-sway absolute text-[108px] sm:text-[150px] drop-shadow-sm select-none" style={{left:`${5+(sceneSeed%12)}%`,top:`${9+(sceneSeed%6)}%`}} aria-hidden>{pick(['🌳','🌲','🌿','🌳'],currentCycle)}</div>
      {cycleProgress>=46&&<div className="garden-sway absolute text-[102px] sm:text-[142px] select-none" style={{right:`${5+((sceneSeed+7)%12)}%`,top:`${11+((sceneSeed+3)%7)}%`,animationDelay:'-2.4s'}} aria-hidden>{pick(['🌸','🌳','🌻','🌲'],currentCycle+2)}</div>}
      <div className="absolute left-[2%] right-[2%] bottom-0 h-[48%] rounded-t-[50%] bg-[#b9ce9d]/70"/><div className="absolute bottom-[3%] h-[42%] w-[23%] rotate-[18deg] rounded-[50%] bg-[#e7d9b8] opacity-80" style={{left:`${12+(sceneSeed%18)}%`}}/>
      {cycleProgress>=55&&<div className="absolute bottom-[9%] h-24 w-44 rounded-[50%] border-4 border-white/50 bg-[#8bb6ac] shadow-inner" style={{right:`${12+((sceneSeed+5)%20)}%`}}><Waves className="garden-ripple m-auto mt-7 text-white/80"/></div>}
      {sceneItems.map((item,i)=>{const left=8+((sceneSeed+i*19)%78),bottom=8+((sceneSeed+i*11)%25),size=32+((sceneSeed+i*7)%20);return <span key={`${item.label}-${i}`} className={`absolute select-none ${item.kind==='Plantas'?'garden-sway':'garden-float'}`} style={{left:`${left}%`,bottom:`${bottom}%`,fontSize:`${size}px`,animationDelay:`-${(i%4)*1.1}s`}} aria-hidden>{item.icon}</span>})}
      <div className="absolute bottom-[5%] left-[5%] right-[5%] flex flex-wrap items-end justify-center gap-1 text-4xl sm:text-5xl select-none" aria-hidden>{Array.from({length:7+lush*3},(_,i)=><span className="garden-sway inline-block" style={{animationDelay:`-${(i%5)*.7}s`}} key={i}>{pick(['🌿','🌼','🌱','🌷','🌾','🪻'],currentCycle+i)}</span>)}</div>
      {visitor&&<div className="garden-fly absolute left-[10%] top-[42%] z-10 text-4xl select-none" aria-hidden>{visitor.icon}</div>}
      {secondaryVisitor&&<div className="garden-float absolute right-[17%] top-[28%] z-10 text-3xl select-none" style={{animationDelay:'-1.8s'}} aria-hidden>{secondaryVisitor.icon}</div>}
      {currentCycle%3===2&&cycleProgress>=29&&<div className="garden-glow absolute right-[14%] top-[18%] h-20 w-20 rounded-full bg-white/40 blur-xl" aria-hidden/>}
      <div className="absolute left-1/2 top-5 w-[min(88%,340px)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/80 px-5 py-3 text-center shadow-sm backdrop-blur"><p className="text-xs font-medium text-forest-700">{cycleLabel(currentCycle)}</p><p className="mt-0.5 text-sm font-semibold text-forest-900">{theme.name}</p><p className="mt-1 text-[11px] text-ink-soft">{theme.subtitle}</p></div>
    </section>

    <section className="relative z-10 mx-auto -mt-8 max-w-3xl rounded-[28px] border border-line bg-white/95 p-5 shadow-lg sm:p-7"><div className="flex items-center gap-2" aria-label="Progresso visual do jardim">{[0,1,2,3,4].map(i=><span key={i} className={`h-3 flex-1 rounded-full ${cycleProgress>=i*12?'bg-forest-700':'bg-[#e5dfd4]'}`}/>)}</div><p className="mt-3 text-center text-sm text-ink-soft">{currentCycle>0?`${currentCycle} ${currentCycle===1?'jardim já floresceu':'jardins já floresceram'} na sua história.`:'Você está construindo algo bonito.'}</p><div className="mt-5 flex flex-col gap-4 rounded-2xl bg-[#fbf7ef] p-4 sm:flex-row sm:items-center"><span className="text-5xl" aria-hidden>{latest.icon}</span><div className="flex-1"><p className="text-sm font-semibold text-forest-900">{unlocked.length?`${latest.label.split(' · ')[0]} apareceu no seu jardim`:'Um novo jardim está começando'}</p><p className="mt-1 text-xs leading-5 text-ink-soft">Seu jardim cresce com interações significativas. Cada novo jardim muda a combinação, a posição e o movimento dos elementos. Quando este florescer por completo, outro espaço começa automaticamente.</p></div><div className="flex gap-2"><button type="button" onClick={()=>setCollection(true)} className="rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-medium text-white">Ver coleção</button>{currentCycle>0&&<button type="button" onClick={()=>{setSelectedCycle(currentCycle-1);setHistory(true)}} className="rounded-xl border border-line bg-white px-4 py-2.5 text-xs font-medium text-forest-900">Jardins anteriores</button>}</div></div></section>

    <div className="mt-5 grid grid-cols-3 gap-3 max-w-3xl mx-auto">{stats.map(([Icon,label,n,total])=><button key={label} type="button" onClick={()=>setCollection(true)} aria-label={`${label}: ${n} de ${total} descobertos neste jardim. Ver coleção`} className="rounded-2xl border border-line bg-white p-4 text-center transition-colors hover:bg-mint/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300"><Icon className="mx-auto h-5 w-5 text-forest-700"/><p className="mt-2 text-xs font-medium">{label}</p><p className="mt-1 text-[11px] font-medium text-forest-800">{n} de {total} descobertos</p><p className="mt-1 text-[10px] text-ink-soft">Neste jardim · toque para ver</p></button>)}</div>
    <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-5 text-ink-soft">Não existe sequência obrigatória. Se você se afastar, nada morre, diminui ou é perdido. O sistema não termina: quando um jardim amadurece, outro começa e traz novas combinações para descobrir.</p>
  </div>

  {collection&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/30 p-0 sm:items-center sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setCollection(false)}}><div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-[#fffdf8] p-5 shadow-2xl sm:rounded-[28px] sm:p-7"><div className="flex items-start justify-between gap-4"><div><h2 className="font-serif text-2xl text-forest-900">Coleção deste jardim</h2><p className="mt-1 text-xs text-ink-soft">{cycleLabel(currentCycle)} · {theme.name}</p><p className="mt-2 max-w-md text-[11px] leading-5 text-ink-soft">Novos elementos surgem conforme sua história cresce. Ao completar este ciclo, um novo jardim começa automaticamente com outra combinação visual — sem sequência obrigatória e sem pontos visíveis.</p></div><button type="button" onClick={()=>setCollection(false)} className="rounded-full border border-line px-3 py-2 text-xs">Fechar</button></div>{(['Plantas','Visitantes','Detalhes'] as GardenKind[]).map(kind=><div key={kind} className="mt-6"><h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{kind}</h3><div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">{items.filter(i=>i.kind===kind).map(item=>{const open=cycleProgress>=item.at;return <div key={item.label} className={`rounded-2xl border p-3 text-center ${open?'border-line bg-white':'border-line bg-paper-soft/50 opacity-55'}`}><div className="text-4xl">{open?item.icon:<LockKeyhole className="mx-auto h-7 w-7 text-ink-soft"/>}</div><p className="mt-2 text-[11px] font-medium">{open?item.label.split(' · ')[0]:'Ainda vai surgir'}</p></div>})}</div></div>)}</div></div>}

  {history&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/30 p-0 sm:items-center sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget)setHistory(false)}}><div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-[#fffdf8] p-5 shadow-2xl sm:rounded-[28px] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[.16em] text-forest-600">Sua história visual</p><h2 className="mt-1 font-serif text-2xl text-forest-900">Jardins anteriores</h2></div><button type="button" onClick={()=>setHistory(false)} className="rounded-full border border-line px-3 py-2 text-xs">Fechar</button></div><div className="mt-6 flex items-center justify-between"><button type="button" disabled={viewedCycle<=0} onClick={()=>setSelectedCycle(Math.max(0,viewedCycle-1))} className="rounded-full border border-line p-2 disabled:opacity-30" aria-label="Jardim anterior"><ChevronLeft className="h-4 w-4"/></button><div className="text-center"><p className="text-xs text-forest-600">{cycleLabel(viewedCycle)}</p><p className="font-serif text-xl text-forest-900">{viewedTheme.name}</p></div><button type="button" disabled={viewedCycle>=currentCycle-1} onClick={()=>setSelectedCycle(Math.min(currentCycle-1,viewedCycle+1))} className="rounded-full border border-line p-2 disabled:opacity-30" aria-label="Próximo jardim"><ChevronRight className="h-4 w-4"/></button></div><div className={`mt-5 rounded-[26px] bg-gradient-to-b ${viewedTheme.ground} p-5`}><p className="text-center text-xs text-ink-soft">Este jardim amadureceu e permanece na sua trajetória.</p><div className="mt-5 grid grid-cols-4 gap-3">{viewedItems.map(item=><div key={item.label} className="rounded-2xl border border-white/70 bg-white/70 p-3 text-center"><div className="text-3xl">{viewedProgress>=item.at?item.icon:'·'}</div><p className="mt-2 text-[10px] text-forest-900">{item.label.split(' · ')[0]}</p></div>)}</div></div><p className="mt-5 text-center text-[11px] leading-5 text-ink-soft">Se você usar o app por anos, novos jardins continuam sendo criados. A navegação histórica permanece organizada por ciclo em vez de acumular tudo na mesma tela.</p></div></div>}

  <div className="sr-only"><Leaf/><Flower2/><TreePine/> O jardim evolui em ciclos sem limite final. Cada ciclo usa CYCLE_SIZE pontos internos, gera uma nova combinação determinística de plantas, visitantes, detalhes, posições e movimentos; preserva os jardins concluídos na navegação histórica; respeita prefers-reduced-motion e não usa streak, punição, perda de nível ou XP visível.</div></div>
}
