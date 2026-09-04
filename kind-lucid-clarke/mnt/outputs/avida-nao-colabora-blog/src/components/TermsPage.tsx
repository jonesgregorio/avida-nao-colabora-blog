import CmsPage from './CmsPage'
import { useSitePage } from '../lib/siteContent'

interface TermsPageProps {
  onNavigate?: (section: string) => void
}

export default function TermsPage({ onNavigate }: TermsPageProps) {
  const cms = useSitePage('termos')
  if (cms) return <CmsPage title={cms.title} body={cms.body_md} kicker="Legal" onNavigate={onNavigate} back />
  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Legal</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-2">Termos de Uso</h1>
          <p className="text-ink-soft text-sm">Última atualização: Agosto de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Aviso de emergência */}
        <div className="bg-white border border-red-200 rounded-2xl p-6">
          <h2 className="font-semibold text-red-700 mb-3 flex items-center gap-2 text-sm">
            <span>⚠️</span> Aviso de não emergência
          </h2>
          <p className="text-sm text-red-700 leading-relaxed mb-3">
            <strong>Este serviço NÃO é adequado para situações de crise ou emergência.</strong> Se você estiver pensando em se machucar, em suicídio, ou estiver em perigo, por favor:
          </p>
          <ul className="space-y-1.5">
            {[
              { icon: '📞', text: 'Ligue para o CVV: 188 (gratuito, 24h)' },
              { icon: '🚨', text: 'Ligue para o SAMU: 192' },
              { icon: '🏥', text: 'Vá ao pronto-socorro mais próximo' },
            ].map((item, i) => (
              <li key={i} className="text-sm text-red-700 flex items-center gap-2">
                <span>{item.icon}</span> {item.text}
              </li>
            ))}
          </ul>
        </div>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">1. Uso aceitável</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>O A Vida Não Colabora é uma plataforma de apoio ao autoconhecimento e organização emocional. Ao usar este serviço, você concorda em utilizá-lo de forma responsável e respeitosa.</p>
            <p>É proibido usar a plataforma para fins ilegais, compartilhar conteúdo que prejudique terceiros, tentar acessar dados de outros usuários ou burlar sistemas de segurança.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">2. O que a plataforma é — e o que não é</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-mint rounded-xl p-4">
              <h3 className="font-semibold text-forest-800 mb-3 text-sm">✓ O que somos</h3>
              <ul className="space-y-1.5">
                {[
                  'Uma ferramenta de autoconhecimento',
                  'Um espaço de organização emocional',
                  'Um diário digital de bem-estar',
                  'Uma plataforma de conteúdos sobre autocuidado',
                  'Um recurso de suporte emocional complementar',
                ].map((item, i) => (
                  <li key={i} className="text-xs text-forest-800 flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-forest-500 flex-shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-paper-soft border border-line rounded-xl p-4">
              <h3 className="font-semibold text-forest-900 mb-3 text-sm">✕ O que não somos</h3>
              <ul className="space-y-1.5">
                {[
                  'Um serviço de saúde mental clínico',
                  'Um substituto para psicólogo ou psiquiatra',
                  'Um serviço de diagnóstico',
                  'Um serviço de emergência ou crise',
                  'Uma plataforma médica de qualquer tipo',
                ].map((item, i) => (
                  <li key={i} className="text-xs text-ink-soft flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-ink-soft flex-shrink-0 mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">3. Responsabilidade do usuário</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Você é responsável por manter suas credenciais de acesso em segurança e por todas as atividades realizadas em sua conta.</p>
            <p>Ao usar este serviço, você reconhece que ele é uma ferramenta complementar de autocuidado e que decisões sobre sua saúde mental devem ser tomadas com o auxílio de profissionais habilitados.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">4. Limitações do serviço</h2>
          <p className="text-sm text-ink-soft mb-4 font-medium">Declaramos explicitamente que:</p>
          <ul className="space-y-2.5">
            {[
              'Não realizamos diagnósticos de condições de saúde mental',
              'Não prescrevemos tratamentos, medicamentos ou intervenções clínicas',
              'Não garantimos resultados terapêuticos de qualquer natureza',
              'Relatórios e gráficos são para fins de autoconhecimento, não clínicos',
              'O Plano Plus inclui recursos adicionais de autoconhecimento, plano de autocuidado e orientação mensal, sem substituir psicoterapia, avaliação clínica ou acompanhamento profissional continuado',
              'Não substituímos acompanhamento profissional continuado',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">5. Planos e pagamentos</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Os planos pagos são cobrados mensalmente via Stripe. Você pode cancelar a qualquer momento sem multa. O cancelamento é efetivo no final do período já pago.</p>
            <p>Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias. Assinantes ativos serão notificados por e-mail.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">6. Propriedade intelectual</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Todo o conteúdo da plataforma (artigos, exercícios, pausas emocionais, design) é propriedade do A Vida Não Colabora. O conteúdo pessoal que você registra no diário é seu e pode ser exportado ou excluído a qualquer momento.
          </p>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-3">7. Contato</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Dúvidas sobre estes termos:{' '}
            <a href="mailto:contato@avidanaocolabora.com.br" className="text-forest-700 underline underline-offset-2">
              contato@avidanaocolabora.com.br
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
