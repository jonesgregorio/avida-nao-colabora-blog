// Planos atuais: free | essential | plus. 'therapeutic'/'therapeutic-plus' são
// LEGADOS (mantidos por compatibilidade de dados) e tratados como 'plus'.
export type Plan = 'free' | 'essential' | 'plus' | 'therapeutic' | 'therapeutic-plus'

export type View = 'home' | 'auth' | 'article' | 'diary' | 'profile' | 'meditations' | 'challenges' | 'content' | 'therapeutic-q' | 'about' | 'privacy' | 'terms' | 'questionnaire' | 'questionarios' | 'questionarios-evolucao' | 'pricing' | 'articles' | 'responsibility' | 'trails' | 'saved' | 'admin' | 'contact' | 'success' | 'support' | 'support-ticket' | 'notifications' | 'monthly-guidance' | 'professional-comments' | 'my-plan' | 'my-report' | 'my-evolution' | 'my-history' | 'my-garden' | 'self-care' | 'descobertas' | 'cuidar' | 'mais' | 'conquistas' | 'lembretes' | 'faq'

export interface Profile {
  id: string
  user_id: string
  full_name: string | null
  display_name?: string
  preferred_name?: string
  avatar_url: string | null
  status_phrase?: string
  plan: Plan
  unlimited_access?: boolean | null
  unlimited_access_until?: string | null
  unlimited_access_reason?: string | null
  stripe_customer_id?: string | null
  role?: string | null
  communication_preference?: string
  notification_frequency?: string
  must_change_password?: boolean
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
  cover_image_url?: string
  image_url?: string
  image_alt?: string
  read_time?: number
  reading_time_minutes?: number
  published?: boolean
  status?: string
  plan_required?: string
  author?: string
  category: string
  related_slugs?: string[]
  tags?: string[]
  emotional_themes?: string[]
  keywords?: string[]
  seo_title?: string
  seo_description?: string
  og_image?: string
  diary_question?: string
  cta_text?: string
  cta_link?: string
  cta_mode?: string
  cta_custom_title?: string
  cta_custom_text?: string
  published_at?: string
  scheduled_at?: string
  updated_at?: string
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
  user_id?: string
  author_name: string
  author_email?: string
  content: string
  approved: boolean
  created_at: string
}
