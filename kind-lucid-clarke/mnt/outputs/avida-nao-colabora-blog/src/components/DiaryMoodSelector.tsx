import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { MoodChip } from './user/ui'
import { MOODS } from './user/moods'

interface DiaryMoodSelectorProps {
  selectedKey: string | null
  otherLabel: string
  onSelect: (key: string) => void
  onOtherLabelChange: (value: string) => void
  optional?: boolean
}

const FEATURED_MOOD_KEYS = new Set([
  'bem_estar',
  'tranquilidade',
  'cansaco',
  'ansiedade',
  'tristeza',
  'irritacao',
])

export default function DiaryMoodSelector({ selectedKey, otherLabel, onSelect, onOtherLabelChange, optional = false }: DiaryMoodSelectorProps) {
  const [showAll, setShowAll] = useState(false)
  const selectedIsExtra = Boolean(selectedKey && !FEATURED_MOOD_KEYS.has(selectedKey))
  const expanded = showAll || selectedIsExtra

  const moods = useMemo(
    () => expanded ? MOODS : MOODS.filter(mood => FEATURED_MOOD_KEYS.has(mood.key)),
    [expanded],
  )

  return (
    <div className="mb-5">
      <p className="text-sm font-semibold text-forest-900 mb-3">
        Como você está agora? {optional && <span className="font-normal text-ink-soft">(opcional)</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {moods.map(mood => (
          <MoodChip
            key={mood.key}
            mood={mood}
            active={selectedKey === mood.key}
            onClick={() => onSelect(mood.key)}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowAll(value => !value)}
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm text-forest-800 hover:border-forest-300"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Menos' : 'Mais'}
        </button>
      </div>

      {selectedKey === 'outro' && (
        <input
          value={otherLabel}
          onChange={event => onOtherLabelChange(event.target.value)}
          maxLength={80}
          placeholder="Como você chamaria o que está sentindo? (opcional)"
          aria-label="Como você chamaria o que está sentindo"
          className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm"
        />
      )}
    </div>
  )
}
