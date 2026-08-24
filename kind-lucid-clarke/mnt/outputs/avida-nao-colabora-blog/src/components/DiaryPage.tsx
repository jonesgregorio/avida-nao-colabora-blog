/**
 * Entrada canônica da rota do Diário.
 *
 * A experiência v2 fica isolada em DiaryExperience para manter esta importação
 * estável no App e facilitar testes/regressões sem duplicar regras de navegação.
 */
import type { ComponentProps } from 'react'
import DiaryExperience from './DiaryExperience'
import './diarySingleWritingField.css'

type DiaryPageProps = ComponentProps<typeof DiaryExperience>

export default function DiaryPage(props: DiaryPageProps) {
  return (
    <div className="diary-single-writing-field">
      <DiaryExperience {...props} />
    </div>
  )
}
