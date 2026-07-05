interface TermsPageProps {
  onNavigate?: (section: string) => void
}

export default function TermsPage({ onNavigate }: TermsPageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Legal</p>
        <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-2">Termos de Uso</h1>
        <p className="text-sage-500 text-sm">Última atualização: Janeiro de 2025</p>
      </div>

      {/* Emergency warning - prominent */}
      <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5 mb-8">
        <h2 className="font-bold text-red-700 mb-2 flex items-center gap-2">
          <span>⚠️</span> Aviso de não emergência
        </h2>
        <p className="text-sm text-red-700 leading-relaxed">
          <strong>Este serviço NÃO é adequado para situações de crise ou emergência.</strong> Se você estiver pensando em se machucar, em suicídio, ou estiver em perigo, por favor:
        </p>
        <ul className="mt-2 space-y-1">
          <li className="text-sm text-red-700 flex items-center gap-2">
            <span>📞</span> Ligue para o <strong>CVV: 188</strong> (gratuito, 24h)
          </li>
          <li className="text-sm text-red-700 flex items-center gap-2">
            <span>🚨</span> Ligue para o <strong>SAMU: 192</strong>
          </li>
          <li className="text-sm text-red-700 flex items-center gap-2">
            <span>🏥</span> Vá ao pronto-socorro mais próximo
          </li>
        </ul>
      </div>

      <div className="prose-sm text-sage-600 space-y-8">
        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">1. Uso aceitável</h2>
          <p className="text-sm leading-relaxed mb-3">
            O A Vida Não Colabora é uma plataforma de apoio ao autoconhecimento e organização emocional. Ao usar este serviço, você concorda em utilizá-lo de forma responsável e respeitosa.
          </p>
          <p className="text-sm leading-relaxed">
            É proibido usar a plataforma para fins ilegais, compartilhar conteúdo que prejudique terceiros, tentar acessar dados de outros usuários ou burlar sistemas de segurança.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">2. O que a plataforma é — e o que não é</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-700 mb-2 text-sm">✓ O que somos</h3>
              <ul className="space-y-1">
                {[
                  'Uma ferramenta de autoconhecimento',
                  'Um espaço de organização emocional',
                  'Um diário digital de bem-estar',
                  'Uma plataforma de conteúdos sobre autocuidado',
                  'Um recurso de suporte emocional complementar',
                ].map((item, i) => (
                  <li key={i} className="text-xs text-green-700">{item}</li>
                ))}
              </ul>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-semibold text-red-700 mb-2 text-sm">✗ O que não somos</h3>
              <ul className="space-y-1">
                {[
                  'Um serviço de saúde mental clínico',
                  'Um substituto para psicólogo ou psiquiatra',
                  'Um serviço de diagnóstico',
                  'Um serviço de emergência ou crise',
                  'Uma plataforma médica de qualquer tipo',
                ].map((item, i) => (
                  <li key={i} className="text-xs text-red-700">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">3. Responsabilidade do usuário</h2>
          <p className="text-sm leading-relaxed mb-3">
            Você é responsável por manter suas credenciais de acesso em segurança e por todas as atividades realizadas em sua conta.
          </p>
          <p className="text-sm leading-relaxed">
            Ao usar este serviço, você reconhece que ele é uma ferramenta complementar de autocuidado e que decisões sobre sua saúde mental devem ser tomadas com o auxílio de profissionais habilitados.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">4. Limitações do serviço</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-sm text-amber-800 leading-relaxed mb-3">
              <strong>Declaramos explicitamente que:</strong>
            </p>
            <ul className="space-y-2">
              {[
                'Não realizamos diagnósticos de condições de saúde mental',
                'Não prescrevemos tratamentos, medicamentos ou intervenções clínicas',
                'Não garantimos resultados terapêuticos de qualquer natureza',
                'Relatórios e gráficos são para fins de autoconhecimento, não clínicos',
                'O Plano Terapêutico Plus inclui sessão com profissional parceiro — não é psicoterapia clínica',
                'Não substituímos acompanhamento profissional continuado',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
                  <span className="flex-shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">5. Planos e pagamentos</h2>
          <p className="text-sm leading-relaxed mb-3">
            Os planos pagos são cobrados mensalmente via Stripe. Você pode cancelar a qualquer momento sem multa. O cancelamento é efetivo no final do período já pago.
          </p>
          <p className="text-sm leading-relaxed">
            Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias. Assinantes ativos serão notificados por e-mail.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">6. Propriedade intelectual</h2>
          <p className="text-sm leading-relaxed">
            Todo o conteúdo da plataforma (artigos, exercícios, meditações, design) é propriedade do A Vida Não Colabora. O conteúdo pessoal que você registra no diário é seu e pode ser exportado ou excluído a qualquer momento.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">7. Contato</h2>
          <p className="text-sm leading-relaxed">
            Dúvidas sobre estes termos:{' '}
            <a href="mailto:contato@avidanaocolabora.com" className="text-purple-600 underline">
              contato@avidanaocolabora.com
            </a>
          </p>
        </section>

        {onNavigate && (
          <div className="pt-4 border-t border-sand-200">
            <button
              onClick={() => onNavigate('home')}
              className="text-sm text-sage-500 hover:text-sage-700 transition-colors"
            >
              ← Voltar para o início
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
