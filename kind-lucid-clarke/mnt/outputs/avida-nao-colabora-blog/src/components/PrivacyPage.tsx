interface PrivacyPageProps {
  onNavigate?: (section: string) => void
}

export default function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-purple-400 text-sm uppercase tracking-widest mb-2">Legal</p>
        <h1 className="font-serif text-3xl md:text-4xl text-sage-800 mb-2">Política de Privacidade</h1>
        <p className="text-sage-500 text-sm">Última atualização: Janeiro de 2025</p>
      </div>

      <div className="prose-sm text-sage-600 space-y-8">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
          <p className="text-sm text-purple-700 leading-relaxed">
            Sua privacidade é fundamental para nós. Esta política explica de forma clara e honesta como tratamos seus dados — especialmente os dados emocionais, que são sensíveis e merecem cuidado especial.
          </p>
        </div>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">1. Quais dados coletamos</h2>
          <ul className="space-y-2">
            {[
              'Dados de conta: nome, e-mail e senha (armazenada de forma criptografada)',
              'Dados do diário: entradas, marcadores emocionais, humor e notas que você registra',
              'Dados de questionários: respostas às avaliações de autoavaliação',
              'Dados de uso: páginas acessadas, funcionalidades utilizadas (para melhorar o serviço)',
              'Plano de assinatura e histórico de pagamentos (processados pelo Stripe)',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">2. Por que coletamos</h2>
          <ul className="space-y-2">
            {[
              'Para oferecer o serviço de diário e acompanhamento emocional',
              'Para personalizar conteúdos e sugestões de acordo com seu plano',
              'Para gerar relatórios e gráficos de evolução',
              'Para autenticar sua conta e proteger seus dados',
              'Para processar pagamentos de forma segura',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">3. Como são usados</h2>
          <p className="text-sm leading-relaxed mb-3">
            Seus dados são usados exclusivamente para operar e melhorar este serviço. Não vendemos, não alugamos e não compartilhamos seus dados com terceiros para fins de marketing ou publicidade.
          </p>
          <p className="text-sm leading-relaxed">
            Dados do diário e dos questionários são usados apenas para gerar seus próprios relatórios, gráficos e sugestões. Esses dados não são acessados por nossa equipe salvo em situações técnicas de suporte, com sua autorização.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">4. Como são armazenados</h2>
          <p className="text-sm leading-relaxed mb-3">
            Seus dados são armazenados em servidores seguros através da plataforma Supabase, com criptografia em trânsito (HTTPS) e em repouso. Pagamentos são processados pelo Stripe, que é certificado PCI DSS nível 1.
          </p>
          <p className="text-sm leading-relaxed">
            Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão da conta, seus dados são removidos em até 30 dias.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">5. Compartilhamento</h2>
          <p className="text-sm leading-relaxed mb-3">Compartilhamos dados apenas com:</p>
          <ul className="space-y-2">
            {[
              'Stripe: para processamento de pagamentos',
              'Supabase: para hospedagem e banco de dados',
              'Autoridades legais: somente se exigido por lei brasileira',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm leading-relaxed mt-3">
            No Plano Plus, o profissional parceiro pode ter acesso ao seu relatório mensal para a sessão individual — somente com sua autorização explícita.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">6. Seus direitos (LGPD)</h2>
          <p className="text-sm leading-relaxed mb-3">De acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
          <ul className="space-y-2">
            {[
              'Acessar todos os dados que temos sobre você',
              'Corrigir dados incompletos, inexatos ou desatualizados',
              'Solicitar a exclusão de seus dados pessoais',
              'Revogar o consentimento a qualquer momento',
              'Portabilidade dos dados em formato legível',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-purple-400 flex-shrink-0 mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">7. Dados emocionais — confidencialidade</h2>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <p className="text-sm text-amber-800 leading-relaxed mb-2">
              <strong>Tratamos dados do diário e emocionais com máxima confidencialidade.</strong>
            </p>
            <p className="text-sm text-amber-700 leading-relaxed">
              Registros do diário, questionários e marcadores emocionais são seus — apenas você pode acessá-los. Nossa equipe não lê seus registros pessoais. Esses dados são usados apenas de forma automática para gerar seus relatórios e sugestões, sem revisão humana.
            </p>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-xl text-sage-800 mb-3">8. Contato</h2>
          <p className="text-sm leading-relaxed">
            Para exercer seus direitos, solicitar exclusão de dados ou tirar dúvidas sobre esta política, entre em contato pelo e-mail:{' '}
            <a href="mailto:privacidade@avidanaocolabora.com" className="text-purple-600 underline">
              privacidade@avidanaocolabora.com
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
