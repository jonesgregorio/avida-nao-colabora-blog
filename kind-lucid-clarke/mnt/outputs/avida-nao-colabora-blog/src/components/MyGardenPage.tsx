import { useEffect, useMemo, useState } from 'react'
import { Bird, BookOpen, CheckCircle2, Flower2, Heart, LockKeyhole, Sparkles, Sprout, TreePine, Waves } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getEffectivePlan, hasPlanAccess } from '../lib/officialPlans'
import type { Profile } from '../types'

interface Props { userId: string; profile?: Profile | null; onNavigatePricing?: () => void }
type GardenState = { stage:number; active_days:number; diversity:number; signals:Record<string,number>; garden_index:number; garden_progress:number; completed_gardens:number; total_growth:number; growth_model_version?:number }
type GardenTheme = { name:string; subtitle:string; skyTop:string; skyBottom:string; hillBack:string; hillMid:string; lawn:string; lawnDark:string; flowerA:string; flowerB:string; flowerC:string; water:string; trunk:string; canopy:string; canopyLight:string; glow:string }

const EMPTY:GardenState={stage:0,active_days:0,diversity:0,signals:{},garden_index:0,garden_progress:0,completed_gardens:0,total_growth:0}
const THEMES:GardenTheme[]=[
  {name:'Jardim da Clareira',subtitle:'Um lugar aberto, claro e acolhedor para crescer.',skyTop:'#f1e7d8',skyBottom:'#f8f0e5',hillBack:'#aeb58e',hillMid:'#7c9467',lawn:'#678b5d',lawnDark:'#3f674b',flowerA:'#d49d88',flowerB:'#f0d2a0',flowerC:'#bea3b6',water:'#6d9a96',trunk:'#72503d',canopy:'#315e43',canopyLight:'#5f8258',glow:'#f0c77d'},
  {name:'Jardim do Lago',subtitle:'Água, vegetação e caminhos ocupam mais espaço.',skyTop:'#dce8e3',skyBottom:'#f3ecdd',hillBack:'#9fb49f',hillMid:'#789470',lawn:'#64855f',lawnDark:'#41684f',flowerA:'#d6ab8b',flowerB:'#e8cfaf',flowerC:'#a99ebd',water:'#609699',trunk:'#694b39',canopy:'#3d6848',canopyLight:'#6c8a62',glow:'#eacb8e'},
  {name:'Bosque de Luz',subtitle:'Sombras suaves e pontos de luz criam outro ritmo.',skyTop:'#e7dfd1',skyBottom:'#f4e7d4',hillBack:'#a6ad8d',hillMid:'#758562',lawn:'#5d7b57',lawnDark:'#365d45',flowerA:'#c8919f',flowerB:'#e4c696',flowerC:'#d58e7b',water:'#749793',trunk:'#674936',canopy:'#2e583d',canopyLight:'#557650',glow:'#efbd68'},
  {name:'Jardim Silvestre',subtitle:'Flores e caminhos menos simétricos deixam tudo mais espontâneo.',skyTop:'#e2eadf',skyBottom:'#f2eadc',hillBack:'#a8b89d',hillMid:'#7d976d',lawn:'#6e8c5d',lawnDark:'#4a6d4c',flowerA:'#cc9489',flowerB:'#e7ca91',flowerC:'#b59daf',water:'#739d98',trunk:'#72523d',canopy:'#456b49',canopyLight:'#6f8b5f',glow:'#eccc8a'},
  {name:'Recanto do Entardecer',subtitle:'A paisagem fica mais quente, profunda e acolhedora.',skyTop:'#ecd9c6',skyBottom:'#f6e8d6',hillBack:'#b2a986',hillMid:'#818866',lawn:'#667c55',lawnDark:'#456146',flowerA:'#c67f66',flowerB:'#dfae88',flowerC:'#b795a5',water:'#779494',trunk:'#6c4d39',canopy:'#3d6041',canopyLight:'#687d53',glow:'#efb365'},
  {name:'Jardim das Folhas',subtitle:'Texturas verdes e pequenos caminhos tomam conta do cenário.',skyTop:'#dce6d8',skyBottom:'#f0ead9',hillBack:'#a8b79b',hillMid:'#7b9071',lawn:'#64825c',lawnDark:'#426348',flowerA:'#cda17d',flowerB:'#e2c69b',flowerC:'#be9cad',water:'#6d9692',trunk:'#694e3a',canopy:'#355c40',canopyLight:'#5f7d53',glow:'#e7c87e'}
]
const ELEMENTS=[
  {stage:1,name:'Primeiros brotos',why:'Alguns momentos de cuidado começaram a deixar uma marca visível.',Icon:Sprout},
  {stage:2,name:'Flores',why:'A presença recorrente trouxe mais variedade e cor ao jardim.',Icon:Flower2},
  {stage:3,name:'Árvore',why:'A continuidade criou raízes e um ponto permanente de acolhimento.',Icon:TreePine},
  {stage:4,name:'Vida',why:'Com abrigo e flores, pequenas companhias começaram a chegar.',Icon:Bird},
  {stage:5,name:'Recanto',why:'O jardim ganhou profundidade e um novo canto de pausa.',Icon:Waves},
  {stage:6,name:'Luz',why:'O espaço amadureceu e ganhou uma atmosfera própria.',Icon:Sparkles}
] as const

function themeFor(index:number){return THEMES[((index%THEMES.length)+THEMES.length)%THEMES.length]}
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
  const memories=memoryIndexes(Math.max(0,state.completed_gardens||0))
  const visualProgress=Math.max(0,Math.min(100,Math.round((state.garden_progress||0)/60*100)))

  return <main className="min-h-full bg-[#f7f0e5] text-forest-950">
    <style>{`@keyframes bird-rest{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes butterfly-path{0%,100%{transform:translate(0,0) rotate(-4deg)}45%{transform:translate(34px,-18px) rotate(5deg)}75%{transform:translate(62px,3px) rotate(-2deg)}}@keyframes leaf-sway{0%,100%{transform:rotate(-.5deg)}50%{transform:rotate(.8deg)}}@keyframes firefly{0%,100%{opacity:.25}50%{opacity:1}}.garden-bird{animation:bird-rest 4.8s ease-in-out infinite}.garden-butterfly{animation:butterfly-path 9s ease-in-out infinite}.garden-crown{transform-origin:50% 90%;animation:leaf-sway 7s ease-in-out infinite}.garden-firefly{animation:firefly 3.2s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.garden-bird,.garden-butterfly,.garden-crown,.garden-firefly{animation:none!important}}`}</style>

    <section className="relative overflow-hidden border-b border-[#ded3c3] bg-[#efe4d4]">
      <div className="absolute inset-0"><GardenScene stage={stage} theme={theme} mirror={gardenIndex%2===1}/></div>
      <div className="relative z-10 mx-auto min-h-[760px] max-w-[1240px] px-5 py-10 sm:px-8 lg:min-h-[820px] lg:px-10 lg:py-12">
        <div className="max-w-[520px] rounded-[30px] border border-white/35 bg-[#fffaf1]/72 p-7 shadow-[0_24px_80px_rgba(47,62,43,.12)] backdrop-blur-sm sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[.24em] text-forest-700">Meu Jardim</p>
          <h1 className="mt-3 font-serif text-5xl leading-[.98] text-[#173e2d] sm:text-6xl">Um espaço<br/>que cresce com você</h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-[#5f655f]">Cada pequeno cuidado importa. Aqui, suas ações se transformam em vida, beleza e presença. Um jardim que reflete sua jornada.</p>
          <p className="mt-6 font-serif text-xl italic text-forest-700">Cuidar de si também é construir um lugar melhor para ficar.</p>
        </div>

        <div className="absolute right-5 top-10 hidden w-[330px] rounded-[28px] border border-white/65 bg-[#fffdf8]/88 p-6 shadow-[0_24px_70px_rgba(41,60,45,.14)] backdrop-blur-md md:block lg:right-10">
          <Sparkles className="h-7 w-7 text-forest-700"/><p className="mt-6 text-center font-serif text-xl leading-8 text-forest-950">Todo progresso,<br/>por menor que pareça,<br/>também floresce.</p>
        </div>

        <div className="absolute bottom-8 left-5 right-5 lg:left-auto lg:right-10 lg:w-[500px]">
          <section className="rounded-[30px] border border-white/70 bg-[#fffdf9]/94 p-6 shadow-[0_28px_80px_rgba(35,52,38,.18)] backdrop-blur-md sm:p-7">
            <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-[#e8eadf]"><Sprout className="h-5 w-5 text-forest-700"/></div><div><p className="font-serif text-2xl">{theme.name}</p><p className="mt-1 text-xs text-ink-soft">{stage===6?'Maduro':'Em evolução'}</p></div></div><div className="text-right"><p className="text-[10px] uppercase tracking-[.18em] text-forest-500">Etapa visual</p><p className="mt-1 font-serif text-xl">{Math.max(1,stage)} de 6</p></div></div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7e3d8]"><div className="h-full rounded-full bg-gradient-to-r from-[#315d3f] to-[#8da37c] transition-[width] duration-700" style={{width:`${visualProgress}%`}}/></div>
            <div className="mt-5 grid grid-cols-6 gap-2">{ELEMENTS.map(({stage:itemStage,name,Icon})=>{const active=stage>=itemStage;return <button key={itemStage} type="button" onClick={()=>active&&setSelected(itemStage)} className="group text-center" aria-label={active?`Ver ${name}`:`${name} ainda não apareceu`}><span className={`mx-auto grid h-11 w-11 place-items-center rounded-full border transition ${active?'border-[#d9ddcf] bg-[#eef0e8] text-forest-700':'border-[#e9e4d9] bg-[#f8f5ef] text-[#bbb9ad]'}`}><Icon className="h-4 w-4"/></span><span className={`mt-2 block text-[10px] ${active?'text-forest-800':'text-[#aaa79d]'}`}>{name}</span></button>})}</div>
            <p className="mt-5 text-center font-serif text-sm italic text-[#74766f]">{detail?.why??'O jardim está começando a criar raízes.'}</p>
          </section>
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10">
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-[28px] border border-[#e0d8ca] bg-[#fffaf3] p-6 shadow-[0_14px_40px_rgba(47,61,43,.07)]">
          <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif text-2xl">Ações que fazem seu jardim crescer</h2><p className="mt-1 text-xs text-ink-soft">Diferentes áreas do AVNC contribuem para o jardim. Sem placar, sem streak e sem punição.</p></div><Heart className="hidden h-6 w-6 text-forest-500 sm:block"/></div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6"><ActionItem Icon={CheckCircle2} label="Check-in"/><ActionItem Icon={BookOpen} label="Diário"/><ActionItem Icon={Sparkles} label="Relatórios"/><ActionItem Icon={Sprout} label="Plano de Autocuidado"/><ActionItem Icon={Flower2} label="Conteúdos"/><ActionItem Icon={TreePine} label="Marcos"/></div>
          <p className="mt-5 text-xs leading-5 text-ink-soft">Um Check-in isolado não cria uma transformação. O crescimento acontece quando alguns momentos de cuidado começam a formar uma trajetória consistente.</p>
        </section>

        <section className="rounded-[28px] border border-[#355c41] bg-[#315b3e] p-6 text-white shadow-[0_18px_45px_rgba(40,70,48,.18)]">
          <p className="text-[10px] uppercase tracking-[.22em] text-white/60">Próximo elemento</p>
          <div className="mt-5 flex items-center gap-5"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10">{next?<next.Icon className="h-10 w-10"/>:<Sparkles className="h-10 w-10"/>}</div><div><h2 className="font-serif text-3xl">{next?.name??'Um novo jardim'}</h2><p className="mt-2 text-sm leading-6 text-white/70">{next?'Seu jardim ainda está criando espaço para essa transformação.':'Este jardim amadureceu. O próximo surgirá automaticamente e será visualmente diferente.'}</p></div></div>
        </section>
      </div>

      <section className="mt-7 border-t border-[#dfd4c4] pt-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-3xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm leading-6 text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com atmosfera e composição diferentes. Não existe último jardim por aqui.</p></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{memories.map(index=><MemoryCard key={index} index={index}/>) }<div className="flex min-h-[190px] flex-col items-center justify-center rounded-[24px] border border-[#d8cebd] bg-[#f3eadc] p-5 text-center"><Sprout className="h-7 w-7 text-forest-700"/><p className="mt-3 font-serif text-lg">{state.completed_gardens>0?'Novo jardim em andamento':'Seu primeiro jardim está crescendo'}</p><p className="mt-1 text-xs text-ink-soft">Mais histórias para viver.</p></div></div>
      </section>
    </div>
  </main>
}

function ActionItem({Icon,label}:{Icon:typeof Sprout;label:string}){return <div className="text-center"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#edf0e7] text-forest-700"><Icon className="h-5 w-5"/></div><p className="mt-2 text-[11px] font-medium text-forest-900">{label}</p></div>}
function MemoryCard({index}:{index:number}){const t=themeFor(index);return <article className="overflow-hidden rounded-[22px] border border-[#ddd3c3] bg-[#fffaf3] shadow-sm"><div className="relative h-28 overflow-hidden" style={{background:`linear-gradient(145deg,${t.skyTop},${t.skyBottom})`}}><div className="absolute inset-x-0 bottom-0 h-16 rounded-[50%_50%_0_0]" style={{background:t.hillBack}}/><div className="absolute bottom-0 left-8 h-20 w-20 rounded-full" style={{background:t.canopy}}/><div className="absolute bottom-0 right-3 h-12 w-24 rounded-[50%]" style={{background:t.water}}/></div><div className="p-4"><p className="font-serif text-lg">{t.name}</p><p className="mt-1 text-xs text-ink-soft">Jardim preservado na sua história</p></div></article>}

function GardenScene({stage,theme,mirror}:{stage:number;theme:GardenTheme;mirror:boolean}){
  const sceneLabels=useMemo(()=>[stage>=2&&'Canteiro de flores',stage>=3&&'Árvore de cuidado',stage>=4&&'Visitantes',stage>=5&&'Recanto de água',stage>=5&&'Banco junto ao caminho','Caminho do jardim'].filter(Boolean).join(', '),[stage])
  return <svg viewBox="0 0 940 640" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label={`Paisagem do jardim: ${sceneLabels}`}>
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={theme.skyTop}/><stop offset="1" stopColor={theme.skyBottom}/></linearGradient><radialGradient id="sun"><stop offset="0" stopColor={theme.glow} stopOpacity=".75"/><stop offset="1" stopColor={theme.glow} stopOpacity="0"/></radialGradient><filter id="softShadow"><feDropShadow dx="0" dy="10" stdDeviation="11" floodOpacity=".18"/></filter></defs>
    <rect width="940" height="640" fill="url(#sky)"/><circle cx="735" cy="120" r="95" fill="url(#sun)"/>
    <path d="M0 285 C150 215 255 245 360 300 C480 360 610 274 705 238 C802 201 882 220 940 248 V640 H0Z" fill={theme.hillBack}/>
    <path d="M0 365 C135 305 250 327 372 375 C505 426 635 372 752 324 C842 287 910 304 940 325 V640 H0Z" fill={theme.hillMid}/>
    <path d="M0 438 C155 390 292 420 406 458 C544 505 705 423 940 410 V640 H0Z" fill={theme.lawn}/>
    <path d="M0 545 C180 510 280 570 430 548 C603 523 747 510 940 535 V640 H0Z" fill={theme.lawnDark} opacity=".54"/>
    <path d="M445 640 C430 560 458 515 520 463 C566 425 596 389 611 352 C566 394 515 426 475 463 C417 516 392 571 390 640Z" fill="#d9c5a4" opacity=".9"/>
    <path d="M453 640 C441 567 467 522 526 470 C566 435 594 401 610 365" fill="none" stroke="#f3e4cb" strokeWidth="18" strokeLinecap="round" opacity=".86"/>

    {stage>=1&&<g fill={theme.canopyLight}>{[110,150,202,256,700,745,792].map((x,i)=><g key={x} transform={`translate(${x} ${505+(i%2)*13})`}><path d="M0 28 C8 10 16 6 20 0 C23 12 26 22 24 31Z"/><path d="M18 32 C25 16 33 10 38 4 C41 18 42 27 39 35Z"/></g>)}</g>}

    {stage>=2&&<g filter="url(#softShadow)">{[[120,515,theme.flowerA],[155,535,theme.flowerB],[205,505,theme.flowerC],[250,545,theme.flowerA],[735,505,theme.flowerB],[785,527,theme.flowerC]].map(([x,y,c],i)=><g key={i} transform={`translate(${x} ${y})`}><line y1="4" y2="30" stroke="#446a48" strokeWidth="4"/><circle cy="0" r="9" fill={c as string}/><circle cx="8" cy="3" r="7" fill={c as string}/><circle cx="-8" cy="4" r="7" fill={c as string}/><circle cy="3" r="3" fill="#e6c66e"/></g>)}</g>}

    {stage>=3&&<g className="garden-crown" transform={mirror?'translate(940 0) scale(-1 1)':''} filter="url(#softShadow)"><path d="M315 520 C330 450 326 395 348 330 C366 278 387 245 398 205 C409 259 426 291 438 330 C451 372 450 422 461 520Z" fill={theme.trunk}/><path d="M398 268 C360 245 342 215 326 182 M404 292 C450 257 462 223 475 193 M384 310 C351 294 325 281 302 258" fill="none" stroke={theme.trunk} strokeWidth="14" strokeLinecap="round"/><ellipse cx="344" cy="185" rx="88" ry="68" fill={theme.canopy}/><ellipse cx="418" cy="158" rx="104" ry="78" fill={theme.canopy}/><ellipse cx="485" cy="208" rx="82" ry="66" fill={theme.canopy}/><ellipse cx="403" cy="225" rx="118" ry="72" fill={theme.canopy}/><ellipse cx="365" cy="160" rx="50" ry="36" fill={theme.canopyLight} opacity=".64"/><ellipse cx="455" cy="182" rx="54" ry="38" fill={theme.canopyLight} opacity=".5"/></g>}

    {stage>=4&&<g><g className="garden-bird" transform="translate(700 210)" fill="#334e46"><path d="M0 12 Q18 -8 34 10 Q20 5 13 20Z"/><path d="M32 10 Q47 -4 58 10 Q45 8 36 21Z"/></g><g className="garden-bird" transform="translate(755 180) scale(.8)" fill="#334e46"><path d="M0 12 Q18 -8 34 10 Q20 5 13 20Z"/><path d="M32 10 Q47 -4 58 10 Q45 8 36 21Z"/></g><g className="garden-butterfly" transform="translate(250 430)"><ellipse cx="0" cy="0" rx="11" ry="17" fill={theme.flowerC}/><ellipse cx="20" cy="0" rx="11" ry="17" fill={theme.flowerA}/><rect x="9" y="-8" width="3" height="22" rx="2" fill="#314f40"/></g></g>}

    {stage>=5&&<g filter="url(#softShadow)"><ellipse cx="770" cy="535" rx="122" ry="62" fill="#456b58" opacity=".55"/><ellipse cx="770" cy="526" rx="112" ry="52" fill={theme.water}/><ellipse cx="790" cy="508" rx="31" ry="21" fill="#82a672"/><circle cx="802" cy="501" r="7" fill={theme.flowerB}/><path d="M640 465 h110 v13 H640z" fill="#7a5b43"/><path d="M651 478 v58 M738 478 v58" stroke="#684a37" strokeWidth="8"/><path d="M640 447 h110 v11 H640z" fill="#87654a"/><path d="M652 447 v-25 M738 447 v-25" stroke="#684a37" strokeWidth="8"/></g>}

    {stage>=6&&<g><g transform="translate(575 444)" filter="url(#softShadow)"><rect x="0" y="22" width="8" height="82" rx="4" fill="#5c4938"/><rect x="-12" y="0" width="32" height="42" rx="6" fill="#473d31"/><rect x="-6" y="7" width="20" height="27" rx="4" fill={theme.glow} opacity=".95"/></g>{[[535,420],[610,395],[690,448],[830,435],[288,400]].map(([x,y],i)=><circle key={i} className="garden-firefly" cx={x} cy={y} r="4" fill={theme.glow}/>)}</g>}
  </svg>
}
