import { ExternalLink, Database, KeyRound, Globe, Rocket, ShieldCheck, Clock, CreditCard } from 'lucide-react'

// Referência das configurações que ficam FORA do painel — por design, por
// segurança ou porque exigem código + PR. Cada item diz o que é, onde mudar
// e (quando sabido) o valor esperado hoje.

const PROJECT = 'lejvvhzluggyxlfwfoxl'
const SB = (path: string) => `https://supabase.com/dashboard/project/${PROJECT}/${path}`

interface Item {
  Icon: typeof Database
  title: string
  what: string
  where: { label: string; href: string }[]
  expected?: string
  note?: string
}

const ITEMS: Item[] = [
  {
    Icon: ShieldCheck,
    title: 'Autenticação (Supabase Auth)',
    what: 'Confirmação de e-mail no cadastro, URLs de redirect, templates dos e-mails de login/recuperação, SMTP de saída e limites de tentativa.',
    where: [
      { label: 'Auth → URL Configuration', href: SB('auth/url-configuration') },
      { label: 'Auth → Email Templates', href: SB('auth/templates') },
      { label: 'Auth → Providers / Rate limits', href: SB('auth/providers') },
    ],
    expected: 'Confirmação de e-mail DESLIGADA (login imediato) · Site URL = https://avidanaocolabora.com · redirect inclui o domínio www e os previews da Vercel.',
  },
  {
    Icon: KeyRound,
    title: 'Chaves de API (secrets)',
    what: 'GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY, YOUTUBE_API_KEY, PEXELS_API_KEY, RESEND_API_KEY, chaves e prices do Stripe, TURNSTILE_SECRET_KEY. Nunca ficam no código nem no frontend.',
    where: [{ label: 'Edge Functions → Secrets', href: SB('functions/secrets') }],
    note: 'O modelo de IA (não é secret) você troca em Central de IA. As chaves em si, só aqui.',
  },
  {
    Icon: Database,
    title: 'Banco: schema, RLS e migrations',
    what: 'Criar/alterar tabela, política de acesso (RLS), função ou índice.',
    where: [{ label: 'Repositório → supabase/migrations (via Pull Request)', href: 'https://github.com/jonesgregorio/avida-nao-colabora-blog/tree/main/kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations' }],
    expected: 'Só por código + PR. O workflow apply-migrations aplica na produção ao mergear. O painel "Saúde do Sistema" é diagnóstico — nunca executa DDL pelo navegador.',
  },
  {
    Icon: Clock,
    title: 'Tarefas agendadas (pg_cron)',
    what: 'Frequência e ativação dos 8 jobs (automações de conteúdo e emocionais, notificações de relatório, limpeza, e-mails de ciclo de vida).',
    where: [{ label: 'Definidas em migrations', href: 'https://github.com/jonesgregorio/avida-nao-colabora-blog/tree/main/kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations' }],
    expected: 'Status e última execução ao vivo em Sistema → Automações. As regras de geração de artigo (ativar/pausar) ficam em Conteúdo & IA → Automações.',
  },
  {
    Icon: Globe,
    title: 'Domínio e DNS',
    what: 'Registro do domínio, renovação e apontamento (A/CNAME) para a Vercel.',
    where: [
      { label: 'Registrador do domínio (fora deste projeto)', href: 'https://registro.br' },
      { label: 'Vercel → Domains', href: 'https://vercel.com/jonesgregorios-projects/avida-nao-colabora-blog/settings/domains' },
    ],
    expected: 'Domínio oficial: avidanaocolabora.com e www.avidanaocolabora.com. (O .com.br chegou a expirar no registro.br — é lá que se renova.)',
  },
  {
    Icon: Rocket,
    title: 'Hospedagem (Vercel)',
    what: 'Deploy, rollback, variáveis públicas VITE_* e logs de runtime do frontend.',
    where: [{ label: 'Vercel → o projeto', href: 'https://vercel.com/jonesgregorios-projects/avida-nao-colabora-blog' }],
    expected: 'Deploy automático a cada push na main. Rollback pelo dashboard (Deployments → … → Promote). VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nas env vars do projeto.',
  },
  {
    Icon: CreditCard,
    title: 'Stripe — reembolsos, disputas e webhooks de teste',
    what: 'Reembolso de cobrança, resposta a disputa (chargeback) e limpeza de endpoints de webhook antigos.',
    where: [
      { label: 'Reembolso: Admin → Financeiro (painel próprio)', href: '#' },
      { label: 'Disputas: Dashboard do Stripe', href: 'https://dashboard.stripe.com/disputes' },
      { label: 'Webhooks de teste: Stripe (modo teste) → Webhooks', href: 'https://dashboard.stripe.com/test/webhooks' },
    ],
    expected: 'O webhook de PRODUÇÃO está ativo e com 0% de erro. Endpoints em modo de teste podem ser apagados sem afetar cobrança real.',
  },
]

export default function AdminInfraReference() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="font-serif text-2xl text-forest-900">Infra &amp; configurações externas</h2>
      <p className="mt-1 text-sm text-ink-soft">
        O que não dá para mudar por aqui — porque é infraestrutura, tem peso legal, ou por segurança exige código + revisão.
        Cada item aponta o lugar certo.
      </p>

      <div className="mt-6 space-y-3">
        {ITEMS.map(item => (
          <div key={item.title} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-xl bg-mint text-forest-700">
                <item.Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-forest-900">{item.title}</h3>
                <p className="mt-0.5 text-sm text-ink-soft">{item.what}</p>
                {item.expected && (
                  <p className="mt-2 rounded-lg bg-paper/60 px-3 py-2 text-xs text-ink">
                    <span className="font-semibold text-forest-800">Hoje: </span>{item.expected}
                  </p>
                )}
                <ul className="mt-2 space-y-1">
                  {item.where.map(w => (
                    <li key={w.label} className="text-xs">
                      {w.href === '#' ? (
                        <span className="text-forest-700">{w.label}</span>
                      ) : (
                        <a href={w.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-forest-700 underline underline-offset-2 hover:text-forest-900">
                          {w.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                {item.note && <p className="mt-1.5 text-[11px] text-stone-400">{item.note}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
