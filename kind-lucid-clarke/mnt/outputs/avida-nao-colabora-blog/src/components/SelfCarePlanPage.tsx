import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { normalizePlan } from '../lib/officialPlans'
import { getContentTypeLabel } from '../lib/personalizedContentLabels'
import { Sprout, Loader2, Download, ArrowRight, Sparkles, ShieldCheck, ChevronDown, BookOpen, HelpCircle, Heart } from 'lucide-react'
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

// Área PRÓPRIA do Plano de Autocuidado — exclusiva do Plus. Cada plano é um
// cartão sanfona: fechado por padrão (só cabeçalho + prioridade), abre para ver
// o plano de ação completo — assim a página não fica enorme.
export default function SelfCarePlanPage({ user, profile, onNavigatePricing, onNavigate, onOpenArticle }: Props) {
  const plan = normalizePlan(profile?.plan)
  const isPlus = plan === 'plus'
  const [sentPlans, setSentPlans] = useState<SentPlan[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [catalog, setCatalog] = useState<Map<string, CatalogItem>>(new Map())
  const [loading, setLoading] = useState(isPlus)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user || !isPlus) { setLoading(false); return }
    let active = true
    Promise.all([
      // RLS: só devolve os PRÓPRIOS planos já ENVIADOS (nunca draft, nunca de outro).
      supabase.from('monthly_care_plans').select('id, month_reference, period_start, period_end, sent_at, ai_summary, ai_summary_json, care_plan, recommended_content_ids')
        .eq('user_id', user.id).eq('status', 'sent').order('month_reference', { ascending: false }).limit(120),
      supabase.from('self_care_plan_reviews').select('*').eq('user_id', user.id).order('month_key', { ascending: false }).limit(120),
      supabase.from('personalized_content_deliveries')
        .select('id, title, body, content_type, sent_at')
        .eq('user_id', user.id).eq('status', 'sent').eq('target_area', 'self_care_plan')
        .order('sent_at', { ascending: false }).limit(10),
      fetchGuidedCatalog(),
    ]).then(([mp, r, d, cat]) => {
      if (!active) return
      const plans = (mp.data ?? []) as SentPlan[]
      setSentPlans(plans)
      setReviews((r.data ?? []) as Review[])
      setExtras((d.data ?? []) as Extra[])
      setCatalog(new Map((cat ?? []).map(c => [c.id, c])))
      // Todos os planos começam FECHADOS; o usuário abre manualmente.
      setOpenIds(new Set())
      setLoading(false)
    })
    return () => { active = false }
  }, [user, isPlus])

  const toggle = (id: string) => setOpenIds(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const current = sentPlans[0] ?? null

  // Sinal para conteúdos ligados à prioridade do mês (usa o plano novo; se não
  // houver, cai para a revisão legada).
  const focusText = current
    ? [current.care_plan?.monthly_priority, ...(current.ai_summary_json?.recurring_triggers ?? []), ...(current.ai_summary_json?.main_emotions ?? [])].filter(Boolean).join(' ')
    : reviews[0] ? [reviews[0].next_focus, reviews[0].summary].filter(Boolean).join(' ') : ''
  const focusSignal = focusText ? signalFromTags([focusText]) : null
  const careSignal = focusSignal && focusSignal.hasData ? focusSignal : undefined

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
      ) : sentPlans.length === 0 && reviews.length === 0 ? (
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
        <div className="space-y-6">
          {/* Lista sanfona: cada plano abre para mostrar o plano de ação. */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-serif text-lg text-forest-900">Seus planos de autocuidado</h2>
              <p className="text-xs text-ink-soft">Toque em um plano para ver o plano de ação.</p>
            </div>
            <div className="space-y-3">
              {sentPlans.map(p => (
                <PlanCard key={p.id} plan={p} catalog={catalog} onOpenArticle={onOpenArticle} open={openIds.has(p.id)} onToggle={() => toggle(p.id)} />
              ))}
              {reviews.map(r => (
                <LegacyReviewCard key={r.id} r={r} open={openIds.has(r.id)} onToggle={() => toggle(r.id)} />
              ))}
            </div>
          </div>

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

          <p className="text-xs text-ink-soft/80 flex items-start gap-2 pt-1">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-forest-400" /> {CARE_PLAN_DISCLAIMER}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Cartão sanfona do plano mensal ────────────────────────────────────────────
function PlanCard({ plan, catalog, onOpenArticle, open, onToggle }: {
  plan: SentPlan; catalog: Map<string, CatalogItem>; onOpenArticle?: (slug: string) => void; open: boolean; onToggle: () => void
}) {
  const c = plan.care_plan
  const s = plan.ai_summary_json
  const recs = (plan.recommended_content_ids ?? []).map(id => catalog.get(id)).filter(Boolean) as CatalogItem[]
  return (
    <div className="border border-line rounded-3xl bg-paper-soft overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 text-left hover:bg-mint/20 transition-colors">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-forest-900 capitalize">Plano de {monthTitle(plan.month_reference)}</h3>
          <p className="text-xs text-ink-soft mt-0.5">
            {formatPeriodShort({ start: plan.period_start, end: plan.period_end })}
            {plan.sent_at ? ` · enviado ${formatDateBR(plan.sent_at.slice(0, 10))}` : ''}
          </p>
          {!open && c?.monthly_priority && (
            <p className="text-sm text-forest-700 mt-1.5 line-clamp-1"><span className="text-ink-soft">Prioridade: </span>{c.monthly_priority}</p>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-forest-500 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-1 space-y-4 border-t border-line/60">
          {(plan.ai_summary || s?.general_overview) && (
            <div className="bg-mint/40 border border-forest-100 rounded-2xl p-4 mt-4">
              <p className="text-sm text-forest-800 leading-relaxed">{plan.ai_summary || s?.general_overview}</p>
            </div>
          )}
          {c?.monthly_priority && <Field label="Prioridade do mês" value={c.monthly_priority} strong />}
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
        </div>
      )}
    </div>
  )
}

// ── Cartão sanfona do plano legado (self_care_plan_reviews) ───────────────────
function LegacyReviewCard({ r, open, onToggle }: { r: Review; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-line rounded-3xl bg-paper-soft overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-start justify-between gap-3 p-4 sm:p-5 text-left hover:bg-mint/20 transition-colors">
        <div className="min-w-0">
          <h3 className="font-serif text-lg text-forest-900 capitalize">Plano de {monthLabel(r.month_key)}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
          {!open && r.next_focus && <p className="text-sm text-forest-700 mt-1.5 line-clamp-1"><span className="text-ink-soft">Prioridade: </span>{r.next_focus}</p>}
        </div>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 text-forest-500 mt-1 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 pt-4 space-y-3 border-t border-line/60">
          {r.summary && <Field label="Resumo" value={r.summary} />}
          {r.suggested_adjustments && <Field label="Pequenos cuidados sugeridos" value={r.suggested_adjustments} />}
          {r.next_focus && <Field label="Prioridade do próximo período" value={r.next_focus} />}
          {r.pdf_url && (
            <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-forest-700 hover:underline">
              <Download className="w-4 h-4" /> Baixar em PDF
            </a>
          )}
        </div>
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
