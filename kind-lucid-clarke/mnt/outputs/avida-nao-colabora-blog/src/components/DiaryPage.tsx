/**
 * Entrada canônica da rota do Diário.
 *
 * A Fase 22.2 preserva a lógica do DiaryExperience e reorganiza a leitura
 * visual aqui: primeiro o espaço de escrita, depois contexto e ferramentas.
 */
import type { ComponentProps } from 'react'
import DiaryExperience from './DiaryExperience'
import AdaptiveCheckinIntro from './AdaptiveCheckinIntro'
import './diarySingleWritingField.css'

type DiaryPageProps = ComponentProps<typeof DiaryExperience>

export default function DiaryPage(props: DiaryPageProps) {
  return (
    <div className="diary-single-writing-field diary-phase22">
      <div className="diary-phase22-heading mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-9">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-forest-600">Seu espaço de escrita</p>
        <h1 className="mt-1 font-serif text-3xl text-forest-900 sm:text-4xl">Diário</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">Escreva primeiro. Sentimentos, contexto e outros detalhes ficam disponíveis quando ajudarem — não antes.</p>
      </div>
      <div className="diary-phase22-continuity">
        <AdaptiveCheckinIntro user={props.user} />
      </div>
      <div className="diary-phase22-experience">
        <DiaryExperience {...props} />
      </div>
    </div>
  )
}
