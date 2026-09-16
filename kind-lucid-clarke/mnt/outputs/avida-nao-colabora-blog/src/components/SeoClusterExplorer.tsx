import { ArrowRight, BookOpen, Compass } from 'lucide-react'
import { SEO_PILLAR_GUIDES, guidePathFor } from '../lib/seoGuides'

export default function SeoClusterExplorer({ onOpenGuides }: { onOpenGuide: (slug: string) => void; onOpenGuides?: () => void }) {
  const openGuides = () => {
    if (onOpenGuides) onOpenGuides()
    else window.location.assign('/guias')
  }
  return (
    <section className="mb-10 overflow-hidden rounded-[2rem] border border-line bg-[#fffdf9]" aria-labelledby="seo-cluster-title">
      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[300px_1fr] lg:items-start">
        <div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mint text-forest-700"><Compass className="h-5 w-5" /></span>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[.16em] text-forest-600">Caminhos de leitura</p>
          <h2 id="seo-cluster-title" className="mt-2 font-serif text-3xl leading-tight text-forest-900">Comece pelo que você precisa entender hoje</h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">Cada caminho reúne uma página-pilar, leituras do mesmo tema e uma ferramenta do AVNC coerente com o próximo passo.</p>
          <button type="button" onClick={openGuides} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-sm font-semibold text-forest-800">Ver todos os guias <ArrowRight className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SEO_PILLAR_GUIDES.map(guide => (
            <a key={guide.slug} href={guidePathFor(guide)} className="group min-h-11 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-forest-300 hover:shadow-sm">
              <div className="flex items-start gap-3"><BookOpen className="mt-0.5 h-4 w-4 flex-shrink-0 text-forest-600" /><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-forest-600">{guide.cluster}</p><h3 className="mt-1 font-serif text-lg leading-snug text-forest-900">{guide.title}</h3><p className="mt-1.5 line-clamp-2 text-xs leading-5 text-ink-soft">{guide.description}</p></div></div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
