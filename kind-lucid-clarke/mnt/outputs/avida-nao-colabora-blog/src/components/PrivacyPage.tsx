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
      {/* Hero */}
      <div className="bg-white border-b border-line">
        <div className="max-w-3xl mx-auto px-4 py-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-forest-600 mb-3">Legal</span>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 mb-2">Política de Privacidade</h1>
          <p className="text-ink-soft text-sm">Última atualização: Agosto de 2026</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div className="bg-white border border-line rounded-2xl p-6">
          <p className="text-ink-soft text-sm leading-relaxed">
            Sua privacidade é fundamental para nós. Esta política explica de forma clara como tratamos seus dados — especialmente informações ligadas à sua jornada emocional, que exigem cuidado reforçado.
          </p>
        </div>

        {[
          {
            title: '1. Quais dados coletamos',
            items: [
              'Dados de conta: nome, e-mail, preferências e informações de perfil. A autenticação e a senha são gerenciadas pelo Supabase Auth; o aplicativo não recebe sua senha em texto legível para armazenamento.',
              'Dados do diário e check-ins: textos, notas, humor, energia, sono, dor, marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos que você registrar.',
              'Dados de questionários, relatórios, mapas emocionais, planos de autocuidado e orientações vinculados à sua conta.',
              'Dados de uso e comunicação: páginas e funcionalidades utilizadas, notificações, preferências de e-mail, tickets de suporte e histórico relacionado ao funcionamento do serviço.',
              'Dados de assinatura e cobrança necessários para identificar o plano e acompanhar pagamentos; os dados do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.',
            ],
          },
          {
            title: '2. Por que tratamos esses dados',
            items: [
              'Para autenticar sua conta, manter o serviço seguro e disponibilizar as funcionalidades contratadas.',
              'Para oferecer diário, check-ins, mapa emocional, relatórios, planos e demais recursos do produto.',
              'Para personalizar conteúdos e recomendações conforme seus registros, preferências e plano.',
              'Para responder solicitações de suporte, administrar preferências de comunicação e melhorar a operação do serviço.',
              'Para processar e acompanhar assinaturas e pagamentos de forma segura.',
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
          <h2 className="font-serif text-xl text-forest-900 mb-4">3. Como os dados são usados</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>Usamos seus dados para operar, proteger e melhorar o serviço e para entregar as funcionalidades que você utiliza. Não vendemos ou alugamos seus dados pessoais a anunciantes.</p>
            <p>Recursos de inteligência artificial podem processar o conteúdo ou resumos necessários para gerar artigos, relatórios, planos, recomendações e outros recursos. Enviamos ao provedor somente o contexto necessário para aquela geração e mantemos mecanismos de validação e fallback no backend.</p>
            <p>O comentário individual de um profissional sobre o relatório mensal foi descontinuado como recurso ativo do produto; comentários enviados no passado continuam preservados para consulta e exportação, sem que a equipe tenha acesso livre ou rotineiro ao seu diário completo.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">4. Armazenamento, segurança e retenção</h2>
          <div className="space-y-3 text-sm text-ink-soft leading-relaxed">
            <p>O aplicativo utiliza Supabase para autenticação, banco de dados e armazenamento e Vercel para hospedagem da aplicação web. As conexões de produção utilizam HTTPS. Pagamentos são processados pelo Stripe, e o aplicativo não armazena os dados completos do seu cartão.</p>
            <p>Enquanto sua conta estiver ativa, conservamos os dados necessários para prestar o serviço e manter os históricos que você utiliza. Ao concluir a exclusão por autoatendimento, removemos a conta e os dados pessoais vinculados ao aplicativo. Prestadores externos podem conservar registros próprios quando isso for necessário para segurança, prevenção a fraude, auditoria ou cumprimento de obrigação legal, conforme as políticas e prazos aplicáveis a cada prestador.</p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">5. Prestadores e compartilhamento necessário</h2>
          <p className="text-sm text-ink-soft mb-4">Para operar o serviço, podemos utilizar os seguintes prestadores conforme a funcionalidade:</p>
          <ul className="space-y-2.5 mb-4">
            {[
              'Supabase: autenticação, banco de dados, armazenamento e funções de backend.',
              'Vercel: hospedagem e entrega da aplicação web.',
              'Stripe: processamento e gestão de assinaturas e pagamentos.',
              'Resend e infraestrutura de e-mail configurada: envio de comunicações transacionais e outras mensagens permitidas pelas suas preferências.',
              'Provedores de inteligência artificial configurados no backend, como Google Gemini, Groq e, quando habilitado, OpenAI: processamento do contexto necessário para funcionalidades de IA.',
              'Autoridades ou terceiros legitimados: quando houver obrigação legal ou ordem válida aplicável.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-ink-soft leading-relaxed">
            Quando um recurso do Plus prevê participação profissional, o compartilhamento fica limitado ao relatório ou contexto necessário para aquela devolutiva e ao fluxo apresentado na própria plataforma.
          </p>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">6. Seus direitos e controles de privacidade</h2>
          <p className="text-sm text-ink-soft mb-4">Nos termos da legislação aplicável, você pode exercer direitos relacionados aos seus dados, incluindo:</p>
          <ul className="space-y-2.5">
            {[
              'Acessar os dados vinculados à sua conta e obter uma cópia em formato legível.',
              'Corrigir informações incompletas, inexatas ou desatualizadas.',
              'Solicitar eliminação, anonimização ou outras medidas quando aplicáveis.',
              'Revogar consentimentos e ajustar preferências de comunicação quando o tratamento depender dessa escolha.',
              'Solicitar informações sobre o tratamento e a portabilidade nos casos previstos em lei.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-ink-soft">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-400 flex-shrink-0 mt-1.5" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 bg-mint/50 rounded-xl p-4 text-sm text-forest-800 leading-relaxed">
            Usuários autenticados podem usar <strong>Meu perfil → Privacidade e seus dados</strong> para baixar uma cópia dos dados da conta ou iniciar a exclusão definitiva. A exclusão exige confirmação adicional com a senha atual.
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-4">7. Dados emocionais — confidencialidade</h2>
          <div className="bg-mint rounded-xl p-5">
            <p className="text-sm text-forest-900 font-medium mb-2">Tratamos dados do diário e informações emocionais com cuidado reforçado.</p>
            <p className="text-sm text-forest-800 leading-relaxed">
              O diário não é uma área pública nem uma caixa de leitura livre para a equipe. Seus registros são protegidos por controles de acesso e podem ser processados automaticamente para gerar recursos da própria conta. Quando uma funcionalidade contratada prevê revisão profissional, é fornecido o relatório ou contexto necessário para aquela finalidade, conforme descrito no recurso.
            </p>
          </div>
        </section>

        <section className="bg-white border border-line rounded-2xl p-6">
          <h2 className="font-serif text-xl text-forest-900 mb-3">8. Como falar sobre privacidade</h2>
          <p className="text-sm text-ink-soft leading-relaxed">
            Para dúvidas, solicitações adicionais ou exercício de direitos que não estejam disponíveis no autoatendimento, utilize a página de contato ou o formulário de suporte da plataforma. Assim sua solicitação fica registrada e pode ser acompanhada pela equipe.
          </p>
          {onNavigate && (
            <button onClick={() => onNavigate('contact')} className="mt-4 text-sm font-medium text-forest-700 underline underline-offset-2 hover:text-forest-900">
              Ir para Contato
            </button>
          )}
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
