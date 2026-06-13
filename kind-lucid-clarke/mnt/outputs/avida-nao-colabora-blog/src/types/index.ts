export type Plan = 'free' | 'essential' | 'therapeutic'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  avatar_url: string | null
  plan: Plan
  created_at: string
  updated_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  cover_image: string
  author: string
  category: string
  created_at: string
}

export interface Comment {
  id: string
  article_id: string
  user_id: string | null
  author_name: string
  content: string
  created_at: string
}

export interface DiaryEntry {
  id: string
  user_id: string
  date: string
  mood: string
  mood_score: number
  text: string
  sleep_quality?: number
  pain_intensity?: number
  food_compulsion?: number
  emotional_triggers?: string
  markers?: string[]
  entry_type: 'diary' | 'questionnaire' | 'evaluation'
  questionnaire_score?: number
  questionnaire_category?: string
  notes?: string
  created_at: string
}

export interface QuestionnaireResponse {
  id: string
  user_id: string | null
  answers: Record<string, number>
  score: number
  category: string
  created_at: string
}

export interface GuidedMeditation {
  id: string
  title: string
  subtitle: string
  day_of_week: number
  duration_minutes: number
  content: string
  theme: string
  created_at: string
}

export interface MiniChallenge {
  id: string
  title: string
  slug: string
  description: string
  duration_days: number
  days: ChallengeDayContent[]
  created_at: string
}

export interface ChallengeDayContent {
  day: number
  title: string
  description: string
  activity: string
  tip: string
}

export interface GuidedPrompt {
  id: string
  text: string
  theme: string
  day_of_week: number | null
  plan_level: Plan
  created_at: string
}

export interface WeeklyEvaluation {
  id: string
  user_id: string
  week_start: string
  avg_mood: number
  avg_sleep: number
  avg_pain: number
  highlight: string
  recommendations: string[]
  created_at: string
}
