import { useEffect, useMemo, useState } from 'react'
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
  sky: string
  ground: string
  flower: string
  water: string
  trunk: string
  canopy: string
}

const EMPTY: GardenState = { stage: 0, active_days: 0, diversity: 0, signals: {}, garden_index: 0, garden_progress: 0, completed_gardens: 0, total_growth: 0 }
const THEMES: GardenTheme[] = [
  { name: 'Clareira Serena', subtitle: 'Um espaço aberto, claro e leve para recomeçar.', sky: '#dfeceb', ground: '#8eaf72', flower: '#d9b5a4', water: '#79aaa3', trunk: '#74543b', canopy: '#496c48' },
  { name: 'Jardim do Lago', subtitle: 'Água, folhas e caminhos ganham mais presença.', sky: '#dbe9e5', ground: '#87a878', flower: '#d9c29c', water: '#6f9fa4', trunk: '#6f513d', canopy: '#54724f' },
  { name: 'Bosque de Luz', subtitle: 'Sombras suaves e pontos de luz criam um novo ritmo.', sky: '#e8eadb', ground: '#7f9e69', flower: '#cbb0b5', water: '#83a8a1', trunk: '#70513b', canopy: '#405f43' },
  { name: 'Jardim Silvestre', subtitle: 'Flores menos simétricas deixam o espaço mais espontâneo.', sky: '#e4ece3', ground: '#90aa70', flower: '#cba8a0', water: '#7fa6a0', trunk: '#765740', canopy: '#5d784f' },
  { name: 'Recanto do Entardecer', subtitle: 'A paisagem fica mais quente e acolhedora.', sky: '#efe6d7', ground: '#879d69', flower: '#c89579', water: '#7d9ea0', trunk: '#70503d', canopy: '#506947' },
  { name: 'Jardim das Folhas', subtitle: 'Texturas verdes e pequenos caminhos ocupam o cenário.', sky: '#e5ece0', ground: '#829f70', flower: '#d4b18f', water: '#739b98', trunk: '#6e523e', canopy: '#48664a' },
  { name: 'Jardim de Brisa', subtitle: 'Um novo espaço com mais respiro entre árvores e canteiros.', sky: '#dce9e7', ground: '#91ad7c', flower: '#c9a7b1', water: '#78a4a2', trunk: '#795a42', canopy: '#587653' },
  { name: 'Jardim de Luz Baixa', subtitle: 'Luz suave, água e vegetação formam um canto mais íntimo.', sky: '#e8e6dc', ground: '#78926b', flower: '#c9a18c', water: '#6f9495', trunk: '#684b39', canopy: '#3f5d45' },
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
  const layoutVariant = Math.floor(gardenIndex / THEMES.length) % 4
  const mirror = (gardenIndex + layoutVariant) % 2 === 1
  const unlocked = ELEMENTS.filter(e => stage >= e.stage)
  const detail = selected ? ELEMENTS.find(e => e.stage === selected) : unlocked[unlocked.length - 1]
  const memories = useMemo(() => memoryIndexes(Math.max(0, state.completed_gardens || 0)), [state.completed_gardens])
  const treeLeft = mirror ? '66%' : '8%'
  const flowerLeft = mirror ? '54%' : '13%'
  const waterRight = mirror ? 'auto' : '7%'
  const waterLeft = mirror ? '7%' : 'auto'

  return <main className="min-h-full bg-[#faf6ee] px-4 py-7 text-forest-950 sm:px-6">
    <style>{`@keyframes garden-sway{50%{transform:rotate(1.25deg)}}@keyframes garden-hop{0%,100%{transform:translate(0,0)}45%{transform:translate(34px,-18px)}72%{transform:translate(58px,1px)}}.garden-tree{transform-origin:50% 100%;animation:garden-sway 7s ease-in-out infinite}.garden-butterfly{animation:garden-hop 11s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.garden-tree,.garden-butterfly{animation:none!important}}`}</style>
    <div className="mx-auto max-w-[1180px]">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-[.2em] text-forest-600">Seu espaço vivo</p><h1 className="font-serif text-4xl sm:text-5xl">Meu Jardim</h1><p className="mt-2 text-sm text-ink-soft">Pequenos cuidados deixam marcas. Jardins completos viram memórias e um novo sempre começa.</p></div><p className="max-w-sm font-serif italic text-forest-700">“Não existe último jardim por aqui.”</p></header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_270px]">
        <section className="relative min-h-[520px] overflow-hidden rounded-[34px] border border-[#d8d0c2] shadow-xl" style={{ background: `linear-gradient(${theme.sky} 0%, #eef2df 42%, ${theme.ground} 43%, ${theme.ground} 100%)` }} aria-label={`Jardim atual: ${theme.name}`}>
          <div className="absolute left-5 top-5 z-30 max-w-xs rounded-2xl bg-white/85 px-5 py-4 backdrop-blur"><p className="text-[10px] uppercase tracking-widest text-forest-600">Jardim atual</p><p className="font-serif text-xl">{theme.name}</p><p className="mt-1 text-xs text-ink-soft">{theme.subtitle}</p>{gardenIndex>0&&stage===0&&<p className="mt-2 text-[11px] font-medium text-forest-700">Um novo jardim acabou de começar.</p>}</div>
          <div className="absolute inset-x-0 bottom-0 h-[58%] rounded-t-[48%] opacity-95" style={{ background: theme.ground }}/>
          <div className="absolute bottom-[4%] left-[4%] right-[4%] h-[30%] rounded-[50%] border-t border-white/15 bg-white/5"/>

          {stage>=1&&<div className="absolute bottom-[10%] z-10 flex gap-2" style={{ left: flowerLeft }} aria-label="Primeiros brotos"><Sprout className="h-7 w-7 text-[#315c3b]"/><Sprout className="mt-3 h-5 w-5 text-[#416e47]"/><Sprout className="h-6 w-6 text-[#54794d]"/></div>}
          {stage>=2&&<div className="absolute bottom-[9%] z-10 h-14 w-40 rounded-[50%]" style={{ left: flowerLeft, background: theme.flower, boxShadow: `34px -7px 0 #efe0bb, 82px 2px 0 ${theme.flower}` }} aria-label="Canteiro de flores"/>}
          {stage>=3&&<><div className="garden-tree absolute bottom-[18%] z-10 h-[305px] w-[270px]" style={{ left: treeLeft }} aria-label="Árvore de cuidado"><div className="absolute bottom-0 left-[118px] h-[180px] w-12 rounded-3xl" style={{ background: theme.trunk }}/><div className="absolute left-5 top-4 h-44 w-44 rounded-full" style={{ background: theme.canopy, boxShadow: `75px 20px 0 ${theme.canopy}, 35px -35px 0 color-mix(in srgb, ${theme.canopy} 82%, white), 100px 75px 0 color-mix(in srgb, ${theme.canopy} 86%, black)` }}/></div><div className="absolute bottom-[8%] h-16 w-[43%] rounded-[50%] bg-[#d8c9a7]" style={{ left: mirror ? '20%' : '35%', transform: mirror ? 'rotate(6deg)' : 'rotate(-6deg)' }} aria-label="Caminho do jardim"/></>}
          {stage>=4&&<><Bird className="absolute top-[34%] z-20 h-6 w-6 text-forest-900" style={{ left: mirror ? '74%' : '23%' }}/><div className="garden-butterfly absolute bottom-[29%] z-20 h-4 w-5 rounded-[80%_20%] bg-[#c27a48] shadow-[7px_0_0_#d89a56]" style={{ left: mirror ? '37%' : '48%' }} aria-label="Borboleta entre os canteiros"/></>}
          {stage>=5&&<><div className="absolute bottom-[6%] z-10 h-24 w-[30%] rounded-[50%] border-4 border-white/30" style={{ right: waterRight, left: waterLeft, background: theme.water }} aria-label="Recanto de água"/><div className="absolute bottom-[17%] z-20 h-14 w-28 rounded-t-xl border-b-[7px] border-[#684c38] bg-[#9a7351]" style={{ left: mirror ? '36%' : '45%' }} aria-label="Banco junto ao caminho"/></>}
          {stage>=6&&<><div className="absolute bottom-[27%] z-20 h-10 w-8 rounded-lg border-2 border-[#65513c] bg-[#f1d48b]/80 shadow-[0_0_28px_#f1d48b]" style={{ right: mirror ? '65%' : '23%' }} aria-label="Luz do jardim"/><Sparkles className="absolute right-[9%] top-[16%] h-7 w-7 text-[#d9b96e] opacity-70"/></>}
          {stage===0&&<div className="absolute inset-x-0 bottom-[16%] z-20 mx-auto w-[min(86%,440px)] rounded-3xl bg-white/88 p-6 text-center backdrop-blur"><Sprout className="mx-auto h-8 w-8"/><p className="mt-3 font-serif text-xl">{gardenIndex>0?'Um novo espaço está criando raízes':'Seu jardim está preparando o solo'}</p><p className="mt-2 text-sm text-ink-soft">Uma ação isolada não muda tudo. Mas bastam alguns momentos de cuidado para as primeiras diferenças começarem a aparecer.</p></div>}
        </section>

        <aside className="space-y-4"><section className="rounded-[26px] border border-line bg-white p-5"><h2 className="font-serif text-xl">Sua jornada</h2><Stat Icon={Heart} value={state.active_days} label="dias de cuidado"/><Stat Icon={Sparkles} value={state.diversity} label="formas de cuidado"/><Stat Icon={Sprout} value={unlocked.length} label="mudanças neste jardim"/>{state.completed_gardens>0&&<Stat Icon={TreePine} value={state.completed_gardens} label={state.completed_gardens===1?'jardim preservado':'jardins preservados'}/>}</section><section className="rounded-[26px] border border-[#e6dcc8] bg-[#fff8e9] p-5"><Sprout className="h-5 w-5"/><p className="mt-3 font-medium">Mudanças mais próximas.</p><p className="mt-2 text-xs leading-5 text-ink-soft">O jardim agora responde a pequenos conjuntos de cuidado, geralmente depois de poucas interações significativas. Ainda não há streak, punição ou obrigação de usar todos os recursos.</p></section></aside>
      </div>

      <section className="mt-6 rounded-[30px] border border-line bg-white p-5 sm:p-7"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs uppercase tracking-widest text-forest-600">Crescimento contínuo</p><h2 className="font-serif text-2xl">O jardim nunca termina</h2></div><p className="max-w-xl text-sm text-ink-soft">Quando este espaço amadurecer, ele será preservado nas Memórias do Jardim e outro surgirá automaticamente, com paisagem, posição dos elementos e atmosfera diferentes.</p></div><div className="mt-5 flex flex-wrap gap-2">{unlocked.map(e=><button key={e.stage} onClick={()=>setSelected(e.stage)} className="rounded-full border border-line bg-paper-soft px-3 py-2 text-xs text-forest-800">{e.name}</button>)}{stage<6&&<span className="rounded-full border border-dashed border-forest-200 px-3 py-2 text-xs text-ink-soft">A próxima transformação está se formando</span>}</div></section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">O que ganhou vida</p>{detail?<><div className="mt-4 flex gap-4"><div className="rounded-2xl bg-[#eef4ea] p-4"><detail.Icon className="h-8 w-8"/></div><div><h3 className="font-serif text-xl">{detail.name}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{detail.why}</p></div></div></>:<p className="mt-4 text-sm text-ink-soft">As primeiras mudanças aparecem depois de alguns momentos de cuidado — sem exigir uma longa sequência.</p>}</section><section className="rounded-[28px] border border-line bg-white p-6"><p className="text-xs uppercase tracking-widest text-forest-600">Como ele entende sua jornada</p><h3 className="mt-2 font-serif text-xl">Cuidado, não desempenho</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Check-ins, Diário, questionários, conteúdos, Plano de Autocuidado, marcos e relatórios podem contribuir. Um Check-in isolado não cria sozinho um novo elemento, mas poucos momentos significativos já podem produzir uma pequena mudança.</p><div className="mt-5 grid grid-cols-2 gap-3"><Mini Icon={CheckCircle2} label="Sem streak"/><Mini Icon={Heart} label="Sem punição"/><Mini Icon={BookOpen} label="Diversidade ajuda"/><Mini Icon={Sparkles} label="Sem placar"/></div></section></div>

      {memories.length>0&&<section className="mt-5 rounded-[30px] border border-line bg-white p-5 sm:p-7"><p className="text-xs uppercase tracking-widest text-forest-600">Memórias do Jardim</p><h2 className="mt-1 font-serif text-2xl">Espaços que já amadureceram</h2><p className="mt-1 text-sm text-ink-soft">Eles não desaparecem quando um novo jardim começa.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{memories.map(index=>{const t=themeFor(index);return <article key={index} className="overflow-hidden rounded-2xl border border-line"><div className="relative h-24" style={{background:`linear-gradient(${t.sky} 0 48%,${t.ground} 49% 100%)`}}><div className="absolute bottom-2 left-4 h-12 w-3 rounded-full" style={{background:t.trunk}}/><div className="absolute bottom-10 left-1 h-12 w-16 rounded-full" style={{background:t.canopy}}/><div className="absolute bottom-2 right-4 h-6 w-16 rounded-[50%]" style={{background:t.water}}/></div><div className="p-4"><p className="text-[10px] uppercase tracking-wider text-forest-600">Memória {index+1}</p><p className="font-serif text-lg text-forest-900">{t.name}</p><p className="mt-1 text-xs text-ink-soft">Jardim amadurecido e preservado.</p></div></article>})}</div></section>}

      <p className="mt-6 text-center text-xs text-ink-soft">Seu jardim não mede produtividade. Ele acompanha sua trajetória e sempre pode abrir um novo espaço.</p>
    </div>
  </main>
}

function Stat({ Icon, value, label }: { Icon: typeof Sprout; value: number; label: string }) { return <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#faf8f3] p-3"><Icon className="h-4 w-4"/><div><p className="font-serif text-xl">{value}</p><p className="text-[11px] text-ink-soft">{label}</p></div></div> }
function Mini({ Icon, label }: { Icon: typeof Sprout; label: string }) { return <div className="flex items-center gap-2 rounded-xl bg-[#faf8f3] p-3 text-xs"><Icon className="h-4 w-4"/>{label}</div> }
