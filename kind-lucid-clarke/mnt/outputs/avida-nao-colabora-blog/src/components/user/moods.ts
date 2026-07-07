import { Sprout, Waves, BatteryLow, CloudRain, Sun, MoreHorizontal } from 'lucide-react'

export interface MoodOption {
  key: string
  label: string
  Icon: typeof Sun
  cls: string // cores do chip quando inativo
}

// Opções de humor do check-in — reutilizadas no Dashboard e no Diário.
export const MOODS: MoodOption[] = [
  { key: 'tranquila',      label: 'Tranquila',      Icon: Sprout,        cls: 'bg-mint text-forest-700' },
  { key: 'ansiosa',        label: 'Ansiosa',        Icon: Waves,         cls: 'bg-amber-50 text-amber-700' },
  { key: 'cansada',        label: 'Cansada',        Icon: BatteryLow,    cls: 'bg-lilac text-[#6b5ca0]' },
  { key: 'sobrecarregada', label: 'Sobrecarregada', Icon: CloudRain,     cls: 'bg-coral/40 text-[#8a3b23]' },
  { key: 'bem',            label: 'Me sentindo bem', Icon: Sun,          cls: 'bg-amber-50 text-amber-600' },
  { key: 'outro',          label: 'Outro',          Icon: MoreHorizontal, cls: 'bg-paper-soft text-ink-soft' },
]
