interface HeroProps {
  onNavigate: (section: string) => void
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section
      id="home"
      className="relative min-h-[88vh] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f5f0fa 0%, #faf8f4 45%, #f8f4f0 70%, #f0ede8 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-16 left-8 w-48 h-48 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #c4b5d4, transparent)', filter: 'blur(40px)' }}
        />
        <div
          className="absolute bottom-24 right-12 w-64 h-64 rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #d4c5b0, transparent)', filter: 'blur(50px)' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #b8a8c8, transparent)', filter: 'blur(60px)' }}
        />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <p className="text-purple-400 text-sm font-medium uppercase tracking-widest mb-5 opacity-80">
          Bem-estar emocional
        </p>

        <h1 className="font-serif text-4xl md:text-6xl text-sage-800 mb-6 leading-tight">
          A vida não colabora.<br />
          <em className="text-purple-500">Mas você ainda pode se cuidar.</em>
        </h1>

        <p className="text-base md:text-lg text-sage-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Um espaço de apoio emocional para registrar sentimentos, entender padrões, acompanhar sua evolução e criar pequenas práticas de autocuidado no dia a dia.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('auth')}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-md hover:shadow-lg"
          >
            Começar gratuitamente
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className="bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-sm"
          >
            Conhecer os planos
          </button>
        </div>

        <p className="text-xs text-sage-400 mt-6 max-w-md mx-auto leading-relaxed">
          Este espaço é uma ferramenta de apoio ao autoconhecimento e à organização emocional. Não substitui acompanhamento psicológico, psiquiátrico ou médico.
        </p>
      </div>
    </section>
  )
}
