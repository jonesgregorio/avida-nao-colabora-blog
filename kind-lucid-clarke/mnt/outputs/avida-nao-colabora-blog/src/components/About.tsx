import { Heart, Shield, BookOpen } from 'lucide-react'

export default function About() {
  return (
    <section id="about" className="bg-sage-800 text-white py-20">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <p className="text-sage-300 text-sm uppercase tracking-widest mb-3">Sobre</p>
        <h2 className="font-serif text-4xl mb-6 leading-tight">
          Este é um espaço de<br />
          <em className="text-sage-300">acolhimento</em>
        </h2>
        <p className="text-sage-200 leading-relaxed mb-10 max-w-2xl mx-auto">
          A Vida Não Colabora nasceu de uma experiência pessoal com ansiedade, dor crônica e os percursos invisíveis da saúde mental. Não como espaço de diagnóstico, mas como um templo para as palavras que muitas vezes ficam presas dentro da gente.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {[
            { icon: Heart, title: 'Acolhimento', desc: 'Cada artigo, cada palavra foi escrita com a intenção de fazer você se sentir menos sozinho(a).' },
            { icon: Shield, title: 'Responsabilidade', desc: 'Somos transparentes: este blog não substitui acompanhamento profissional de saúde mental.' },
            { icon: BookOpen, title: 'Informação', desc: 'Conteúdo baseado em evidências, escrito de forma acessível e sem jargões desnecessários.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-sage-700/50 rounded-xl p-5">
              <Icon className="w-6 h-6 text-sage-300 mb-3 mx-auto" />
              <h3 className="font-serif text-lg mb-2">{title}</h3>
              <p className="text-sage-300 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-sage-700/40 rounded-xl px-6 py-5 inline-block">
          <p className="text-sage-200 text-sm">
            📞 Em crise? Ligue para o CVV — Centro de Valorização da Vida: <strong className="text-white">188</strong>
          </p>
        </div>
      </div>
    </section>
  )
}
