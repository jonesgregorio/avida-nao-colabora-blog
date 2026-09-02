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

const FEATURED_MOOD_KEYS = new Set(['bem_estar', 'tranquilidade', 'cansaco', 'ansiedade', 'tristeza', 'irritacao'])

export default function DiaryMoodSelector({ selectedKey, otherLabel, onSelect, onOtherLabelChange, optional = false }: DiaryMoodSelectorProps) {
  const [showAll, setShowAll] = useState(false)
  const [optionalOpen, setOptionalOpen] = useState(Boolean(selectedKey))
  const selectedIsExtra = Boolean(selectedKey && !FEATURED_MOOD_KEYS.has(selectedKey))
  const expanded = showAll || selectedIsExtra
  const moods = useMemo(() => expanded ? MOODS : MOODS.filter(mood => FEATURED_MOOD_KEYS.has(mood.key)), [expanded])

  if (optional && !optionalOpen && !selectedKey) {
    return <div className="mb-0">
      <button
        type="button"
        onClick={() => setOptionalOpen(true)}
        className="inline-flex items-center gap-1.5 py-2 text-sm text-forest-700 hover:text-forest-900 transition-colors"
        aria-expanded="false"
      >
        <ChevronDown className="h-4 w-4 flex-shrink-0" />
        <span>Quer acrescentar algo sobre este momento?</span>
        <span className="text-xs text-ink-soft">(opcional)</span>
      </button>
      <span className="sr-only">Opcional — só se isso ajudar a dar contexto ao que você escreveu.</span>
    </div>
  }

  return <div className="w-full basis-full rounded-2xl bg-paper-soft/70 px-4 py-4">
    {optional && <button type="button" onClick={() => setOptionalOpen(false)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-forest-800" aria-expanded="true"><ChevronUp className="h-4 w-4" /> Ocultar contexto emocional</button>}
    <p className="text-sm font-semibold text-forest-900 mb-1">Como você está se sentindo? {optional && <span className="font-normal text-ink-soft">(opcional)</span>}</p>
    <p className="text-xs text-ink-soft mb-3">Escolha apenas se isso ajudar a dar contexto ao que você escreveu.</p>
    <div className="flex flex-wrap gap-2">
      {moods.map(mood => <MoodChip key={mood.key} mood={mood} active={selectedKey === mood.key} onClick={() => onSelect(mood.key)} />)}
      <button type="button" onClick={() => setShowAll(value => !value)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm text-forest-800 hover:border-forest-300" aria-expanded={expanded}>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}{expanded ? 'Menos estados' : 'Outros sentimentos'}
      </button>
    </div>
    {selectedKey === 'outro' && <input value={otherLabel} onChange={event => onOtherLabelChange(event.target.value)} maxLength={80} placeholder="Como você chamaria o que está sentindo? (opcional)" aria-label="Como você chamaria o que está sentindo" className="mt-3 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm" />}
  </div>
}
