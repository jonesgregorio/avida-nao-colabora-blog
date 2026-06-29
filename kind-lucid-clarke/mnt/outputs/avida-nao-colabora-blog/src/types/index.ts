export type Plan = 'free' | 'essential' | 'therapeutic' | 'therapeutic-plus'

export type View = 'home' | 'auth' | 'article' | 'diary' | 'profile' | 'meditations' | 'challenges' | 'therapeutic-q' | 'about' | 'privacy' | 'terms' | 'questionnaire' | 'questionarios' | 'pricing' | 'articles' | 'responsibility' | 'trails' | 'saved' | 'admin' | 'contact'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  display_name?: string
  preferred_name?: string
  avatar_url: string | null
  status_phrase?: string
  plan: Plan
  role?: string | null
  communication_preference?: string
  notification_frequency?: string
  created_at: string
  updated_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  excerpt?: string
  summary?: string
  content: string
  cover_image?: string
  image_url?: string
  image_alt?: string
  read_time?: number
  published?: boolean
  author?: string
  category: string
  related_slugs?: string[]
  created_at: string
}

export interface UserProfile {
  id: string
  user_id: string
  display_name: string
  preferred_name?: string
  avatar_url?: string
  status_phrase?: string
  plan: Plan
  role?: string | null
  communication_preference?: string
  notification_frequency?: string
  created_at: string
  updated_at: string
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
  date?: string
  mood: string | number
  mood_emoji?: string
  mood_score?: number
  text?: string
  energy?: number
  anxiety_level?: number
  stress_level?: number
  self_esteem?: number
  irritability?: number
  overload?: number
  sleep_quality?: number
  emotional_triggers?: string
  recurring_thoughts?: string
  emotional_need?: string
  relationships?: string
  habits?: string
  emotional_tags?: string[]
  gratitude?: string
  small_pride?: string
  free_note?: string
  notes?: string
  guided_question_1?: string
  guided_question_2?: string
  guided_question_3?: string
  guided_question_4?: string
  markers?: string[]
  entry_type?: 'diary' | 'questionnaire' | 'evaluation'
  questionnaire_score?: number
  questionnaire_category?: string
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
  avg_stress: number
  highlight: string
  recommendations: string[]
  created_at: string
}

