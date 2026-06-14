interface AboutPageProps {
  onNavigate: (section: string) => void
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Hero */}
      <div
        className="rounded-2xl p-8 md:p-12 mb-10 text-center"
        style={{ background: 'linear-gradient(135deg, #f5f0fa 0%, #faf8f4 100%)' }}
      >
        <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-4">
          Um espaço para quem sente
        </h1>
        <p className="text-sage-600 leading-relaxed max-w-xl mx-auto">
          O <strong>A Vida Não Colabora</strong> nasceu para ser um espaço de acolhimento, reflexão e organização emocional — para quem sente que as coisas às vezes pesam demais, e que carrega tudo sozinho(a).
        </p>
      </div>

      <div className="space-y-10">
        {/* Nossa missão */}
        <section>
          <h2 className="font-serif text-2xl text-sage-800 mb-3 flex items-center gap-2">
            <span>🌱</span> Nossa missão
          </h2>
          <div className="prose-sm text-sage-600 leading-relaxed space-y-3">
            <p>
              Nossa missão é oferecer um espaço seguro, gentil e sem julgamentos para que as pessoas possam registrar como estão se sentindo, entender seus padrões emocionais e criar pequenos hábitos de autocuidado no dia a dia.
            </p>
            <p>
              Acreditamos que o autoconhecimento é um caminho poderoso — e que cada pessoa merece ferramentas para se entender melhor, sem pressão e no seu próprio ritmo.
            </p>
          </div>
        </section>

        {/* Para quem é */}
        <section>
          <h2 className="font-serif text-2xl text-sage-800 mb-3 flex items-center gap-2">
            <span>🫂</span> Para quem é
          </h2>
          <div className="text-sage-600 leading-relaxed space-y-2">
            <p>Este espaço foi criado para pessoas que:</p>
            <ul className="space-y-1.5 ml-4">
              {[
                'Querem entender melhor suas emoções',
                'Vivem altos e baixos emocionais frequentes',
                'Precisam de um lugar seguro para registrar o que sentem',
                'Querem criar uma rotina de autocuidado de forma sustentável',
                'Buscam acompanhar sua evolução emocional ao longo do tempo',
                'Desejam apoio sem julgamento e sem pressa',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-purple-400 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* O que oferecemos */}
        <section>
          <h2 className="font-serif text-2xl text-sage-800 mb-3 flex items-center gap-2">
            <span>✨</span> O que oferecemos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: '📔', title: 'Diário de bem-estar', desc: 'Espaço para registrar sentimentos com diferentes níveis de profundidade conforme o plano.' },
              { icon: '📋', title: 'Questionários de autoavaliação', desc: 'Perguntas acolhedoras para entender como você está se sentindo.' },
              { icon: '📊', title: 'Gráficos e relatórios', desc: 'Visualize seus padrões emocionais e evolução ao longo do tempo.' },
              { icon: '🌟', title: 'Mini-desafios de autocuidado', desc: 'Ações pequenas e práticas para criar hábitos positivos no dia a dia.' },
              { icon: '📚', title: 'Artigos e conteúdos', desc: 'Textos reflexivos sobre bem-estar emocional, autoconhecimento e autocuidado.' },
              { icon: '🗺️', title: 'Planos personalizados', desc: 'Sugestões e planos de autocuidado adaptados ao que você está vivendo.' },
            ].map((item, i) => (
              <div key={i} className="bg-white border border-sand-100 rounded-xl p-4 flex gap-3 shadow-sm">
                <span className="text-xl flex-shrink-0">{item.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-sage-700 mb-0.5">{item.title}</h3>
                  <p className="text-xs text-sage-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* O que não prometemos */}
        <section>
          <h2 className="font-serif text-2xl text-sage-800 mb-3 flex items-center gap-2">
            <span>⚖️</span> O que não prometemos
          </h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
            {[
              'Não fazemos diagnósticos de qualquer tipo',
              'Não substituímos acompanhamento psicológico, psiquiátrico ou médico',
              'Não tratamos condições de saúde mental',
              'Não prometemos cura ou resultado clínico de qualquer natureza',
              'Não somos um serviço de emergência ou crise',
            ].map((item, i) => (
              <p key={i} className="text-sm text-amber-800 flex items-start gap-2">
                <span className="font-bold flex-shrink-0">✗</span>
                <span>{item}</span>
              </p>
            ))}
          </div>
        </section>

        {/* Sobre o autoconhecimento */}
        <section>
          <h2 className="font-serif text-2xl text-sage-800 mb-3 flex items-center gap-2">
            <span>🔍</span> Sobre o autoconhecimento
          </h2>
          <div className="text-sage-600 leading-relaxed space-y-3 text-sm">
            <p>
              O autoconhecimento é um processo contínuo, não linear e profundamente pessoal. Ele não exige perfeição — exige presença e disposição para olhar para si mesmo(a) com honestidade e gentileza.
            </p>
            <p>
              Registrar o que sentimos, perceber padrões e nomear emoções são práticas simples que, ao longo do tempo, podem transformar nossa relação conosco e com o mundo ao redor.
            </p>
            <p>
              Aqui, nenhuma emoção é errada. Nenhum caminho é mais válido do que outro. Você está no lugar certo, da forma que você é.
            </p>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <h3 className="font-semibold text-purple-800 mb-2 text-sm">Aviso importante</h3>
          <p className="text-sm text-purple-700 leading-relaxed">
            Este serviço não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência. Se você estiver em crise, por favor ligue para o <strong>CVV: 188</strong> (gratuito, 24h) ou acesse <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer" className="underline">cvv.org.br</a>.
          </p>
        </div>

        <div className="text-center pt-4">
          <button
            onClick={() => onNavigate('auth')}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-full font-medium text-sm transition-colors shadow-md"
          >
            Começar gratuitamente
          </button>
        </div>
      </div>
    </div>
  )
}
