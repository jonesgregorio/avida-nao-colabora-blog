import { Compass, Sparkles } from 'lucide-react'
import type { JourneyChapter } from '../../lib/journeyChapter'

export default function JourneyChapterCard({ chapter }: { chapter: JourneyChapter }) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-forest-100 bg-gradient-to-br from-forest-50 via-mint/45 to-paper-soft p-5 sm:p-6"
      aria-labelledby="journey-chapter-title"
    >
      <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/60 blur-2xl" aria-hidden />
      <div className="relative flex items-start gap-4">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-forest-100 bg-white text-forest-700">
          <Compass className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest-600">{chapter.eyebrow}</p>
          <h2 id="journey-chapter-title" className="mt-1 font-serif text-2xl sm:text-[28px] text-forest-900">
            {chapter.title}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-soft">{chapter.description}</p>

          {chapter.evidence.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="O que sustenta este capítulo">
              {chapter.evidence.map(item => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/85 px-3 py-1.5 text-xs text-forest-800">
                  <Sparkles className="h-3.5 w-3.5 text-forest-500" aria-hidden />
                  {item}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-ink-soft">
            {chapter.note}
          </p>
        </div>
      </div>
    </section>
  )
}
