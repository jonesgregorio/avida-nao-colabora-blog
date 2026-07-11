import { Sprout, Waves, BatteryLow, BatteryWarning, CloudRain, Sun, Frown, Flame, Meh, CloudFog, MoreHorizontal } from 'lucide-react'

export interface MoodOption {
  key: string
  label: string
  Icon: typeof Sun
  cls: string // cores do chip quando inativo
}

// Taxonomia oficial de estados emocionais do check-in — reutilizada no Dashboard,
// no Diário, no Mapa Emocional, relatórios, filtros e URLs.
// SEMPRE substantivos neutros (sem marcação de gênero). Slugs internos = key.
export const MOODS: MoodOption[] = [
  { key: 'bem_estar',     label: 'Bem-estar',     Icon: Sun,            cls: 'bg-amber-50 text-amber-600' },
  { key: 'tranquilidade', label: 'Tranquilidade', Icon: Sprout,         cls: 'bg-mint text-forest-700' },
  { key: 'cansaco',       label: 'Cansaço',       Icon: BatteryLow,     cls: 'bg-lilac text-[#6b5ca0]' },
  { key: 'sem_energia',   label: 'Sem energia',   Icon: BatteryWarning, cls: 'bg-lilac text-[#6b5ca0]' },
  { key: 'ansiedade',     label: 'Ansiedade',     Icon: Waves,          cls: 'bg-amber-50 text-amber-700' },
  { key: 'sobrecarga',    label: 'Sobrecarga',    Icon: CloudRain,      cls: 'bg-coral/40 text-[#8a3b23]' },
  { key: 'tristeza',      label: 'Tristeza',      Icon: Frown,          cls: 'bg-sky text-[#3d6ea5]' },
  { key: 'irritacao',     label: 'Irritação',     Icon: Flame,          cls: 'bg-coral/40 text-[#8a3b23]' },
  { key: 'desanimo',      label: 'Desânimo',      Icon: Meh,            cls: 'bg-sky text-[#3d6ea5]' },
  { key: 'confusao',      label: 'Confusão',      Icon: CloudFog,       cls: 'bg-lilac text-[#6b5ca0]' },
  { key: 'outro',         label: 'Outro',         Icon: MoreHorizontal, cls: 'bg-paper-soft text-ink-soft' },
]
