interface PrivacyPageProps {
  onNavigate?: (section: string) => void
}

export default function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Legal</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-2">Política de Privacidade</h1>
          <p className="text-ink-soft text-sm">Última atualização: Agosto de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Intro */}
        <div className="bg-white border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm leading-relaxed">
            Sua privacidade é fundamental para nós. Esta política explica de forma clara e honesta como tratamos seus dados — especialmente os dados emocionais, que são sensíveis e merecem cuidado especial.
          </p>
        </div>

        {[
          {
            title: '1. Quais dados coletamos',
            items: [
              'Dados de conta: nome, e-mail e senha (armazenada de forma criptografada)',
              'Dados do diário: entradas, marcadores emocionais, humor e notas que você registra',
              'Dados de questionários: respostas às avaliações de autoavaliação',
              'Dados de uso: páginas acessadas e funcionalidades utilizadas (para melhorar o serviço)',
              'Plano de assinatura e histórico de pagamentos (processados pelo Stripe)',
            ],
          },
          {
            title: '2. Por que coletamos',
            items: [
              'Para oferecer o serviço de diário e acompanhamento emocional',
              'Para personalizar conteúdos e sugestões de acordo com seu plano',
              'Para gerar relatórios e gráficos de evolução',
              'Para autenticar sua conta e proteger seus dados',
              'Para processar pagamentos de forma segura',
            ],
          },
        ].map(section => (
          <section key={section.title} className="bg-white border border-line rounded-2xl p-6">
            <h2 className="font-serif text-xl text-forest-900 mb-4">{section.title}</h2>
            <ul className="space-y-2.5">
              {section.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">3. Como são usados</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Seus dados são usados exclusivamente para operar e melhorar este serviço. Não vendemos, não alugamos e não compartilhamos seus dados com terceiros para fins de marketing ou publicidade.</p>
            <p>Dados do diário e dos questionários são usados apenas para gerar seus próprios relatórios, gráficos e sugestões. Esses dados não são acessados pela equipe salvo em situações técnicas de suporte, com sua autorização.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">4. Como são armazenados</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Seus dados são armazenados em servidores seguros através da plataforma Supabase, com criptografia em trânsito (HTTPS) e em repouso. Pagamentos são processados pelo Stripe, certificado PCI DSS nível 1.</p>
            <p>Mantemos seus dados enquanto sua conta estiver ativa. Após a exclusão da conta, seus dados são removidos em até 30 dias.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">5. Compartilhamento</h2>
          <p className="text-sm text-ink-soft mb-4">Compartilhamos dados apenas com:</p>
          <ul className="space-y-2.5 mb-4">
            {[
              'Stripe: para processamento de pagamentos',
              'Supabase: para hospedagem e banco de dados',
              'Autoridades legais: somente se exigido por lei brasileira',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-soft leading-relaxed">
            No Plano Plus, o profissional parceiro pode ter acesso ao seu relatório mensal para elaborar o comentário e a orientação por mensagem — somente com sua autorização explícita.
          </p>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">6. Seus direitos (LGPD)</h2>
          <p className="text-sm text-ink-soft mb-4">De acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018), você tem direito a:</p>
          <ul className="space-y-2.5">
            {[
              'Acessar todos os dados que temos sobre você',
              'Corrigir dados incompletos, inexatos ou desatualizados',
              'Solicitar a exclusão de seus dados pessoais',
              'Revogar o consentimento a qualquer momento',
              'Portabilidade dos dados em formato legível',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Dados emocionais — destaque */}
        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">7. Dados emocionais — confidencialidade</h2>
          <div className="bg-mint rounded-xl p-5">
            <p className="text-sm text-forest-900 font-medium mb-2">Tratamos dados do diário e emocionais com máxima confidencialidade.</p>
            <p className="text-sm text-forest-800 leading-relaxed">
              Registros do diário, questionários e marcadores emocionais são seus — apenas você pode acessá-los. Nossa equipe não lê seus registros pessoais. Esses dados são usados apenas de forma automática para gerar seus relatórios e sugestões, sem revisão humana.
            </p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-3">8. Contato</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Para exercer seus direitos, solicitar exclusão de dados ou tirar dúvidas, entre em contato pelo e-mail:{' '}
            <a href="mailto:privacidade@avidanaocolabora.com.br" className="text-forest-700 underline underline-offset-2">
              privacidade@avidanaocolabora.com.br
            </a>
          </p>
        </section>

        {onNavigate && (
          <div className="pt-2">
            <button onClick={() => onNavigate('home')} className="text-sm text-ink-soft hover:text-forest-800 transition-colors">
              ← Voltar para o início
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
