import { ChevronDown } from 'lucide-react'

interface HeroProps {
  onNavigate: (section: string) => void
}

export default function Hero({ onNavigate }: HeroProps) {
  return (
    <section
      id="home"
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #f4f7f4 0%, #faf8f4 40%, #f0f7ff 100%)',
      }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 rounded-full bg-sage-100/60 animate-float" style={{ animationDelay: '0s' }} />
        <div className="absolute top-40 right-20 w-20 h-20 rounded-full bg-ocean-100/60 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-32 left-1/4 w-24 h-24 rounded-full bg-sand-200/60 animate-float" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center animate-slide-up">
        <p className="text-sage-500 text-sm font-medium uppercase tracking-widest mb-4">
          Templo das Palavras
        </p>

        <h1 className="font-serif text-5xl md:text-7xl text-sage-800 mb-6 leading-tight">
          A Vida Não<br />
          <em className="text-sage-500">Colabora</em>
        </h1>

        <p className="text-lg md:text-xl text-sage-600 max-w-2xl mx-auto mb-4 leading-relaxed">
          Um espaço de acolhimento sobre ansiedade, depressão, fibromialgia e os percursos invisíveis da saúde mental.
        </p>
        <p className="text-base text-sage-500 max-w-xl mx-auto mb-10 leading-relaxed">
          Aqui, as palavras têm colo. Você não está sozinho(a).
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('articles')}
            className="bg-sage-600 hover:bg-sage-700 text-white px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-md hover:shadow-lg"
          >
            Ler artigos
          </button>
          <button
            onClick={() => onNavigate('questionnaire')}
            className="bg-white hover:bg-sage-50 text-sage-700 border border-sage-200 px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-sm"
          >
            Avaliar meu bem-estar
          </button>
        </div>

        <button
          onClick={() => onNavigate('articles')}
          className="mt-16 flex flex-col items-center gap-2 text-sage-400 hover:text-sage-600 mx-auto transition-colors"
        >
          <span className="text-xs">Role para explorar</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </div>
    </section>
  )
}
