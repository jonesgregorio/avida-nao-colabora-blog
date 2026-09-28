import { MOODS } from './moods'

export const CHECKIN_SCORES = [
  { score: 1, emoji: '😣', label: 'Nem um pouco' },
  { score: 2, emoji: '😕', label: 'Fez o mínimo' },
  { score: 3, emoji: '😐', label: 'Sobrevivemos' },
  { score: 4, emoji: '🙂', label: 'Até que tentou' },
  { score: 5, emoji: '😄', label: 'Colaborou' },
] as const

const FEATURED_MOOD_KEYS = new Set([
  'alegria',
  'tranquilidade',
  'cansaco',
  'ansiedade',
  'sobrecarga',
  'tristeza',
  'irritacao',
])

export const FEATURED_CHECKIN_MOODS = MOODS.filter(mood => FEATURED_MOOD_KEYS.has(mood.key))
