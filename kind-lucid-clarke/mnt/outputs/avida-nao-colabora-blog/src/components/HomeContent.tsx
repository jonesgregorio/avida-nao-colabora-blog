import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface HomeContentProps {
  onNavigate: (section: string) => void
}

interface SiteMetric { id: string; key: string | null; label: string | null; value: string }
interface Testimonial { id: string; name: string; text: string; rating: number; role?: string | null }

const FALLBACK_METRICS = [
  { value: '+800', label: 'pessoas já passaram por aqui' },
  { value: '335',  label: 'usuários ativos atualmente' },
  { value: '+1.300', label: 'registros emocionais criados' },
  { value: '4,7/5', label: 'avaliação média' },
]
const FALLBACK_TESTIMONIALS = [
  { name: 'Mariana L.', text: 'Comecei usando o diário alguns dias por semana. Gosto porque não parece uma cobrança, só um espaço para entender melhor o que estou sentindo.', rating: 5 },
  { name: 'Rafael M.', text: 'Os artigos têm uma linguagem leve. Em alguns dias, só ler o resumo e responder uma pergunta já me ajuda a organizar as ideias.', rating: 5 },
  { name: 'Camila R.', text: 'Ainda estou conhecendo a plataforma, mas gostei da proposta de juntar diário, conteúdos e reflexões em um só lugar.', rating: 5 },
]

const whoCards = [
  { icon: '🫂', text: 'Quem sente que carrega tudo sozinho(a)' },
  { icon: '🔍', text: 'Quem quer entender melhor suas emoções' },
  { icon: '🌊', text: 'Quem vive altos e baixos emocionais' },
  { icon: '📝', text: 'Quem quer organizar os pensamentos' },
  { icon: '🌱', text: 'Quem quer criar uma rotina de autocuidado' },
  { icon: '🛡️', text: 'Quem precisa de um espaço seguro para registrar o que sente' },
  { icon: '📈', text: 'Quem quer acompanhar sua evolução sem julgamento' },
]

const steps = [
  { num: '01', title: 'Responda um questionário inicial', desc: 'Entenda como você está se sentindo agora com perguntas acolhedoras sobre seu estado emocional.' },
  { num: '02', title: 'Registre como você está se sentindo no diário', desc: 'Escreva sobre o seu dia, escolha marcadores emocionais e acompanhe o que está passando por você.' },
  { num: '03', title: 'Acompanhe seus padrões emocionais', desc: 'Veja gráficos e resumos que revelam tendências ao longo do tempo, sem julgamentos.' },
  { num: '04', title: 'Receba conteúdos, desafios e sugestões', desc: 'Com base no seu plano, acesse recursos personalizados para apoiar seu autocuidado no dia a dia.' },
]


export default function HomeContent({ onNavigate }: HomeContentProps) {
  const [metrics, setMetrics] = useState<{ value: string; label: string }[]>(FALLBACK_METRICS)
  const [testimonials, setTestimonials] = useState<{ name: string; text: string; rating: number; role?: string | null }[]>(FALLBACK_TESTIMONIALS)

  useEffect(() => {
    supabase.from('site_metrics').select('*').then(({ data }) => {
      if (data && data.length > 0) {
        const mapped = (data as SiteMetric[]).map(m => ({ value: m.value, label: m.label || m.key || '' }))
        setMetrics(mapped)
      }
    })
    supabase.from('testimonials').select('id,name,text,rating,role').eq('active', true).order('created_at', { ascending: false }).limit(6).then(({ data }) => {
      if (data && data.length > 0) setTestimonials(data as Testimonial[])
    })
  }, [])

  return (
    <>
      {/* Para quem é */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Para quem é</p>
          <h2 className="font-serif text-3xl md:text-4xl text-sage-800">Este espaço foi criado para você se…</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {whoCards.map((card, i) => (
            <div
              key={i}
              className="bg-white border border-sand-100 rounded-xl p-5 flex items-start gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl flex-shrink-0">{card.icon}</span>
              <p className="text-sm text-sage-700 leading-relaxed">{card.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Como funciona */}
      <section className="py-16" style={{ background: 'linear-gradient(135deg, #f5f0fa 0%, #faf8f4 100%)' }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Como funciona</p>
            <h2 className="font-serif text-3xl md:text-4xl text-sage-800">Simples, seguro e no seu ritmo</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-purple-50 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-semibold text-sage-800 mb-1">{step.title}</h3>
                  <p className="text-sm text-sage-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recursos leitura em autocuidado */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-emerald-500 text-sm uppercase tracking-widest mb-2">Recursos</p>
          <h2 className="font-serif text-3xl md:text-4xl text-sage-800 mb-3">
            Recursos para transformar leitura em autocuidado
          </h2>
          <p className="text-sage-500 max-w-xl mx-auto">
            Cada recurso foi pensado para você usar no seu ritmo, sem pressão e sem cobranças.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: '📔',
              title: 'Diário emocional',
              desc: 'Registre como você está se sentindo com perguntas guiadas e marcadores emocionais.',
              plan: 'Gratuito',
              planColor: 'bg-emerald-100 text-emerald-700',
            },
            {
              icon: '📖',
              title: 'Artigos guiados',
              desc: 'Leitura acolhedora sobre temas como ansiedade, autoestima e relações.',
              plan: 'Gratuito',
              planColor: 'bg-emerald-100 text-emerald-700',
            },
            {
              icon: '📦',
              title: 'Caixa de cuidado',
              desc: 'Salve artigos, perguntas e recursos para acessar quando precisar.',
              plan: 'Essencial',
              planColor: 'bg-blue-100 text-blue-700',
            },
            {
              icon: '🗺️',
              title: 'Trilhas de autocuidado',
              desc: 'Sequências de leitura guiada por tema, no seu ritmo.',
              plan: 'Essencial',
              planColor: 'bg-blue-100 text-blue-700',
            },
            {
              icon: '🧭',
              title: 'Mapa emocional',
              desc: 'Visualize seus padrões emocionais ao longo do tempo em gráficos.',
              plan: 'Terapêutico',
              planColor: 'bg-purple-100 text-purple-700',
            },
            {
              icon: '📄',
              title: 'Relatórios em PDF',
              desc: 'Exporte seus registros e artigos favoritos para compartilhar com seu terapeuta.',
              plan: 'Essencial',
              planColor: 'bg-blue-100 text-blue-700',
            },
            {
              icon: '✨',
              title: 'Recomendações personalizadas',
              desc: 'Sugestões de conteúdo baseadas no que você está vivendo agora.',
              plan: 'Terapêutico',
              planColor: 'bg-purple-100 text-purple-700',
            },
            {
              icon: '💬',
              title: 'Orientação mensal',
              desc: 'Envie uma mensagem mensal e receba orientação de apoio dentro do site.',
              plan: 'Terapêutico',
              planColor: 'bg-purple-100 text-purple-700',
            },
          ].map((resource, i) => (
            <div
              key={i}
              className="bg-white border border-sand-100 rounded-xl p-5 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-3xl mb-1">{resource.icon}</span>
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sage-800 text-sm leading-snug">{resource.title}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${resource.planColor}`}>
                  {resource.plan}
                </span>
              </div>
              <p className="text-xs text-sage-500 leading-relaxed">{resource.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button
            onClick={() => onNavigate('pricing')}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-md hover:shadow-lg"
          >
            Ver todos os planos
          </button>
        </div>
      </section>

      {/* Prova Social */}
      {/* Dados demonstrativos temporários. Substituir por métricas reais do banco futuramente. */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl text-sage-800 mb-2">Muita gente já está por aqui</h2>
            <p className="text-sage-500">Uma comunidade pequena, mas crescendo com cuidado todos os dias.</p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
            {metrics.map((m, i) => (
              <div key={i} className="text-center p-5 bg-stone-50 rounded-2xl border border-stone-100">
                <p className="text-3xl font-bold text-sage-600 mb-1">{m.value}</p>
                <p className="text-sage-500 text-sm">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Avaliações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {testimonials.map((r, i) => (
              <div key={i} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(r.rating || 5)].map((_, s) => <span key={s} className="text-amber-400 text-sm">★</span>)}
                </div>
                <p className="text-sage-600 text-sm italic mb-3">"{r.text}"</p>
                <p className="text-sage-400 text-xs font-medium">{r.name}{r.role ? ` · ${r.role}` : ''}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-sage-400 text-xs mt-6">* Dados demonstrativos temporários. Avaliações são de usuários da plataforma em fase inicial.</p>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>Importante:</strong> Este serviço é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Ele não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.
          </p>
        </div>
      </div>
    </>
  )
}
