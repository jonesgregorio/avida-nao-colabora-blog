import {
  ArrowRight, BarChart3, BookOpen, Check, FileText, Heart, LockKeyhole,
  MessageCircleHeart, Mic2, PenLine, Search, ShieldCheck, Sparkles, Sprout,
} from 'lucide-react'
import { usePlanPricing } from '../lib/planPricing'

interface HomeContentProps {
  onNavigate: (section: string) => void
}

const JOURNEY = [
  { n: '1', title: 'Registre seu dia', text: 'Faça seu check-in ou escreva no diário, do seu jeito.', Icon: FileText },
  { n: '2', title: 'Visualize sua trajetória', text: 'Acompanhe suas emoções e contextos ao longo do tempo.', Icon: BarChart3 },
  { n: '3', title: 'Entenda seus padrões', text: 'Descubra o que se repete e como você se sente em diferentes situações.', Icon: Search },
  { n: '4', title: 'Cuide de você', text: 'Tenha acesso a conteúdos, insights e possibilidades de autocuidado.', Icon: Heart },
]

const TOOLS = [
  { title: 'Diário', text: 'Registre seus dias, pensamentos e emoções de forma simples e acolhedora.', Icon: PenLine, screen: 'diary' },
  { title: 'Mapa Emocional', text: 'Visualize suas emoções ao longo do tempo e perceba padrões.', Icon: BarChart3, screen: 'map' },
  { title: 'Descobertas', text: 'Encontre o que mais se repete na sua rotina e veja novas perspectivas.', Icon: Sparkles, screen: 'discoveries' },
  { title: 'Meu Jardim', text: 'Veja seu cuidado ganhar forma em um jardim que cresce com sua jornada.', Icon: Sprout, screen: 'garden' },
]

const CONTEXT_ITEMS = [
  'Emoções que aparecem com frequência',
  'Contextos que se repetem',
  'Mudanças ao longo das semanas',
  'Momentos mais leves ou difíceis',
  'Possibilidades de cuidado',
]

const PLANS = [
  {
    key: 'free', name: 'Gratuito', promise: 'Começar a se observar', fallbackPrice: 'R$ 0', period: 'para sempre',
    items: ['Check-in diário — 1 por dia', 'Diário — até 5 dias/mês', 'Artigos e conteúdos'], cta: 'Criar conta gratuita', featured: false,
  },
  {
    key: 'essential', name: 'Essencial', promise: 'Entender seus padrões', fallbackPrice: 'R$ 19,90', period: 'por mês',
    items: ['Diário sem limite', 'Mapa Emocional', 'Descobertas e mais'], cta: 'Quero o Essencial', featured: true,
  },
  {
    key: 'plus', name: 'Plus', promise: 'Transformar entendimento em cuidado', fallbackPrice: 'R$ 39,90', period: 'por mês',
    items: ['Aprofundamentos do Diário', 'Plano de Autocuidado', 'Orientação Mensal e mais'], cta: 'Quero o Plus', featured: false,
  },
]

function PhoneMockup({ kind }: { kind: string }) {
  return (
    <div className="mx-auto w-[154px] rounded-[28px] border-[5px] border-[#24362f] bg-[#24362f] p-1.5 shadow-[0_18px_35px_rgba(39,58,48,.18)] sm:w-[172px]">
      <div className="min-h-[258px] overflow-hidden rounded-[20px] bg-white px-3 py-4">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#d9ddd9]" />
        {kind === 'diary' && <>
          <p className="text-center text-[8px] text-ink-soft">Seu momento de hoje</p>
          <p className="mt-2 text-center font-serif text-[11px] text-forest-900">Como você está hoje?</p>
          <div className="mt-4 flex justify-center gap-1.5">{['🙂','😌','😐','😔','😣'].map(x=><span key={x} className="flex h-7 w-7 items-center justify-center rounded-full bg-paper-soft text-xs">{x}</span>)}</div>
          <div className="mt-5 space-y-2"><div className="h-2 rounded bg-mint"/><div className="h-2 w-4/5 rounded bg-[#eef0eb]"/><div className="h-2 w-3/5 rounded bg-[#eef0eb]"/></div>
          <div className="mt-5 flex items-center justify-center gap-1 text-[8px] text-forest-700"><Mic2 className="h-3 w-3"/> Você também pode falar</div>
        </>}
        {kind === 'map' && <>
          <p className="font-serif text-[11px] text-forest-900">Seu mapa emocional</p>
          <p className="mt-1 text-[7px] text-ink-soft">Últimos dias</p>
          <div className="mt-5 flex h-28 items-end gap-2 rounded-xl bg-paper-soft p-3">{[38,62,46,82,58,72,52].map((h,i)=><span key={i} className="flex-1 rounded-t bg-forest-300" style={{height:`${h}%`}} />)}</div>
          <div className="mt-4 flex gap-1.5"><span className="rounded-full bg-mint px-2 py-1 text-[7px]">Calma</span><span className="rounded-full bg-[#fff0dc] px-2 py-1 text-[7px]">Ansiedade</span></div>
        </>}
        {kind === 'discoveries' && <>
          <p className="font-serif text-[11px] text-forest-900">Suas descobertas</p>
          <div className="mt-4 rounded-xl bg-[#f2edf8] p-3"><p className="text-[7px] font-semibold text-[#654b88]">Começando a aparecer</p><p className="mt-2 text-[8px] leading-4 text-ink">Alguns contextos parecem acompanhar os dias de maior ansiedade.</p></div>
          <div className="mt-3 rounded-xl border border-line p-3"><p className="text-[7px] font-semibold text-forest-700">Se repetindo</p><p className="mt-1 text-[8px] leading-4 text-ink">Dias com mais descanso também aparecem com mais leveza.</p></div>
        </>}
        {kind === 'garden' && <>
          <p className="text-center font-serif text-[11px] text-forest-900">Meu Jardim</p>
          <div className="relative mt-4 h-36 overflow-hidden rounded-2xl bg-gradient-to-b from-[#e8f2e6] to-[#d6e1c6]">
            <span className="absolute bottom-2 left-3 text-4xl">🌿</span><span className="absolute bottom-1 left-12 text-5xl">🌱</span><span className="absolute bottom-2 right-4 text-5xl">🌳</span><span className="absolute right-5 top-7 text-xl">🦋</span>
          </div>
          <p className="mt-3 text-center text-[7px] leading-4 text-ink-soft">Seu espaço cresce com momentos de cuidado.</p>
        </>}
      </div>
    </div>
  )
}

export default function HomeContent({ onNavigate }: HomeContentProps) {
  const { prices } = usePlanPricing()

  return (
    <>
      <section id="como-funciona" className="scroll-mt-24 border-b border-line bg-[#fffdf9]">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 md:grid-cols-[.8fr_2.2fr] md:items-center lg:px-6 lg:py-16">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Como funciona</p>
            <h2 className="mt-2 font-serif text-3xl leading-tight text-forest-900 sm:text-4xl">Uma jornada simples e significativa</h2>
            <p className="mt-4 text-sm leading-6 text-ink-soft">Em poucos minutos por dia, você já começa a entender melhor o que está vivendo.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {JOURNEY.map(({ n, title, text, Icon }, index) => (
              <article key={title} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mint text-forest-700"><Icon className="h-5 w-5" /></div>
                <div className="mt-4 flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-900 text-[10px] font-semibold text-white">{n}</span><h3 className="text-sm font-semibold text-forest-900">{title}</h3></div>
                <p className="mt-2 text-xs leading-5 text-ink-soft">{text}</p>
                {index < JOURNEY.length - 1 && <ArrowRight className="absolute -right-3 top-4 hidden h-4 w-4 text-forest-400 lg:block" />}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-[#f8f1e5]">
        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[.8fr_2.2fr] lg:items-start">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Uma experiência feita para você</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-forest-900 sm:text-4xl">Ferramentas que fazem sentido na vida real</h2>
              <p className="mt-4 text-sm leading-6 text-ink-soft">Recursos práticos e acolhedores para te ajudar a se conhecer melhor e construir uma rotina mais consciente.</p>
              <button onClick={() => onNavigate('pricing')} className="mt-5 inline-flex items-center gap-2 rounded-full border border-forest-700 px-5 py-2.5 text-sm font-semibold text-forest-900 hover:bg-white/60">Conheça todos os recursos <ArrowRight className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
              {TOOLS.map(tool => (
                <article key={tool.title} className="text-center">
                  <PhoneMockup kind={tool.screen} />
                  <div className="mt-4 flex items-center justify-center gap-1.5"><tool.Icon className="h-4 w-4 text-forest-600"/><h3 className="text-sm font-semibold text-forest-900">{tool.title}</h3></div>
                  <p className="mx-auto mt-2 max-w-[180px] text-xs leading-5 text-ink-soft">{tool.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-[#fffdf9]">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 py-12 lg:grid-cols-2 lg:px-6 lg:py-16">
          <div className="grid gap-6 rounded-[30px] bg-paper p-6 sm:grid-cols-[1fr_.72fr] sm:p-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Quanto mais você registra</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-forest-900">Mais contexto para enxergar o que importa</h2>
              <p className="mt-3 text-sm leading-6 text-ink-soft">Com o tempo, você começa a perceber o que se repete, o que muda e o que realmente faz sentido pra você.</p>
              <ul className="mt-5 space-y-3">{CONTEXT_ITEMS.map(item=><li key={item} className="flex items-center gap-2 text-xs text-ink"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint text-forest-700"><Check className="h-3.5 w-3.5"/></span>{item}</li>)}</ul>
            </div>
            <div className="flex flex-col justify-between rounded-[24px] bg-[#f4efe4] p-5">
              <p className="font-serif text-2xl italic leading-snug text-forest-800">“Não é sobre ser sempre forte. É sobre se conhecer cada vez mais.”</p>
              <div className="mt-6 text-center text-7xl">🌿</div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[30px] border border-line bg-gradient-to-br from-[#edf3e8] to-[#dce6d2] p-7 sm:p-9">
            <div className="relative z-10 max-w-[290px]">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Meu Jardim</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-forest-900">Seu cuidado também pode ganhar forma.</h2>
              <p className="mt-4 text-sm leading-6 text-ink-soft">No Meu Jardim, seus momentos de cuidado ajudam a construir um espaço visual que cresce com sua trajetória — sem metas, competição ou punição por pausas.</p>
              <button onClick={() => onNavigate('auth')} className="mt-5 inline-flex items-center gap-2 rounded-full border border-forest-700 bg-white/50 px-5 py-2.5 text-sm font-semibold text-forest-900">Conheça o Meu Jardim <ArrowRight className="h-4 w-4"/></button>
            </div>
            <div className="absolute bottom-4 right-5 flex items-end gap-1 text-5xl sm:text-6xl"><span>🌱</span><span>🌿</span><span className="text-8xl">🌳</span><span>🦋</span></div>
          </div>
        </div>
      </section>

      <section id="planos-home" className="scroll-mt-24 border-b border-line bg-[#faf7f0]">
        <div className="mx-auto max-w-6xl px-5 py-12 lg:px-6 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[.85fr_2.15fr] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Planos</p>
              <h2 className="mt-2 font-serif text-3xl leading-tight text-forest-900 sm:text-4xl">Escolha o seu momento</h2>
              <p className="mt-4 text-sm leading-6 text-ink-soft">Comece gratuitamente e evolua no seu ritmo. Sempre com o que você precisa, quando precisar.</p>
              <button onClick={() => onNavigate('pricing')} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-forest-800 underline underline-offset-4">Comparar todos os planos <ArrowRight className="h-4 w-4"/></button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map(plan => (
                <article key={plan.key} className={`relative flex min-h-[330px] flex-col rounded-[26px] border bg-white p-6 ${plan.featured ? 'border-forest-400 shadow-[0_16px_35px_rgba(39,66,50,.09)]' : 'border-line'}`}>
                  {plan.featured && <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest-900 px-4 py-1 text-[9px] font-semibold uppercase tracking-wider text-white">Mais escolhido</span>}
                  <h3 className="text-center font-serif text-2xl text-forest-900">{plan.name}</h3>
                  <p className="mt-1 min-h-10 text-center text-xs text-ink-soft">{plan.promise}</p>
                  <p className="mt-4 text-center font-serif text-3xl text-forest-900">{prices[plan.key as keyof typeof prices]?.display ?? plan.fallbackPrice}</p>
                  <p className="text-center text-[10px] text-ink-soft">{plan.period}</p>
                  <ul className="mt-5 space-y-2.5">{plan.items.map(item=><li key={item} className="flex items-start gap-2 text-xs text-ink"><Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-forest-600" />{item}</li>)}</ul>
                  <button onClick={() => onNavigate(plan.key === 'free' ? 'auth' : 'pricing')} className={`mt-auto rounded-full px-4 py-2.5 text-xs font-semibold ${plan.featured ? 'bg-forest-900 text-white' : 'border border-forest-700 text-forest-900'}`}>{plan.cta}</button>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-[#fffdf9]">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-900 text-white"><LockKeyhole className="h-5 w-5"/></span><div><h2 className="font-serif text-2xl text-forest-900">Seus registros são seus.</h2><p className="text-xs text-ink-soft">Privacidade, segurança e respeito fazem parte da nossa essência.</p></div></div>
          <div className="grid gap-4 text-xs text-ink-soft sm:grid-cols-3 lg:min-w-[560px]">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-forest-600"/> Seus dados são privados por padrão</span>
            <span className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-forest-600"/> Não são públicos</span>
            <span className="flex items-center gap-2"><MessageCircleHeart className="h-4 w-4 text-forest-600"/> Não substitui acompanhamento profissional</span>
          </div>
        </div>
      </section>

      <section id="conteudos-home" className="scroll-mt-24 bg-[#f7f2e8]">
        <div className="mx-auto grid max-w-6xl lg:grid-cols-[1.2fr_.8fr]">
          <div className="flex items-center gap-6 px-5 py-10 lg:px-6">
            <div className="hidden h-32 w-36 flex-shrink-0 items-center justify-center rounded-[24px] bg-[#e6dfcf] text-6xl sm:flex">🪴</div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-forest-600">Conteúdos</p>
              <h2 className="mt-2 font-serif text-3xl text-forest-900">Inspiração para o seu dia a dia</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">Artigos, reflexões e conteúdos práticos sobre emoções, autoconhecimento e bem-estar.</p>
              <button onClick={() => onNavigate('articles')} className="mt-4 inline-flex items-center gap-2 rounded-full border border-forest-700 px-5 py-2.5 text-sm font-semibold text-forest-900">Explorar conteúdos do blog <ArrowRight className="h-4 w-4"/></button>
            </div>
          </div>
          <div className="flex items-center justify-center bg-forest-900 px-6 py-10 text-center text-white lg:rounded-tl-[34px]">
            <div className="max-w-sm"><BookOpen className="mx-auto h-5 w-5 text-mint"/><h2 className="mt-3 font-serif text-3xl leading-tight">Você não precisa entender tudo hoje.</h2><p className="mt-3 text-sm leading-6 text-white/80">Comece registrando como você está. O resto, a gente constrói juntos.</p><button onClick={() => onNavigate('auth')} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#fbf7ef] px-5 py-2.5 text-sm font-semibold text-forest-900">Criar minha conta gratuita <ArrowRight className="h-4 w-4"/></button></div>
          </div>
        </div>
      </section>

      <div className="sr-only">Privacidade em primeiro lugar. Apoio, não diagnóstico. Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.</div>
    </>
  )
}
