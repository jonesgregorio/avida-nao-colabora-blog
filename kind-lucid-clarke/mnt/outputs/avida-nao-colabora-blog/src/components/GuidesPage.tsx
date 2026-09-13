import { ArrowRight, BookOpen, Compass, ShieldCheck } from 'lucide-react'
import { SEO_PILLAR_GUIDES } from '../lib/seoGuides'

interface GuidesPageProps {
  onNavigate: (section: string) => void
}

export default function GuidesPage({ onNavigate }: GuidesPageProps) {
  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-[#fffdf9]">
        <div className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-forest-600">Comece por aqui</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-forest-900 sm:text-5xl">Guias essenciais para cuidar da vida emocional</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">Escolha um tema e avance no seu ritmo. Estes guias organizam os conteúdos mais importantes do AVNC para transformar observação em cuidado possível.</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
        <nav aria-label="Trilha de navegação" className="mb-8 text-sm text-ink-soft">
          <a href="/" onClick={(event) => { event.preventDefault(); onNavigate('home') }} className="hover:text-forest-800">Início</a>
          <span aria-hidden="true"> / </span>
          <span className="text-forest-800">Guias</span>
        </nav>

        <section aria-labelledby="guide-list-title">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-forest-700"><Compass className="h-5 w-5" /></span>
            <div><h2 id="guide-list-title" className="font-serif text-2xl text-forest-900">Temas que estamos preparando</h2><p className="text-sm text-ink-soft">Os guias completos serão publicados abertamente no blog.</p></div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {SEO_PILLAR_GUIDES.map((guide) => (
              <article key={guide.slug} className="group flex flex-col rounded-3xl border border-line bg-white p-6 transition hover:border-forest-300 hover:shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-forest-600">{guide.cluster}</p>
                <h3 className="mt-2 font-serif text-2xl text-forest-900">{guide.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink-soft">{guide.description}</p>
                <p className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-forest-800">Em preparação <ArrowRight className="h-4 w-4" /></p>
              </article>
            ))}
          </div>
        </section>

        <aside className="mt-10 grid gap-5 rounded-3xl bg-forest-900 p-7 text-white sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <BookOpen className="h-7 w-7 text-mint" />
          <div><h2 className="font-serif text-2xl">Quer acompanhar as publicações?</h2><p className="mt-1 text-sm leading-6 text-white/75">Os conteúdos abertos aparecerão no blog assim que forem revisados e publicados.</p></div>
          <a href="/blog" onClick={(event) => { event.preventDefault(); onNavigate('articles') }} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-forest-900">Ver o blog <ArrowRight className="h-4 w-4" /></a>
        </aside>

        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-ink-soft">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-forest-600" />
          <p>Os conteúdos são educativos e apoiam autoconhecimento e organização emocional. Eles não substituem acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.</p>
        </div>
      </div>
    </main>
  )
}
