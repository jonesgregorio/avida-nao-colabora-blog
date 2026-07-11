import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Crown, Loader2, AlertTriangle, ArrowUp, ArrowDown, X, ShieldCheck, Sprout, Leaf } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'
import { OFFICIAL_PLANS, PUBLIC_PLAN_FEATURES, normalizePlan } from '../lib/officialPlans'
import { PLAN_COMPARE_ROWS } from '../lib/planComparison'

interface Props {
  user: User | null
  profile: Profile | null
  onBack: () => void
  onNavigateAuth: () => void
  onRefreshProfile: () => void
}

interface Subscription {
  id: string
  plan_key: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  pending_plan: string | null
  pending_plan_starts_at: string | null
}

interface PlanChangeRecord {
  id: string
  old_plan: string | null
  new_plan: string | null
  change_type: string | null
  amount_charged: number
  effective_at: string | null
  source: string
  notes: string | null
  created_at: string
}

const PLAN_PRICES: Record<string, number> = Object.fromEntries(
  OFFICIAL_PLANS.map(p => [p.key, p.priceValue])
)

const PLAN_LABELS: Record<string, string> = Object.fromEntries(
  OFFICIAL_PLANS.map(p => [p.key, p.label])
)

const PLAN_ORDER: string[] = OFFICIAL_PLANS.map(p => p.key)

const PLAN_FEATURES = PUBLIC_PLAN_FEATURES as Record<string, string[]>

const PLAN_COLORS: Record<string, string> = {
  free: 'border-line bg-paper-soft',
  essential: 'border-forest-200 bg-mint/40',
  plus: 'border-coral/50 bg-coral/10',
}

// Matriz de comparação (alinhada à referência visual de "Meu plano").
type CellValue = boolean | string
// Fonte única compartilhada com "Ver planos" (Pricing) — ver src/lib/planComparison.ts
const COMPARE_ROWS = PLAN_COMPARE_ROWS

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  cancel_pending: 'Cancelamento agendado',
  cancelled: 'Cancelada',
  past_due: 'Pagamento em atraso',
  trial: 'Trial',
  inactive: 'Inativa',
  free: 'Ativo',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  cancel_pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-stone-100 text-stone-500',
  past_due: 'bg-red-100 text-red-700',
  trial: 'bg-blue-100 text-blue-700',
  inactive: 'bg-stone-100 text-stone-500',
  free: 'bg-mint text-forest-700',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatPrice(v: number) {
  return v === 0 ? 'R$ 0,00' : `R$ ${v.toFixed(2).replace('.', ',')}`
}

function daysRemaining(end: string | null): number {
  if (!end) return 30
  const diff = new Date(end).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86400000))
}

function totalDaysInCycle(start: string | null, end: string | null): number {
  if (!start || !end) return 30
  return Math.max(1, Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
}

function calcEffectivePeriodEnd(sub: Subscription | null, planAnchor: Date): string {
  if (sub?.current_period_end) return sub.current_period_end
  // Calcula o fim do ciclo atual com base na data de ativação do plano (ciclos de 30 dias)
  const msPerCycle = 30 * 86400000
  const elapsed = Date.now() - planAnchor.getTime()
  const cyclesDone = Math.max(0, Math.floor(elapsed / msPerCycle))
  return new Date(planAnchor.getTime() + (cyclesDone + 1) * msPerCycle).toISOString()
}

function lostFeatures(fromPlan: string, toPlan: string): string[] {
  const fromIdx = PLAN_ORDER.indexOf(fromPlan)
  const toIdx = PLAN_ORDER.indexOf(toPlan)
  if (fromIdx <= toIdx) return []
  // Acumula todos os benefícios dos planos pagos perdidos, do mais alto até o mais baixo (exclusive toPlan)
  const lost: string[] = []
  for (let i = toIdx + 1; i <= fromIdx; i++) {
    for (const f of PLAN_FEATURES[PLAN_ORDER[i]] ?? []) {
      if (!f.startsWith('Tudo do') && !lost.includes(f)) lost.push(f)
    }
  }
  return lost
}

function calcUpgradeProration(currentPlan: string, newPlan: string, sub: Subscription | null): number {
  const diff = PLAN_PRICES[newPlan] - PLAN_PRICES[currentPlan]
  if (diff <= 0) return 0
  const remaining = daysRemaining(sub?.current_period_end ?? null)
  const total = totalDaysInCycle(sub?.current_period_start ?? null, sub?.current_period_end ?? null)
  return Math.max(0, (diff / total) * remaining)
}

export default function MyPlanPage({ user, profile, onBack: _onBack, onNavigateAuth, onRefreshProfile: _onRefreshProfile }: Props) {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [history, setHistory] = useState<PlanChangeRecord[]>([])
  const [planActivatedAt, setPlanActivatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate'; targetPlan?: string } | null>(null)
  const [acting, setActing] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const currentPlan = normalizePlan(profile?.plan)

  useEffect(() => {
    if (!user) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadData() {
    setLoading(true)
    const cp = normalizePlan(profile?.plan)
    const [subRes, histRes, planHistRes] = await Promise.all([
      supabase.from('user_subscriptions').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('plan_change_history').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(20),
      // Busca a data em que o plano atual foi ativado
      supabase.from('plan_change_history')
        .select('created_at')
        .eq('user_id', user!.id)
        .eq('new_plan', cp)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    setSub(subRes.data as Subscription | null)
    setHistory((histRes.data as PlanChangeRecord[]) ?? [])
    // Data de ativação: registro no plan_change_history, ou user_plan_history como fallback
    if (planHistRes.data?.created_at) {
      setPlanActivatedAt(planHistRes.data.created_at)
    } else {
      // Fallback: busca em user_plan_history (tabela anterior)
      const { data: oldHist } = await supabase
        .from('user_plan_history')
        .select('created_at')
        .eq('user_id', user!.id)
        .eq('new_plan', cp)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPlanActivatedAt(oldHist?.created_at ?? null)
    }
    setLoading(false)
  }

  // Âncora do ciclo: data de ativação do plano atual. Fallback: hoje.
  function getPlanAnchor(): Date {
    if (planActivatedAt) return new Date(planActivatedAt)
    return new Date() // sem histórico: ciclo começa agora
  }

  async function handleUpgrade(targetPlan: string) {
    setActing(true)
    setActionMsg(null)
    try {
      // Sem plano pago (Gratuito) → PRIMEIRA assinatura via checkout do Stripe.
      if (currentPlan === 'free') {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { plan: targetPlan, origin: window.location.origin },
        })
        if (error || !data?.url) throw new Error(error?.message ?? 'URL de checkout não retornada')
        setModal(null)
        window.location.href = data.url  // plano só muda via webhook após pagamento
        return
      }
      // Já tem plano pago → UPGRADE altera a assinatura existente (proration), sem novo checkout.
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'upgrade', targetPlan },
      })
      if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? 'Erro ao fazer upgrade')
      setModal(null)
      setActionMsg({ type: 'ok', text: data.message ?? `Upgrade para ${PLAN_LABELS[targetPlan]} em processamento.` })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      console.error('handleUpgrade:', msg)
      setModal(null)
      setActionMsg({ type: 'err', text: msg })
    } finally {
      setActing(false)
    }
  }

  async function handleDowngrade(targetPlan: string) {
    setActing(true)
    setActionMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'downgrade', targetPlan },
      })
      if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? 'Erro ao agendar downgrade')
      setModal(null)
      setActionMsg({ type: 'ok', text: data.message ?? `Downgrade para ${PLAN_LABELS[targetPlan]} agendado.` })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao agendar downgrade'
      console.error('handleDowngrade:', msg)
      setModal(null)
      setActionMsg({ type: 'err', text: msg })
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    setActing(true)
    setActionMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel' },
      })
      if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? 'Erro ao cancelar assinatura')
      setModal(null)
      setActionMsg({ type: 'ok', text: data.message ?? 'Cancelamento agendado. Você mantém acesso até o fim do ciclo.' })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cancelar assinatura'
      console.error('handleCancel:', msg)
      setModal(null)
      setActionMsg({ type: 'err', text: msg })
    } finally {
      setActing(false)
    }
  }

  async function handleReactivate() {
    setActing(true)
    setActionMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'reactivate' },
      })
      if (error || !data?.ok) throw new Error(error?.message ?? data?.error ?? 'Erro ao reativar assinatura')
      setModal(null)
      setActionMsg({ type: 'ok', text: data.message ?? 'Cancelamento removido. Seu plano continuará ativo normalmente.' })
      loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reativar assinatura'
      console.error('handleReactivate:', msg)
      setModal(null)
      setActionMsg({ type: 'err', text: msg })
    } finally {
      setActing(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-sage-500 mb-4">Faça login para visualizar seu plano.</p>
        <button onClick={onNavigateAuth} className="bg-purple-600 text-white px-6 py-3 rounded-full text-sm font-medium">Entrar</button>
      </div>
    )
  }

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 text-purple-500 animate-spin" /></div>
  }

  const effectivePeriodEnd = calcEffectivePeriodEnd(sub, getPlanAnchor())

  const isUpgrade = (plan: string) => PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan)
  const isCancelPending = sub?.cancel_at_period_end || sub?.status === 'cancel_pending'
  const hasPendingDowngrade = !!sub?.pending_plan && sub.pending_plan !== currentPlan && !isCancelPending

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="font-serif text-3xl md:text-4xl text-forest-900 flex items-center gap-2">
          Meu plano <Sprout className="w-6 h-6 text-forest-400" />
        </h1>
        <p className="mt-2 text-ink-soft">Gerencie sua assinatura e descubra tudo o que cada plano pode fazer por você.</p>
      </header>

      {actionMsg && (
        <div className={`mb-6 flex items-start gap-2 px-4 py-3 rounded-xl border text-sm ${actionMsg.type === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {actionMsg.type === 'err' && <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
          {actionMsg.text}
          <button onClick={() => setActionMsg(null)} className="ml-auto text-current opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Card do plano atual */}
      <div className={`rounded-2xl border-2 p-6 mb-6 shadow-sm ${PLAN_COLORS[currentPlan]}`}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-forest-600 font-medium mb-1">Seu plano atual</p>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-forest-500" />
              <span className="font-serif text-2xl text-forest-900">{PLAN_LABELS[currentPlan]}</span>
            </div>
            <p className="text-2xl font-bold text-forest-800">{formatPrice(PLAN_PRICES[currentPlan])}<span className="text-sm font-normal text-ink-soft">{currentPlan !== 'free' ? '/mês' : ''}</span></p>
          </div>
          {(() => {
            // No plano Gratuito não há assinatura: mostramos "Ativo" (o plano está
            // valendo) em vez de "Inativa", que parecia que a conta estava com problema.
            const effectiveStatus = currentPlan === 'free' ? 'free' : (sub?.status ?? 'active')
            return (
              <span className={`text-xs px-3 py-1.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLORS[effectiveStatus]}`}>
                {STATUS_LABELS[effectiveStatus]}
              </span>
            )
          })()}
        </div>

        {sub && (
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            {sub.current_period_start && (
              <div><p className="text-stone-400 mb-0.5">Início do ciclo</p><p className="font-medium text-stone-700">{formatDate(sub.current_period_start)}</p></div>
            )}
            {sub.current_period_end && currentPlan !== 'free' && (
              <div><p className="text-stone-400 mb-0.5">Próxima cobrança</p><p className="font-medium text-stone-700">{formatDate(sub.current_period_end)}</p></div>
            )}
          </div>
        )}

        {isCancelPending && (
          <div className="bg-amber-100 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
            <strong>Cancelamento agendado.</strong> Seu plano ficará ativo até {formatDate(effectivePeriodEnd)}. Depois disso, você voltará para o plano Gratuito. Seus dados serão preservados.
          </div>
        )}

        {hasPendingDowngrade && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800">
            <strong>Downgrade agendado:</strong> Seu plano mudará para {PLAN_LABELS[sub!.pending_plan!]} em {formatDate(sub?.pending_plan_starts_at ?? null)}.
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          {isCancelPending ? (
            <button
              onClick={() => setModal({ type: 'reactivate' })}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition-colors"
            >
              Manter meu plano
            </button>
          ) : currentPlan !== 'free' ? (
            <button
              onClick={() => setModal({ type: 'cancel' })}
              className="text-sm border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors"
            >
              Cancelar plano
            </button>
          ) : null}
        </div>
      </div>

      {/* Comparação dos planos */}
      <h2 className="font-serif text-xl sm:text-2xl text-forest-900 mb-4">Compare os planos e escolha o ideal para você</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {OFFICIAL_PLANS.map(p => {
          const isCurrent = p.key === currentPlan
          const up = isUpgrade(p.key)
          return (
            <div key={p.key} className={`relative rounded-3xl border bg-paper-soft p-5 flex flex-col ${p.recommended ? 'border-forest-300 shadow-sm' : 'border-line'}`}>
              {p.recommended && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide bg-coral text-[#7a3320] px-3 py-1 rounded-full">Mais escolhido</span>
              )}
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"><Leaf className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="font-serif text-lg text-forest-900 leading-tight">{p.label}</p>
                  <p className="text-[11px] text-ink-soft leading-tight">{p.tagline}</p>
                </div>
              </div>
              <p className="mt-3 font-serif text-2xl text-forest-900">
                {p.price}<span className="text-sm font-normal text-ink-soft">{p.priceValue > 0 ? '/mês' : ''}</span>
              </p>
              <div className="mt-4">
                {isCurrent ? (
                  <span className="block text-center text-sm font-medium bg-mint text-forest-700 rounded-xl py-2.5">Plano atual</span>
                ) : isCancelPending ? (
                  <span className="block text-center text-sm text-ink-soft rounded-xl py-2.5 border border-line">Indisponível agora</span>
                ) : (
                  <button
                    onClick={() => setModal({ type: up ? 'upgrade' : 'downgrade', targetPlan: p.key })}
                    className={`w-full text-sm font-medium rounded-xl py-2.5 transition-colors ${up ? 'bg-forest-900 text-white hover:bg-forest-800' : 'border border-line text-forest-700 hover:bg-mint/50'}`}
                  >
                    {up ? 'Fazer upgrade' : p.key === 'free' ? 'Mudar para Gratuito' : 'Fazer downgrade'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Matriz de recursos */}
      <div className="bg-paper-soft border border-line rounded-3xl overflow-hidden mb-6">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-2 px-4 sm:px-5 py-2.5 bg-mint/40 text-[11px] font-semibold text-forest-700">
          <span>Recurso</span>
          <span className="text-center">Gratuito</span>
          <span className="text-center">Essencial</span>
          <span className="text-center">Plus</span>
        </div>
        {COMPARE_ROWS.map((row, i) => (
          <div key={row.label} className={`grid grid-cols-[1.4fr_1fr_1fr_1fr] items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
            <span className="text-ink-soft">{row.label}</span>
            {(['free', 'essential', 'plus'] as const).map(k => (
              <span key={k} className="text-center"><Cell value={row.values[k]} /></span>
            ))}
          </div>
        ))}
      </div>

      {/* Histórico */}
      {history.length > 0 && (
        <div>
          <h2 className="font-semibold text-sage-800 mb-3 text-sm">Histórico de alterações</h2>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="bg-white border border-stone-100 rounded-xl p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                  {h.change_type === 'upgrade' && <ArrowUp className="w-3.5 h-3.5 text-emerald-600" />}
                  {h.change_type === 'downgrade' && <ArrowDown className="w-3.5 h-3.5 text-amber-600" />}
                  {(h.change_type === 'cancel' || h.change_type === 'reactivate') && <Crown className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-stone-500">{PLAN_LABELS[h.old_plan ?? ''] ?? h.old_plan ?? '—'}</span>
                    <span className="text-stone-300">→</span>
                    <span className="font-medium text-stone-800">{PLAN_LABELS[h.new_plan ?? ''] ?? h.new_plan ?? '—'}</span>
                    {h.amount_charged > 0 && (
                      <span className="text-emerald-600 font-medium">{formatPrice(h.amount_charged)}</span>
                    )}
                  </div>
                  {h.notes && <p className="text-xs text-stone-400 mt-0.5">{h.notes}</p>}
                  <p className="text-xs text-stone-300 mt-0.5">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aviso */}
      <div className="mt-6 rounded-3xl border border-line bg-mint/40 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-forest-600">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <p className="text-sm text-forest-800 leading-relaxed flex-1">
          Todos os planos podem ser cancelados a qualquer momento, sem taxas escondidas. Pagamentos são processados com segurança pelo Stripe — seu plano só é ativado após a confirmação.
        </p>
      </div>

      {/* Modal de upgrade */}
      {modal?.type === 'upgrade' && modal.targetPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sage-800">Confirmar upgrade</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 mb-5">
              {[
                ['Plano atual', PLAN_LABELS[currentPlan]],
                ['Novo plano', PLAN_LABELS[modal.targetPlan]],
                ['Valor atual', formatPrice(PLAN_PRICES[currentPlan]) + '/mês'],
                ['Novo valor mensal', formatPrice(PLAN_PRICES[modal.targetPlan]) + '/mês'],
                ['Dias restantes no ciclo', `${daysRemaining(effectivePeriodEnd)} dias`],
                ['Diferença mensal', formatPrice(PLAN_PRICES[modal.targetPlan] - PLAN_PRICES[currentPlan])],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-stone-500">{label}</span>
                  <span className="font-medium text-stone-800">{value}</span>
                </div>
              ))}
              {(() => {
                const proration = calcUpgradeProration(currentPlan, modal.targetPlan, sub)
                return proration > 0 ? (
                  <>
                    <div className="border-t pt-3 flex justify-between text-sm font-semibold">
                      <span className="text-stone-700">Valor proporcional estimado</span>
                      <span className="text-purple-700">{formatPrice(proration)}</span>
                    </div>
                    <p className="text-xs text-stone-400">
                      Como ainda restam {daysRemaining(effectivePeriodEnd)} dias no ciclo atual, será cobrada a diferença proporcional estimada de {formatPrice(proration)}. A próxima mensalidade será de {formatPrice(PLAN_PRICES[modal.targetPlan])}.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                      Você será redirecionado para o Stripe para concluir o pagamento. Seu plano só será alterado após confirmação.
                    </div>
                  </>
                ) : null
              })()}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleUpgrade(modal.targetPlan!)}
                disabled={acting}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Ir para pagamento
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de downgrade */}
      {modal?.type === 'downgrade' && modal.targetPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sage-800">Confirmar downgrade de plano</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4 mb-5">
              {/* Resumo de planos */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <p className="text-[10px] text-stone-400 mb-0.5">Plano atual</p>
                  <p className="text-sm font-semibold text-stone-800">{PLAN_LABELS[currentPlan]}</p>
                  <p className="text-xs text-stone-500">{formatPrice(PLAN_PRICES[currentPlan])}/mês</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <p className="text-[10px] text-stone-400 mb-0.5">Novo plano</p>
                  <p className="text-sm font-semibold text-stone-800">{PLAN_LABELS[modal.targetPlan]}</p>
                  <p className="text-xs text-stone-500">{formatPrice(PLAN_PRICES[modal.targetPlan])}/mês</p>
                </div>
              </div>

              {/* Data de vigência */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-800 mb-1">Você continua no plano atual até</p>
                <p className="text-lg font-bold text-blue-900">{formatDate(effectivePeriodEnd)}</p>
                <p className="text-xs text-blue-700 mt-1">
                  O plano <strong>{PLAN_LABELS[modal.targetPlan]}</strong> só entrará em vigor após essa data.
                  Até lá, você mantém acesso completo ao plano <strong>{PLAN_LABELS[currentPlan]}</strong>.
                </p>
              </div>

              {/* Funcionalidades perdidas */}
              {(() => {
                const lost = lostFeatures(currentPlan, modal.targetPlan)
                return lost.length > 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Funcionalidades que você perderá ao mudar para {PLAN_LABELS[modal.targetPlan]}:
                    </p>
                    <ul className="space-y-1.5">
                      {lost.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                          <X className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              })()}

              <p className="text-xs text-stone-400">Seus dados não serão apagados. Você pode reverter o downgrade antes da data de vigência.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDowngrade(modal.targetPlan!)}
                disabled={acting}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar downgrade
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cancelamento */}
      {modal?.type === 'cancel' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 my-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-red-700">Cancelar assinatura</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4 mb-5">
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <p className="text-[10px] text-stone-400 mb-0.5">Plano atual</p>
                  <p className="text-sm font-semibold text-stone-800">{PLAN_LABELS[currentPlan]}</p>
                </div>
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                  <p className="text-[10px] text-stone-400 mb-0.5">Plano após cancelamento</p>
                  <p className="text-sm font-semibold text-stone-800">Gratuito</p>
                </div>
              </div>

              {/* Data */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-800 mb-1">Acesso garantido até</p>
                <p className="text-lg font-bold text-amber-900">{formatDate(effectivePeriodEnd)}</p>
                <p className="text-xs text-amber-700 mt-1">
                  Você continua com acesso completo ao plano <strong>{PLAN_LABELS[currentPlan]}</strong> até essa data.
                  Depois disso, sua conta será migrada automaticamente para o plano <strong>Gratuito</strong>.
                </p>
              </div>

              {/* Funcionalidades perdidas */}
              {(() => {
                const lost = lostFeatures(currentPlan, 'free')
                return lost.length > 0 ? (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Funcionalidades que você perderá ao migrar para o plano Gratuito:
                    </p>
                    <ul className="space-y-1.5">
                      {lost.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-red-700">
                          <X className="w-3 h-3 flex-shrink-0 mt-0.5 text-red-400" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              })()}

              <p className="text-xs text-stone-400">Seus dados não serão apagados. Você poderá reativar seu plano a qualquer momento antes da data de expiração.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={acting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar cancelamento
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Desistir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de reativação */}
      {modal?.type === 'reactivate' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sage-800">Manter meu plano</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-stone-600 mb-5">Deseja remover o cancelamento agendado e manter o plano {PLAN_LABELS[currentPlan]} ativo?</p>
            <div className="flex gap-2">
              <button
                onClick={handleReactivate}
                disabled={acting}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Manter meu plano
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Célula da matriz de comparação: booleano → check/traço; texto → rótulo.
function Cell({ value }: { value: CellValue }) {
  if (value === true) return <Check className="w-4 h-4 text-forest-600 inline" aria-label="Incluído" />
  if (value === false) return <span className="text-ink-soft/40" aria-label="Não incluído">—</span>
  return <span className="text-forest-800 font-medium">{value}</span>
}
