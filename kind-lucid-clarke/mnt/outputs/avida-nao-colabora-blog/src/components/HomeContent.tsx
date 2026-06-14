interface HomeContentProps {
  onNavigate: (section: string) => void
}

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

const features = [
  { icon: '📔', title: 'Diário de bem-estar', desc: 'Registre como você está se sentindo com facilidade e privacidade.' },
  { icon: '📋', title: 'Questionários de autoavaliação', desc: 'Perguntas acolhedoras para entender seu estado emocional.' },
  { icon: '📊', title: 'Gráficos de evolução', desc: 'Visualize seus padrões emocionais ao longo do tempo.' },
  { icon: '📄', title: 'Relatórios mensais', desc: 'Resumo do seu mês com destaques e tendências.' },
  { icon: '🌟', title: 'Mini-desafios de autocuidado', desc: 'Pequenas ações diárias para criar hábitos positivos.' },
  { icon: '📚', title: 'Conteúdos guiados', desc: 'Textos reflexivos e exercícios emocionais selecionados para você.' },
  { icon: '🗺️', title: 'Planos de autocuidado', desc: 'Um plano semanal personalizado para seus objetivos emocionais.' },
  { icon: '💡', title: 'Recomendações personalizadas', desc: 'Sugestões de conteúdo baseadas no que você está vivendo.' },
]

export default function HomeContent({ onNavigate }: HomeContentProps) {
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

      {/* Recursos principais */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Recursos</p>
          <h2 className="font-serif text-3xl md:text-4xl text-sage-800">O que você encontra aqui</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white border border-sand-100 rounded-xl p-5 text-center shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-3xl mb-3 block">{f.icon}</span>
              <h3 className="font-semibold text-sage-800 text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-sage-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            onClick={() => onNavigate('auth')}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-md hover:shadow-lg mr-3"
          >
            Começar gratuitamente
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className="bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-sm"
          >
            Ver planos
          </button>
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
