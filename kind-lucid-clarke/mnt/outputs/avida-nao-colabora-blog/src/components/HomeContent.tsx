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

      {/* Recursos para transformar leitura em autocuidado */}
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
              icon: '🌟',
              title: 'Preparação para sessão',
              desc: 'Organize o que você quer falar na sua próxima sessão com o terapeuta.',
              plan: 'Plus',
              planColor: 'bg-amber-100 text-amber-700',
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
            <p className="text-sage-500">Uma comunidade em crescimento, construída com cuidado, escuta e acolhimento.</p>
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-14">
            {[
              { value: '+780', label: 'pessoas já passaram por aqui' },
              { value: '215', label: 'usuários ativos atualmente' },
              { value: '+1.480', label: 'registros emocionais criados' },
              { value: '4,7/5', label: 'avaliação média' },
            ].map((m, i) => (
              <div key={i} className="text-center p-5 bg-stone-50 rounded-2xl border border-stone-100">
                <p className="text-3xl font-bold text-sage-600 mb-1">{m.value}</p>
                <p className="text-sage-500 text-sm">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Avaliações */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: 'Mariana L.', text: 'Comecei usando o diário alguns dias por semana. Gosto porque não parece uma cobrança, só um espaço para entender melhor o que estou sentindo.' },
              { name: 'Rafael M.', text: 'Os artigos têm uma linguagem leve. Em alguns dias, só ler o resumo e responder uma pergunta já me ajuda a organizar as ideias.' },
              { name: 'Camila R.', text: 'Ainda estou conhecendo a plataforma, mas gostei da proposta de juntar diário, conteúdos e reflexões em um só lugar.' },
              { name: 'Bruno A.', text: 'Entrei pelos textos e acabei testando o diário. Achei simples, direto e com uma linguagem bem humana.' },
              { name: 'Letícia P.', text: 'Gosto dos desafios leves. Eles não prometem resolver tudo, mas ajudam a dar um pequeno passo.' },
              { name: 'André M.', text: 'O que mais gostei foi o jeito como os textos falam de saúde emocional sem parecer algo pesado ou distante.' },
              { name: 'Juliana S.', text: 'Uso mais nos dias em que estou sobrecarregada. O diário me ajuda a colocar em palavras o que estava tudo misturado.' },
            ].map((r, i) => (
              <div key={i} className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, s) => <span key={s} className="text-amber-400 text-sm">★</span>)}
                </div>
                <p className="text-sage-600 text-sm italic mb-3">"{r.text}"</p>
                <p className="text-sage-400 text-xs font-medium">{r.name}</p>
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
