import { BookCheck, CalendarClock, CircleAlert, FileSearch, ShieldCheck, UserRoundCheck } from 'lucide-react'

const PRINCIPLES = [
  { title: 'Propósito educativo', text: 'Os textos informam, acolhem e propõem reflexões práticas. Não realizam diagnóstico, prescrição, psicoterapia ou atendimento de emergência.', Icon: BookCheck },
  { title: 'Autoria identificada', text: 'Cada artigo informa sua autoria editorial. Quando o tema exigir conhecimento específico, a revisão profissional deve ser identificada antes da publicação.', Icon: UserRoundCheck },
  { title: 'Fontes adequadas', text: 'Afirmações sobre saúde devem se apoiar em fontes primárias, instituições públicas, diretrizes profissionais ou literatura científica pertinente.', Icon: FileSearch },
  { title: 'Atualização responsável', text: 'Conteúdos podem ser corrigidos, ampliados ou retirados quando estiverem desatualizados, imprecisos ou fora dos critérios editoriais.', Icon: CalendarClock },
]

export default function EditorialPolicyPage({ onNavigate }: { onNavigate: (section: string) => void }) {
  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-forest-600">Transparência</p>
          <h1 className="mt-3 font-serif text-4xl text-forest-900 sm:text-5xl">Política editorial</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">Cuidado, clareza e utilidade orientam o que publicamos sobre bem-estar emocional.</p>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:py-14">
        <nav aria-label="Trilha de navegação" className="text-sm text-ink-soft"><a href="/" onClick={(event) => { event.preventDefault(); onNavigate('home') }} className="hover:text-forest-800">Início</a><span aria-hidden="true"> / </span><span className="text-forest-800">Política editorial</span></nav>
        <section className="grid gap-4 sm:grid-cols-2">
          {PRINCIPLES.map(({ title, text, Icon }) => <article key={title} className="rounded-3xl border border-line bg-white p-6"><Icon className="h-6 w-6 text-forest-600" /><h2 className="mt-4 font-serif text-xl text-forest-900">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p></article>)}
        </section>
        <section className="rounded-3xl border border-line bg-white p-7">
          <h2 className="font-serif text-2xl text-forest-900">Uso responsável de inteligência artificial</h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">Ferramentas de inteligência artificial podem apoiar pesquisa, estruturação e revisão. A publicação depende de validações editoriais, de segurança, qualidade e SEO. Nenhuma ferramenta deve inventar credenciais, fontes, relatos ou garantias de resultado.</p>
        </section>
        <section className="rounded-3xl bg-mint/60 p-7">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-1 h-6 w-6 flex-shrink-0 text-forest-700" /><div><h2 className="font-serif text-2xl text-forest-900">Limites dos conteúdos</h2><p className="mt-3 text-sm leading-6 text-forest-800">O AVNC é uma plataforma de bem-estar e autoconhecimento. Em situação de risco imediato ou crise, procure um serviço de emergência. O CVV oferece apoio emocional gratuito pelo número 188.</p></div></div>
        </section>
        <section className="rounded-3xl border border-line bg-white p-7">
          <div className="flex items-start gap-3"><CircleAlert className="mt-1 h-6 w-6 flex-shrink-0 text-forest-600" /><div><h2 className="font-serif text-2xl text-forest-900">Encontrou algo que precisa ser revisto?</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Envie a URL e explique o ponto pela página de contato. A equipe avaliará a informação e atualizará o conteúdo quando necessário.</p><button onClick={() => onNavigate('contact')} className="mt-4 rounded-full bg-forest-900 px-5 py-2.5 text-sm font-semibold text-white">Falar com a equipe</button></div></div>
        </section>
      </div>
    </main>
  )
}
