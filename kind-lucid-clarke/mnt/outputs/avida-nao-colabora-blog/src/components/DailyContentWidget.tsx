import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAnalytics } from '../hooks/useAnalytics'
import { Sparkles, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { normalizePlan } from '../lib/officialPlans'

interface Profile {
  plan: string
}

interface AutoContent {
  id: string
  title: string
  type: string
  frequency: string
  content: string
}

interface Props {
  user: User | null
  profile: Profile | null
}

const FREQ_LABEL: Record<string, string> = {
  Diário: 'Conteúdo de hoje',
  Semanal: 'Conteúdo da semana',
  Quinzenal: 'Conteúdo quinzenal',
  Mensal: 'Conteúdo do mês',
}

// §10.1 do audit: única fonte de verdade pra exibir o tipo de um conteúdo
// guiado. Aceita termos legados salvos em registros antigos (automated_contents
// gravou o `type` como texto livre por anos), mas NUNCA devolve o termo legado
// pra UI — sempre o rótulo canônico atual. Não normaliza os dados no banco
// (não é migration), só a leitura/exibição.
const LEGACY_TYPE_MAP: Record<string, { canonicalType: string; label: string; emoji: string }> = {
  'Meditação guiada em texto': { canonicalType: 'pausa_emocional', label: 'Pausa emocional guiada', emoji: '🧘' },
  'Meditação guiada': { canonicalType: 'pausa_emocional', label: 'Pausa emocional guiada', emoji: '🧘' },
  'Mini-desafio': { canonicalType: 'pequena_pratica_guiada', label: 'Pequena prática guiada', emoji: '🎯' },
  'Plano semanal de autocuidado': { canonicalType: 'sequencia_de_cuidado', label: 'Sequência de cuidado', emoji: '🌱' },
  'Técnica terapêutica': { canonicalType: 'recurso_de_apoio_emocional', label: 'Recurso de apoio emocional', emoji: '🔬' },
  'Relatório mensal': { canonicalType: 'reflexao_mensal_guiada', label: 'Reflexão mensal guiada', emoji: '📊' },
}
const CANONICAL_TYPE_STYLE: Record<string, { label: string; emoji: string }> = {
  'Sugestão de artigo': { label: 'Sugestão de artigo', emoji: '📖' },
  'Pausa emocional guiada': { label: 'Pausa emocional guiada', emoji: '🧘' },
  'Exercício emocional': { label: 'Exercício emocional', emoji: '💪' },
  'Pequena prática guiada': { label: 'Pequena prática guiada', emoji: '🎯' },
  'Avaliação semanal': { label: 'Avaliação semanal', emoji: '📊' },
  'Autocuidado prático': { label: 'Autocuidado prático', emoji: '🌱' },
  'Sequência de cuidado': { label: 'Sequência de cuidado', emoji: '🌱' },
  'Lembrete de diário': { label: 'Lembrete de diário', emoji: '📔' },
  'Reflexão guiada': { label: 'Reflexão guiada', emoji: '💭' },
  'Conteúdo educativo': { label: 'Conteúdo educativo', emoji: '🔬' },
  'Recurso de apoio emocional': { label: 'Recurso de apoio emocional', emoji: '🔬' },
  'Reflexão mensal guiada': { label: 'Reflexão mensal guiada', emoji: '📊' },
  'Exercício de escrita': { label: 'Exercício de escrita', emoji: '✍️' },
  'Organização emocional': { label: 'Organização emocional', emoji: '🗂️' },
  'Limites e rotina': { label: 'Limites e rotina', emoji: '🧭' },
}
function normalizeGuidedContentType(type: string): { label: string; emoji: string; canonicalType: string } {
  const legacy = LEGACY_TYPE_MAP[type]
  if (legacy) return legacy
  const known = CANONICAL_TYPE_STYLE[type]
  if (known) return { ...known, canonicalType: type }
  return { label: type, emoji: '✨', canonicalType: type }
}

// Escolhe conteúdo determinístico pelo dia (mesmo conteúdo o dia todo)
function pickTodayContent(items: AutoContent[]): AutoContent | null {
  if (items.length === 0) return null
  const dayIndex = Math.floor(Date.now() / 86400000) // dias desde epoch
  return items[dayIndex % items.length]
}

export default function DailyContentWidget({ user, profile }: Props) {
  const [content, setContent] = useState<AutoContent | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const { track } = useAnalytics(user?.id)

  useEffect(() => {
    if (!profile) { setLoading(false); return }
    loadContent()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  async function loadContent() {
    setLoading(true)
    // Planos elegíveis (do usuário para baixo). Valores legados do perfil são
    // normalizados antes desta consulta; o catálogo usa apenas os 3 planos atuais.
    const norm = normalizePlan(profile?.plan)
    const eligiblePlans = norm === 'plus'
      ? ['free', 'essential', 'plus']
      : norm === 'essential'
        ? ['free', 'essential']
        : ['free']

    const { data } = await supabase
      .from('automated_contents')
      .select('id, title, type, frequency, content')
      .eq('is_active', true)
      .in('plan_required', eligiblePlans)
      .order('created_at', { ascending: false })

    const picked = pickTodayContent(data || [])
    setContent(picked)
    setLoading(false)
    if (picked) track('daily_content_view', { entity_id: picked.id, entity_title: picked.title })
  }

  if (!user || loading || !content) return null

  const { label: typeLabel, emoji } = normalizeGuidedContentType(content.type)
  const label = FREQ_LABEL[content.frequency] || 'Para você'

  return (
    <div className="max-w-4xl mx-auto px-4 py-4">
      <div className="bg-gradient-to-br from-emerald-50 to-stone-50 border border-emerald-100 rounded-2xl overflow-hidden">
        {/* Header */}
        <button
          onClick={() => {
            if (!expanded && content) track('daily_content_expand', { entity_id: content.id, entity_title: content.title })
            setExpanded(e => !e)
          }}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-emerald-50/50 transition-colors"
        >
          <span className="text-2xl">{emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide flex items-center gap-1">
              <Sparkles size={10} /> {label}
            </p>
            <p className="text-sm font-semibold text-stone-800 truncate">{content.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-stone-400 hidden sm:block">{typeLabel}</span>
            {expanded
              ? <ChevronUp size={16} className="text-stone-400" />
              : <ChevronDown size={16} className="text-stone-400" />}
          </div>
        </button>

        {/* Corpo expandido */}
        {expanded && (
          <div className="px-5 pb-5">
            <div className="h-px bg-emerald-100 mb-4" />
            <div className="text-stone-700 text-sm leading-relaxed whitespace-pre-line">
              {content.content}
            </div>
            <button
              onClick={loadContent}
              className="mt-4 flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
            >
              <RefreshCw size={11} /> Ver outro conteúdo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
