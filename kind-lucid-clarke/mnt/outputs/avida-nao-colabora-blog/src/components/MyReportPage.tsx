import type { ComponentProps, MouseEvent } from 'react'
import MyReportPageContent from './MyReportPageContent'

type Props = ComponentProps<typeof MyReportPageContent>

const HISTORY_HEADING = 'Histórico de relatórios'

function findReportHistorySection(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  const heading = Array.from(root.querySelectorAll('h2')).find(
    node => node.textContent?.trim() === HISTORY_HEADING,
  )
  return (heading?.closest('section') as HTMLElement | null) ?? null
}

/**
 * Adaptador de navegação da página de Relatórios.
 *
 * O conteúdo mantém a regra de filtro existente (Semanal/Mensal). Aqui cuidamos
 * apenas da navegação visual: ao clicar em "Ver todos", levamos a pessoa até a
 * lista que acabou de ser filtrada. Sem isso, o filtro mudava fora da viewport e
 * dava a impressão de que o botão não fazia nada.
 */
export default function MyReportPage(props: Props) {
  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const button = target.closest('button')
    if (!button || button.textContent?.trim().startsWith('Ver todos') !== true) return

    window.requestAnimationFrame(() => {
      const root = event.currentTarget
      const history = findReportHistorySection(root)
      if (!history) return
      history.id = 'report-history'
      history.style.scrollMarginTop = '6rem'
      history.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div onClickCapture={handleClickCapture}>
      <MyReportPageContent {...props} />
    </div>
  )
}
