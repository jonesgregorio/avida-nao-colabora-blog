import { getDiaryTagStyle, type TagCategory } from '../lib/tagCategories'

interface Props {
  label: string
  /** Categoria fixa (contexto/necessidade/cuidado). Ausente = deduz pela palavra (tags emocionais). */
  category?: TagCategory
  /** true = destacada (selecionada no formulário, ou tag já salva no histórico). */
  selected?: boolean
  onClick?: () => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

// Chip de tag reutilizável — cor vem SEMPRE da categoria (tagCategories.ts),
// nunca é escolhida manualmente por registro. Sem onClick vira <span> (leitura,
// ex.: histórico/Mapa); com onClick vira <button> (seleção múltipla no formulário).
export default function DiaryTagChip({ label, category, selected = true, onClick, disabled, size = 'md' }: Props) {
  const s = getDiaryTagStyle(label, category)
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs'
  const style = selected
    ? { backgroundColor: s.selectedBackground, color: s.selectedColor, borderColor: s.selectedBorder }
    : { backgroundColor: s.background, color: s.color, borderColor: s.border }
  const cls = `${padding} rounded-full border font-medium transition-colors inline-block leading-normal`

  if (!onClick) return <span className={cls} style={style}>{label}</span>
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${cls} hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed`}
      style={style}
    >
      {label}
    </button>
  )
}
