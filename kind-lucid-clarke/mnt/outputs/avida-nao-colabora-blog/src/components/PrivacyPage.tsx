import CmsPage from './CmsPage'
import { useSitePage } from '../lib/siteContent'

interface PrivacyPageProps {
  onNavigate?: (section: string) => void
}

export default function PrivacyPage({ onNavigate }: PrivacyPageProps) {
  const cms = useSitePage('privacidade')
  if (cms) return <CmsPage title={cms.title} body={cms.body_md} kicker="Legal" onNavigate={onNavigate} back />

  return (
    <div className="min-h-screen bg-paper">
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Legal</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-2">Política de Privacidade</h1>
          <p className="text-ink-soft text-sm">Última atualização: Setembro de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <section className="bg-white border border-line rounded-2xl p-6">
          <p className="text-sm text-ink-soft leading-relaxed">No <strong>A Vida Não Colabora</strong>, privacidade é parte essencial da experiência. Utilizamos apenas as informações necessárias para manter sua conta, disponibilizar os recursos escolhidos, administrar assinaturas, manter a segurança da plataforma e cumprir obrigações legais.</p>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Seus registros são privados</h2>
          <div className="bg-mint rounded-xl p-5 space-y-3 text-sm text-forest-800 leading-relaxed">
            <p>O que você escreve no <strong>Diário</strong> e nos <strong>Check-ins</strong> é particular.</p>
            <p><strong>Os administradores do A Vida Não Colabora não têm acesso ao conteúdo desses registros. Eles não são publicados, compartilhados com outros usuários nem ficam disponíveis para leitura pela nossa equipe.</strong></p>
            <p>Esses espaços foram criados para que você possa escrever e se expressar com liberdade, preservando sua privacidade.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Orientação Profissional</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>No <strong>Plano Plus</strong>, quando você solicitar uma Orientação Profissional, serão consideradas <strong>somente as informações que você decidir fornecer especificamente naquela solicitação</strong>.</p>
            <p>O profissional não recebe acesso ao seu Diário, aos seus Check-ins ou aos demais registros privados da sua conta.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Informações da conta</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Para manter o serviço funcionando, podemos utilizar informações básicas necessárias para cadastro, acesso à conta, assinatura, comunicação, segurança e cumprimento de obrigações legais.</p>
            <p>Não vendemos seus dados pessoais e não transformamos seus registros privados em conteúdo público.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Segurança</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Adotamos medidas de segurança destinadas à proteção das informações mantidas pela plataforma e ao controle de acessos.</p>
            <p>Podemos utilizar serviços tecnológicos necessários para o funcionamento do A Vida Não Colabora, sempre observando as medidas aplicáveis de proteção e privacidade.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Seus direitos</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Você pode solicitar informações sobre seus dados pessoais, correção ou exclusão quando aplicável, além de exercer os demais direitos previstos na Lei Geral de Proteção de Dados Pessoais (LGPD).</p>
            <p>Solicitações ou dúvidas sobre privacidade podem ser encaminhadas pelos canais oficiais do A Vida Não Colabora.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">Alterações</h2>
          <p className="text-sm text-ink-soft leading-relaxed">Esta Política poderá ser atualizada para acompanhar mudanças na plataforma ou na legislação. Alterações relevantes poderão ser comunicadas aos usuários.</p>
        </section>

        {onNavigate && (
          <div className="flex flex-wrap gap-4 pt-2">
            <button onClick={() => onNavigate('contact')} className="text-sm font-medium text-forest-700 underline underline-offset-2 hover:text-forest-900">Ir para Contato</button>
            <button onClick={() => onNavigate('home')} className="text-sm text-ink-soft hover:text-forest-800 transition-colors">← Voltar para o início</button>
          </div>
        )}
      </div>
    </div>
  )
}
