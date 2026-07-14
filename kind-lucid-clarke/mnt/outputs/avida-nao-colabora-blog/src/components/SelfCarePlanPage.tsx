import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { normalizePlan } from '../lib/officialPlans'
import { getContentTypeLabel } from '../lib/personalizedContentLabels'
import { Sprout, Loader2, Download, ArrowRight, Sparkles, ShieldCheck, ChevronDown, ChevronUp, BookOpen, HelpCircle, Heart } from 'lucide-react'
import PlanBadge from './PlanBadge'
import RecommendedContent from './RecommendedContent'
import { signalFromTags, fetchGuidedCatalog, type CatalogItem } from '../lib/contentRecommendation'
import { CARE_PLAN_DISCLAIMER, type CareSummary, type CarePlanContent } from '../lib/careePlanAI'
import { formatPeriodShort, formatDateBR, monthTitle } from '../lib/reportPeriods'

interface Props {
  user: User | null
  profile: Profile | null
  onNavigatePricing: () => void
  onNavigate?: (v: string) => void
  onOpenArticle?: (slug: string) => void
}

interface SentPlan {
  id: string
  month_reference: string
  period_start: string
  period_end: string
  sent_at: string | null
  ai_summary: string | null
  ai_summary_json: CareSummary | null
  care_plan: CarePlanContent | null
  recommended_content_ids: string[] | null
}
interface Review {
  id: string; month_key: string; summary: string | null
  suggested_adjustments: string | null; next_focus: string | null
  pdf_url: string | null; created_at: string
}
interface Extra {
  id: string; title: string; body: string; content_type: string | null; sent_at: string | null
}

function monthLabel(key: string) {
  const [y, m] = String(key).split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

// Área PRÓPRIA do Plano de Autocuidado — exclusiva do Plus. Transforma os dados
// de diário/questionários/mapa em ações mensais, com revisão humana no admin.
export default function SelfCarePlanPage({ user, profile, onNavigatePricing, onNavigate, onOpenArticle }: Props) {
  const plan = normalizePlan(profile?.plan)
  const isPlus = plan === 'plus'
  const [sentPlans, setSentPlans] = useState<SentPlan[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [catalog, setCatalog] = useState<Map<string, CatalogItem>>(new Map())
  const [loading, setLoading] = useState(isPlus)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!user || !isPlus) { setLoading(false); return }
    let active = true
    Promise.all([
      // RLS: só devolve os PRÓPRIOS planos já ENVIADOS (nunca draft, nunca de outro).
      supabase.from('monthly_care_plans').select('id, month_reference, period_start, period_end, sent_at, ai_summary, ai_summary_json, care_plan, recommended_content_ids')
        .eq('user_id', user.id).eq('status', 'sent').order('month_reference', { ascending: false }).limit(24),
      supabase.from('self_care_plan_reviews').select('*').eq('user_id', user.id).order('month_key', { ascending: false }).limit(12),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'self_care_plan')
        .order('sent_at', { ascending: false }).limit(10),
      fetchGuidedCatalog(),
    ]).then(([mp, r, d, cat]) => {
      if (!active) return
      setSentPlans((mp.data ?? []) as SentPlan[])
      setReviews((r.data ?? []) as Review[])
      setExtras((d.data ?? []) as Extra[])
      setCatalog(new Map((cat ?? []).map(c => [c.id, c])))
      setLoading(false)
    })
    return () => { active = false }
  }, [user, isPlus])

  const current = sentPlans[0] ?? null

  // Sinal para conteúdos ligados à prioridade do mês. Usa o plano novo; se não
  // houver, cai para a revisão legada.
  const focusText = current
    ? [current.care_plan?.monthly_priority, ...(current.ai_summary_json?.recurring_triggers ?? []), ...(current.ai_summary_json?.main_emotions ?? [])].filter(Boolean).join(' ')
    : reviews[0] ? [reviews[0].next_focus, reviews[0].summary].filter(Boolean).join(' ') : ''
  const focusSignal = focusText ? signalFromTags([focusText]) : null
  const careSignal = focusSignal && focusSignal.hasData ? focusSignal : undefined

  const historyItems = sentPlans.slice(1)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
            Plano de Autocuidado <Sprout className="w-6 h-6 text-forest-400" />
          </h1>
          <p className="mt-2 text-ink-soft">Suas prioridades e pequenos cuidados do mês, a partir dos seus registros.</p>
        </div>
        <PlanBadge plan={profile?.plan} member size="sm" className="mt-1" />
      </header>

      {!isPlus ? (
        <div className="bg-paper-soft border border-line rounded-3xl p-6 sm:p-8 text-center">
          <span className="w-14 h-14 rounded-full bg-mint flex items-center justify-center mx-auto text-forest-600 mb-4"><Sprout className="w-7 h-7" /></span>
          <h2 className="font-serif text-xl text-forest-900">Disponível no plano Plus</h2>
          <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto leading-relaxed">
            O Plano de Autocuidado mensal transforma o que você registra no diário, nos questionários e no
            Mapa Emocional em prioridades, pequenos cuidados e metas simples para o seu mês.
          </p>
          <button onClick={onNavigatePricing} className="mt-5 inline-flex items-center gap-2 bg-forest-900 hover:bg-forest-800 text-white text-sm font-medium px-5 py-2.5 rounded-2xl transition-colors">
            Conhecer o Plus <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-forest-400" /></div>
      ) : !current && reviews.length === 0 ? (
        // Nenhum plano enviado ainda (§14).
        <div className="bg-paper-soft border border-line rounded-3xl p-8 text-center space-y-3">
          <Sparkles className="w-9 h-9 text-forest-300 mx-auto" />
          <p className="text-ink-soft text-sm">Seu Plano de Autocuidado deste mês ainda está sendo preparado.</p>
          <p className="text-xs text-ink-soft/70">Continue registrando no diário e respondendo aos questionários — eles alimentam o seu plano. Ele fica disponível após a revisão da equipe.</p>
          {onNavigate && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button onClick={() => onNavigate('diary')} className="text-xs font-medium text-forest-700 border border-line rounded-full px-3 py-1.5 hover:bg-mint/40">Registrar no diário</button>
              <button onClick={() => onNavigate('questionarios')} className="text-xs font-medium text-forest-700 border border-line rounded-full px-3 py-1.5 hover:bg-mint/40">Responder questionário</button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {current && current.care_plan ? (
            <PlanCard plan={current} catalog={catalog} onOpenArticle={onOpenArticle} />
          ) : reviews[0] ? (
            <LegacyReviewCard r={reviews[0]} />
          ) : null}

          {/* Conteúdos guiados ligados à prioridade do mês (§8.6/§19). */}
          {onOpenArticle && (
            <RecommendedContent
              user={user ? { id: user.id } : null}
              profile={{ plan: profile?.plan }}
              signal={careSignal}
              source="care_plan"
              limit={3}
              title="Mais conteúdos para o seu momento"
              description="Selecionados a partir do foco do seu plano e dos seus registros."
              onOpen={onOpenArticle}
            />
          )}

          {extras.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-serif text-lg text-forest-900">Conteúdos personalizados</h3>
              {extras.map(e => (
                <div key={e.id} className="bg-paper-soft border border-line rounded-3xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-forest-900 text-sm">{e.title}</p>
                    {e.content_type && <span className="text-[10px] bg-mint text-forest-700 px-2 py-0.5 rounded-full flex-shrink-0">{getContentTypeLabel(e.content_type)}</span>}
                  </div>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{e.body}</p>
                  <p className="text-xs text-ink-soft/70">{e.sent_at ? new Date(e.sent_at).toLocaleDateString('pt-BR') : ''}</p>
                </div>
              ))}
            </div>
          )}

          {/* Histórico (§15) */}
          {(historyItems.length > 0 || reviews.length > 0) && (
            <div>
              <button onClick={() => setShowHistory(s => !s)} className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:text-forest-900">
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />} Ver planos anteriores
              </button>
              {showHistory && (
                <div className="space-y-3 mt-3">
                  {historyItems.map(p => <PlanCard key={p.id} plan={p} catalog={catalog} onOpenArticle={onOpenArticle} compact />)}
                  {reviews.map(r => <LegacyReviewCard key={r.id} r={r} compact />)}
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-ink-soft/80 flex items-start gap-2 pt-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-forest-400" /> {CARE_PLAN_DISCLAIMER}
          </p>
        </div>
      )}
    </div>
  )
}

function PlanCard({ plan, catalog, onOpenArticle, compact }: {
  plan: SentPlan; catalog: Map<string, CatalogItem>; onOpenArticle?: (slug: string) => void; compact?: boolean
}) {
  const c = plan.care_plan
  const s = plan.ai_summary_json
  const recs = (plan.recommended_content_ids ?? []).map(id => catalog.get(id)).filter(Boolean) as CatalogItem[]
  return (
    <div className="bg-paper-soft border border-line rounded-3xl p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-lg sm:text-xl text-forest-900 capitalize">Plano de {monthTitle(plan.month_reference)}</h3>
        <span className="text-xs text-ink-soft whitespace-nowrap">{plan.sent_at ? formatDateBR(plan.sent_at.slice(0, 10)) : ''}</span>
      </div>
      <p className="text-xs text-ink-soft -mt-2">Período analisado: {formatPeriodShort({ start: plan.period_start, end: plan.period_end })}</p>

      {(plan.ai_summary || s?.general_overview) && (
        <div className="bg-mint/40 border border-forest-100 rounded-2xl p-4">
          <p className="text-sm text-forest-800 leading-relaxed">{plan.ai_summary || s?.general_overview}</p>
        </div>
      )}

      {c?.monthly_priority && <Field label="Prioridade do mês" value={c.monthly_priority} strong />}
      {!compact && (
        <>
          {c?.main_care && <Field label="Cuidado principal" value={c.main_care} />}
          {c?.recommended_practice && <Field label="Prática recomendada" value={c.recommended_practice} />}
          {c?.attention_point && <Field label="Ponto de atenção" value={c.attention_point} />}
          {c?.small_commitment && <Field label="Pequeno compromisso possível" value={c.small_commitment} />}
          {c?.checkin_suggestion && <Field label="Sugestão de check-in" value={c.checkin_suggestion} />}

          {(c?.reflection_questions?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-ink-soft font-medium mb-1 flex items-center gap-1.5"><HelpCircle className="w-3.5 h-3.5" /> Perguntas para reflexão</p>
              <ul className="space-y-1.5">
                {c!.reflection_questions.map((q, i) => <li key={i} className="text-sm text-ink leading-relaxed flex gap-2"><span className="text-forest-400 mt-0.5">•</span>{q}</li>)}
              </ul>
            </div>
          )}

          {recs.length > 0 && (
            <div>
              <p className="text-xs text-ink-soft font-medium mb-2 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Conteúdos guiados recomendados</p>
              <div className="grid sm:grid-cols-2 gap-2">
                {recs.map(rc => (
                  <button key={rc.id} onClick={() => rc.slug && onOpenArticle?.(rc.slug)} className="text-left border border-line rounded-xl p-3 hover:border-forest-200 hover:bg-white transition-colors">
                    <p className="text-sm font-medium text-forest-900 line-clamp-2">{rc.title}</p>
                    <p className="text-xs text-ink-soft mt-0.5">{rc.category}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {c?.final_message && (
            <div className="bg-white border border-line rounded-2xl p-4">
              <p className="text-sm text-forest-800 leading-relaxed flex items-start gap-2"><Heart className="w-4 h-4 flex-shrink-0 mt-0.5 text-coral" /> {c.final_message}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function LegacyReviewCard({ r, compact }: { r: Review; compact?: boolean }) {
  return (
    <div className="bg-paper-soft border border-line rounded-3xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-forest-900 capitalize">Plano de {monthLabel(r.month_key)}</h3>
        <span className="text-xs text-ink-soft">{new Date(r.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
      {r.summary && <Field label="Resumo" value={r.summary} />}
      {!compact && r.suggested_adjustments && <Field label="Pequenos cuidados sugeridos" value={r.suggested_adjustments} />}
      {!compact && r.next_focus && <Field label="Prioridade do próximo período" value={r.next_focus} />}
      {r.pdf_url && (
        <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-forest-700 hover:underline">
          <Download className="w-4 h-4" /> Baixar em PDF
        </a>
      )}
    </div>
  )
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-soft font-medium mb-1">{label}</p>
      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${strong ? 'text-forest-900 font-medium' : 'text-ink'}`}>{value}</p>
    </div>
  )
}
