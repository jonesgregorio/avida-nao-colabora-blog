import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { GardenChoiceOption } from '../../lib/gardenChoice'
import { gardenThemeBySlug } from '../../lib/gardenThemes'

// Escolha (modo "Livre escolha") ou troca (modo "Híbrido") do jardim do ciclo atual.

interface Props {
  options: GardenChoiceOption[]
  currentSlug: string | null
  /** true = ainda não há jardim neste ciclo (Livre escolha); false = troca de um jardim já em andamento. */
  firstChoice: boolean
  /** Devolve uma mensagem de erro, ou null quando deu certo. */
  onChoose: (slug: string) => Promise<string | null>
  onCancel?: () => void
}

export default function GardenChooser({ options, currentSlug, firstChoice, onChoose, onCancel }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function pick(slug: string) {
    setBusy(slug)
    setError('')
    const failure = await onChoose(slug)
    if (failure) {
      setError(failure)
      setBusy(null)
    }
  }

  return (
    <section className="mx-auto max-w-[1240px] px-5 py-8 sm:px-8 lg:px-10" aria-label="Escolha do jardim">
      <div className="rounded-[28px] border border-[#e0d8ca] bg-[#fffaf3] p-6 shadow-[0_14px_40px_rgba(47,61,43,.07)] sm:p-8">
        <h2 className="font-serif text-2xl text-[#173e2d] sm:text-3xl">{firstChoice ? 'Escolha o jardim que você quer cultivar' : 'Trocar de jardim'}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5f655f]">
          {firstChoice
            ? 'Este é o jardim do seu novo ciclo. Escolha o que mais combina com você; o que você já cuidou continua com você.'
            : 'Você pode mudar a aparência do seu jardim neste ciclo. O que você já cultivou continua valendo: só o cenário muda.'}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((o) => {
            const theme = gardenThemeBySlug(o.slug)
            const cover = o.cover_image || (theme ? theme.stages[theme.stages.length - 1] : null)
            const current = o.slug === currentSlug
            return (
              <article key={o.slug} className={`overflow-hidden rounded-[22px] border bg-white ${current ? 'border-forest-500 ring-2 ring-forest-200' : 'border-[#e3ddcf]'}`}>
                <div className="aspect-[16/9] bg-stone-100">{cover && <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />}</div>
                <div className="p-4">
                  <h3 className="font-serif text-lg text-forest-900">{o.label}</h3>
                  {o.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-soft">{o.description}</p>}
                  <button
                    type="button"
                    disabled={busy !== null || current}
                    onClick={() => void pick(o.slug)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-forest-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-800 disabled:opacity-60"
                  >
                    {busy === o.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : current ? <Check className="h-4 w-4" /> : null}
                    {current ? 'Seu jardim atual' : firstChoice ? 'Escolher este jardim' : 'Trocar para este'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
        {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">{error}</p>}
        {onCancel && <button type="button" onClick={onCancel} className="mt-5 text-xs font-medium text-forest-700 underline underline-offset-4">Manter o jardim atual</button>}
      </div>
    </section>
  )
}
