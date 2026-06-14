export function ResponsibilityPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-stone-800 mb-6">Aviso de Responsabilidade</h1>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8">
        <p className="text-amber-800 font-medium text-lg">
          🚨 Se você está passando por uma crise emocional severa, pensamentos de se machucar ou situação de emergência, procure ajuda imediata.
        </p>
        <p className="text-amber-700 mt-2">
          <strong>CVV – Centro de Valorização da Vida:</strong> Ligue 188 (24h) ou acesse{' '}
          <a href="https://www.cvv.org.br" target="_blank" rel="noopener noreferrer" className="underline">
            cvv.org.br
          </a>
        </p>
      </div>

      <div className="space-y-6 text-stone-700">
        <section>
          <h2 className="text-xl font-semibold text-stone-800 mb-3">O que é este serviço</h2>
          <p>
            A Vida Não Colabora é uma plataforma digital de apoio ao autoconhecimento emocional e organização do bem-estar pessoal. Não somos um serviço de saúde mental clínico e não oferecemos diagnóstico, tratamento, psicoterapia ou acompanhamento médico.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-800 mb-3">O que não fazemos</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Não realizamos diagnósticos de qualquer natureza</li>
            <li>Não substituímos psicólogos, psiquiatras ou qualquer profissional de saúde</li>
            <li>Não oferecemos tratamento clínico</li>
            <li>Não garantimos resultados terapêuticos</li>
            <li>Não nos responsabilizamos por decisões tomadas com base apenas nas informações deste site</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-800 mb-3">O que fazemos</h2>
          <p>
            Oferecemos um espaço seguro para registro emocional, organização de pensamentos, conteúdos educativos sobre saúde emocional e ferramentas de autoconhecimento. Nosso objetivo é apoiar — não substituir — o cuidado profissional.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-stone-800 mb-3">Quando buscar ajuda profissional</h2>
          <p>
            Se você percebe sintomas persistentes de ansiedade, depressão, crises emocionais frequentes, pensamentos de autolesão ou qualquer condição que afete significativamente sua qualidade de vida, procure um profissional de saúde mental.
          </p>
        </section>

        <div className="bg-stone-100 rounded-xl p-5 mt-8">
          <p className="text-stone-600 text-sm">
            Última atualização: Janeiro de 2025. Este aviso pode ser atualizado periodicamente.
          </p>
        </div>
      </div>
    </div>
  )
}

export default ResponsibilityPage
