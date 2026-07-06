import { BookOpen, Route, Wind, Target, Bookmark, ArrowRight, ArrowLeft } from 'lucide-react'

interface GuidedContentProps {
  onNavigate: (section: string) => void
  onBack?: () => void
}

// Hub que reúne os conteúdos antes espalhados no menu (Blog, Trilhas,
// Meditações, Mini-desafios, Caixa de cuidado) numa única área.
const AREAS = [
  { to: 'articles', Icon: BookOpen, bg: 'bg-mint', color: 'text-forest-600', title: 'Blog', desc: 'Textos escritos com carinho sobre ansiedade, autoestima, relações e mais.' },
  { to: 'trails', Icon: Route, bg: 'bg-sky', color: 'text-[#3d6ea5]', title: 'Trilhas de leitura', desc: 'Sequências guiadas por tema, para aprofundar no seu ritmo.' },
  { to: 'meditations', Icon: Wind, bg: 'bg-lilac', color: 'text-[#7c5cbf]', title: 'Meditações guiadas', desc: 'Práticas curtas em texto para acalmar e reorganizar o que você sente.' },
  { to: 'challenges', Icon: Target, bg: 'bg-coral', color: 'text-[#c05f3c]', title: 'Práticas e desafios', desc: 'Pequenos exercícios para colocar o autocuidado em movimento.' },
  { to: 'saved', Icon: Bookmark, bg: 'bg-mint', color: 'text-forest-600', title: 'Caixa de cuidado', desc: 'O que você salvou para acessar quando precisar.' },
]

export default function GuidedContent({ onNavigate, onBack }: GuidedContentProps) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-2 text-ink-soft hover:text-forest-900 mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      )}

      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900">Conteúdos guiados</h1>
        <p className="mt-2 text-ink-soft max-w-xl">
          Textos, práticas e exercícios de acordo com o que você está vivendo agora.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {AREAS.map(({ to, Icon, bg, color, title, desc }) => (
          <button
            key={to}
            onClick={() => onNavigate(to)}
            className="text-left bg-paper-soft border border-line rounded-3xl p-6 hover:shadow-md hover:border-forest-200 transition-all group"
          >
            <span className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </span>
            <h2 className="font-serif text-xl text-forest-900">{title}</h2>
            <p className="mt-1.5 text-sm text-ink-soft leading-relaxed">{desc}</p>
            <span className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium ${color}`}>
              Acessar <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
