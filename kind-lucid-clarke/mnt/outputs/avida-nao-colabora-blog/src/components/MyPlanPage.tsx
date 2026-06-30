import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Check, Crown, ChevronLeft, Loader2, AlertTriangle, ArrowUp, ArrowDown, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '../types'

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

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  essential: 19.9,
  therapeutic: 39.9,
  'therapeutic-plus': 79.9,
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_ORDER = ['free', 'essential', 'therapeutic', 'therapeutic-plus']

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'Artigos gratuitos',
    'Questionário básico de autoavaliação',
    'Diário de bem-estar com até 5 entradas por mês',
    'Registro simples de humor',
    'Mini-desafios quinzenais automatizados',
    'Histórico limitado',
    'Conteúdos com anúncios',
  ],
  essential: [
    'Tudo do Gratuito',
    'Diário ilimitado',
    'Histórico completo',
    'Avaliações semanais',
    'Gráficos simples de evolução',
    'Meditações guiadas em texto',
    'Notas guiadas no diário',
    'Relatórios mensais em PDF',
    'Resumo do diário, humor e sintomas',
    'Destaques de evolução, sem análise clínica',
    'Biblioteca de exercícios emocionais',
    'Sem anúncios',
    'Suporte por e-mail prioritário',
  ],
  therapeutic: [
    'Tudo do Essencial',
    'Questionário aprofundado',
    'Plano de autocuidado personalizado',
    'Diário avançado',
    'Marcadores extras: sono, depressão, medo, compulsão, gatilhos, ansiedade, autoestima e energia',
    'Gráficos comparativos mensais',
    'Relatório mensal avançado',
    'Recomendações personalizadas de conteúdo',
    'Plano semanal de autocuidado',
    'Acesso antecipado a novos conteúdos',
    'Orientação mensal por mensagem',
  ],
  'therapeutic-plus': [
    'Tudo do Terapêutico',
    '1 sessão mensal de 30 minutos com Psicanalista',
    'Revisão mensal do plano de autocuidado',
    'Comentário individual sobre o relatório do mês',
    'Suporte prioritário máximo',
  ],
}

const PLAN_COLORS: Record<string, string> = {
  free: 'border-stone-300 bg-stone-50',
  essential: 'border-blue-300 bg-blue-50',
  therapeutic: 'border-purple-400 bg-purple-50',
  'therapeutic-plus': 'border-emerald-400 bg-emerald-50',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  cancel_pending: 'Cancelamento agendado',
  cancelled: 'Cancelada',
  past_due: 'Pagamento em atraso',
  trial: 'Trial',
  inactive: 'Inativa',
}
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  cancel_pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-stone-100 text-stone-500',
  past_due: 'bg-red-100 text-red-700',
  trial: 'bg-blue-100 text-blue-700',
  inactive: 'bg-stone-100 text-stone-500',
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

function calcUpgradeProration(currentPlan: string, newPlan: string, sub: Subscription | null): number {
  const diff = PLAN_PRICES[newPlan] - PLAN_PRICES[currentPlan]
  if (diff <= 0) return 0
  const remaining = daysRemaining(sub?.current_period_end ?? null)
  const total = totalDaysInCycle(sub?.current_period_start ?? null, sub?.current_period_end ?? null)
  return Math.max(0, (diff / total) * remaining)
}

export default function MyPlanPage({ user, profile, onBack, onNavigateAuth, onRefreshProfile }: Props) {
  const [sub, setSub] = useState<Subscription | null>(null)
  const [history, setHistory] = useState<PlanChangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ type: 'upgrade' | 'downgrade' | 'cancel' | 'reactivate'; targetPlan?: string } | null>(null)
  const [acting, setActing] = useState(false)
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const currentPlan = profile?.plan ?? 'free'

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  async function loadData() {
    setLoading(true)
    const [subRes, histRes] = await Promise.all([
      supabase.from('user_subscriptions').select('*').eq('user_id', user!.id).maybeSingle(),
      supabase.from('plan_change_history').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(20),
    ])
    setSub(subRes.data as Subscription | null)
    setHistory((histRes.data as PlanChangeRecord[]) ?? [])
    setLoading(false)
  }

  async function getOrCreateSub(): Promise<Subscription | null> {
    if (sub) return sub
    const now = new Date()
    const end = new Date(now); end.setDate(end.getDate() + 30)
    const { data, error } = await supabase.from('user_subscriptions').upsert({
      user_id: user!.id,
      plan_key: currentPlan,
      status: currentPlan === 'free' ? 'inactive' : 'active',
      current_period_start: now.toISOString(),
      current_period_end: end.toISOString(),
    }, { onConflict: 'user_id' }).select().single()
    if (error || !data) return null
    setSub(data as Subscription)
    return data as Subscription
  }

  async function recordChange(opts: {
    oldPlan: string; newPlan: string; changeType: string;
    amount?: number; notes?: string; effectiveAt?: string
  }) {
    await supabase.from('plan_change_history').insert({
      user_id: user!.id,
      old_plan: opts.oldPlan,
      new_plan: opts.newPlan,
      change_type: opts.changeType,
      amount_charged: opts.amount ?? 0,
      effective_at: opts.effectiveAt ?? new Date().toISOString(),
      source: 'user',
      notes: opts.notes ?? null,
    })
  }

  async function sendNotification(title: string, body: string) {
    await supabase.from('notifications').insert({
      user_id: user!.id, title, body,
      type: 'plan_change', action_view: 'my-plan',
      action_label: 'Ver meu plano', is_read: false,
    })
  }

  async function handleUpgrade(targetPlan: string) {
    setActing(true)
    setActionMsg(null)
    const currentSub = await getOrCreateSub()

    const prorationAmount = calcUpgradeProration(currentPlan, targetPlan, currentSub)

    // Registra intenção de pagamento (checkout real depende de integração)
    await supabase.from('payment_events').insert({
      user_id: user!.id,
      subscription_id: currentSub?.id ?? null,
      plan_key: targetPlan,
      amount: prorationAmount,
      currency: 'BRL',
      status: 'pending',
      type: 'upgrade_proration',
      description: `Upgrade proporcional de ${PLAN_LABELS[currentPlan]} para ${PLAN_LABELS[targetPlan]}`,
    })

    // Atualiza plano no profile e subscription
    const { error } = await supabase.from('profiles').update({ plan: targetPlan }).eq('user_id', user!.id)
    if (error) { setActionMsg({ type: 'err', text: 'Erro ao atualizar plano. Tente novamente.' }); setActing(false); return }

    await supabase.from('user_subscriptions').upsert({
      user_id: user!.id,
      plan_key: targetPlan,
      status: 'active',
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
    }, { onConflict: 'user_id' })

    await recordChange({
      oldPlan: currentPlan, newPlan: targetPlan, changeType: 'upgrade', amount: prorationAmount,
      notes: prorationAmount > 0
        ? `Valor proporcional: ${formatPrice(prorationAmount)} (checkout pendente de integração)`
        : undefined,
    })

    await sendNotification(
      'Plano atualizado',
      `Seu plano foi alterado para ${PLAN_LABELS[targetPlan]}. ${prorationAmount > 0 ? `Valor a pagar: ${formatPrice(prorationAmount)} (integração de checkout necessária).` : ''}`,
    )

    setModal(null)
    setActionMsg({ type: 'ok', text: `Plano alterado para ${PLAN_LABELS[targetPlan]}! ${prorationAmount > 0 ? `Cobrança proporcional de ${formatPrice(prorationAmount)} pendente de integração com checkout.` : ''}` })
    onRefreshProfile()
    loadData()
    setActing(false)
  }

  async function handleDowngrade(targetPlan: string) {
    setActing(true)
    setActionMsg(null)
    const currentSub = await getOrCreateSub()
    const effectiveAt = currentSub?.current_period_end ?? new Date().toISOString()

    await supabase.from('user_subscriptions').upsert({
      user_id: user!.id,
      pending_plan: targetPlan,
      pending_plan_starts_at: effectiveAt,
      cancel_at_period_end: targetPlan === 'free',
    }, { onConflict: 'user_id' })

    await recordChange({
      oldPlan: currentPlan, newPlan: targetPlan, changeType: 'downgrade',
      effectiveAt,
      notes: `Agendado para ${formatDate(effectiveAt)}`,
    })

    await sendNotification(
      'Downgrade agendado',
      `Seu plano será alterado para ${PLAN_LABELS[targetPlan]} em ${formatDate(effectiveAt)}.`,
    )

    setModal(null)
    setActionMsg({ type: 'ok', text: `Downgrade para ${PLAN_LABELS[targetPlan]} agendado para ${formatDate(effectiveAt)}.` })
    loadData()
    setActing(false)
  }

  async function handleCancel() {
    setActing(true)
    setActionMsg(null)
    const currentSub = await getOrCreateSub()
    const effectiveAt = currentSub?.current_period_end ?? new Date().toISOString()

    await supabase.from('user_subscriptions').upsert({
      user_id: user!.id,
      status: 'cancel_pending',
      cancel_at_period_end: true,
      pending_plan: 'free',
      pending_plan_starts_at: effectiveAt,
    }, { onConflict: 'user_id' })

    await recordChange({
      oldPlan: currentPlan, newPlan: 'free', changeType: 'cancel',
      effectiveAt,
      notes: `Cancelamento agendado para ${formatDate(effectiveAt)}`,
    })

    await sendNotification(
      'Cancelamento agendado',
      `Seu plano continuará ativo até ${formatDate(effectiveAt)}. Depois disso, você voltará para o plano Gratuito.`,
    )

    setModal(null)
    setActionMsg({ type: 'ok', text: `Cancelamento agendado para ${formatDate(effectiveAt)}. Você mantém acesso até lá.` })
    loadData()
    setActing(false)
  }

  async function handleReactivate() {
    setActing(true)
    setActionMsg(null)

    await supabase.from('user_subscriptions').update({
      status: 'active',
      cancel_at_period_end: false,
      pending_plan: null,
      pending_plan_starts_at: null,
    }).eq('user_id', user!.id)

    await recordChange({
      oldPlan: currentPlan, newPlan: currentPlan, changeType: 'reactivate',
      notes: 'Cancelamento removido pelo usuário',
    })

    await sendNotification('Assinatura reativada', 'O cancelamento foi removido. Seu plano continuará ativo normalmente.')

    setModal(null)
    setActionMsg({ type: 'ok', text: 'Cancelamento removido. Seu plano continuará ativo normalmente.' })
    loadData()
    setActing(false)
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

  const isUpgrade = (plan: string) => PLAN_ORDER.indexOf(plan) > PLAN_ORDER.indexOf(currentPlan)
  const isDowngrade = (plan: string) => PLAN_ORDER.indexOf(plan) < PLAN_ORDER.indexOf(currentPlan)
  const isCancelPending = sub?.cancel_at_period_end || sub?.status === 'cancel_pending'
  const hasPendingDowngrade = !!sub?.pending_plan && sub.pending_plan !== currentPlan && !isCancelPending

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-6">
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <h1 className="font-serif text-3xl text-sage-800 mb-1">Meu Plano</h1>
      <p className="text-sage-500 text-sm mb-8">Gerencie sua assinatura e recursos disponíveis.</p>

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
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-purple-500" />
              <span className="font-serif text-xl text-sage-800">{PLAN_LABELS[currentPlan]}</span>
            </div>
            <p className="text-2xl font-bold text-sage-700">{formatPrice(PLAN_PRICES[currentPlan])}<span className="text-sm font-normal text-sage-400">{currentPlan !== 'free' ? '/mês' : ''}</span></p>
          </div>
          {(() => {
            const effectiveStatus = sub?.status ?? (currentPlan !== 'free' ? 'active' : 'inactive')
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
            <strong>Cancelamento agendado.</strong> Seu plano ficará ativo até {formatDate(sub?.current_period_end ?? null)}. Depois disso, você voltará para o plano Gratuito. Seus dados serão preservados.
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

      {/* Recursos do plano atual */}
      <div className="bg-white border border-stone-100 rounded-2xl p-5 mb-6 shadow-sm">
        <h2 className="font-semibold text-sage-800 mb-3 text-sm">Recursos incluídos no seu plano</h2>
        <ul className="space-y-1.5">
          {PLAN_FEATURES[currentPlan].map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-sage-600">
              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Comparação de planos */}
      <h2 className="font-semibold text-sage-800 mb-4">Outros planos disponíveis</h2>
      <div className="space-y-4 mb-8">
        {PLAN_ORDER.filter(p => p !== currentPlan && !(p === 'free' && currentPlan !== 'free')).map(plan => {
          const upgrade = isUpgrade(plan)
          const downgrade = isDowngrade(plan)
          const proration = upgrade && currentPlan !== 'free'
            ? calcUpgradeProration(currentPlan, plan, sub)
            : null

          return (
            <div key={plan} className={`bg-white border-2 rounded-2xl p-5 shadow-sm ${PLAN_COLORS[plan]}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {upgrade && <ArrowUp className="w-4 h-4 text-emerald-500" />}
                    {downgrade && <ArrowDown className="w-4 h-4 text-amber-500" />}
                    <span className="font-semibold text-sage-800">{PLAN_LABELS[plan]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-white/70 text-stone-600">
                      {upgrade ? 'Upgrade' : 'Downgrade'}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-sage-700">
                    {formatPrice(PLAN_PRICES[plan])}
                    {plan !== 'free' && <span className="text-xs font-normal text-sage-400">/mês</span>}
                  </p>
                  {upgrade && proration !== null && proration > 0 && (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Hoje: {formatPrice(proration)} proporcional · {daysRemaining(sub?.current_period_end ?? null)} dias restantes
                    </p>
                  )}
                  {downgrade && currentPlan !== 'free' && (
                    <p className="text-xs text-amber-700 mt-0.5">Entra em vigor no fim do ciclo atual</p>
                  )}
                </div>
                {!isCancelPending && (
                  <button
                    onClick={() => setModal({ type: upgrade ? 'upgrade' : 'downgrade', targetPlan: plan })}
                    className={`flex-shrink-0 text-sm font-medium px-4 py-2 rounded-xl transition-colors ${upgrade ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border border-stone-300 text-stone-600 hover:bg-stone-50'}`}
                  >
                    {upgrade ? 'Fazer upgrade' : plan === 'free' ? 'Cancelar para Gratuito' : 'Fazer downgrade'}
                  </button>
                )}
              </div>
              <ul className="mt-3 space-y-1">
                {PLAN_FEATURES[plan].slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-sage-500">
                    <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />{f}
                  </li>
                ))}
                {PLAN_FEATURES[plan].length > 4 && (
                  <li className="text-xs text-stone-400 pl-5">+{PLAN_FEATURES[plan].length - 4} recursos</li>
                )}
              </ul>
            </div>
          )
        })}
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

      {/* Aviso de checkout */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <strong>Pagamento:</strong> A cobrança automática depende de integração com Stripe ou Mercado Pago. As alterações de plano são registradas, mas a cobrança real só será efetuada após configuração do checkout.
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
                ['Dias restantes no ciclo', `${daysRemaining(sub?.current_period_end ?? null)} dias`],
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
                      <span className="text-stone-700">Valor proporcional agora</span>
                      <span className="text-purple-700">{formatPrice(proration)}</span>
                    </div>
                    <p className="text-xs text-stone-400">
                      Você está alterando do plano {PLAN_LABELS[currentPlan]} para o {PLAN_LABELS[modal.targetPlan]}. Como ainda restam {daysRemaining(sub?.current_period_end ?? null)} dias no seu ciclo atual, será cobrada apenas a diferença proporcional de {formatPrice(proration)} agora. A próxima mensalidade será de {formatPrice(PLAN_PRICES[modal.targetPlan])}.
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                      Pagamento ainda não processado. Integração com checkout necessária para concluir automaticamente.
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
                Confirmar upgrade
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sage-800">Agendar downgrade</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm"><span className="text-stone-500">Plano atual</span><span className="font-medium">{PLAN_LABELS[currentPlan]}</span></div>
              <div className="flex justify-between text-sm"><span className="text-stone-500">Novo plano</span><span className="font-medium">{PLAN_LABELS[modal.targetPlan]}</span></div>
              <div className="flex justify-between text-sm"><span className="text-stone-500">Entra em vigor</span><span className="font-medium">{formatDate(sub?.current_period_end ?? null)}</span></div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
                Seu plano será alterado para {PLAN_LABELS[modal.targetPlan]} ao final do ciclo atual, em {formatDate(sub?.current_period_end ?? null)}. Até lá, você continuará com acesso ao plano {PLAN_LABELS[currentPlan]}.
              </div>
              <p className="text-xs text-stone-400">Recursos perdidos após o downgrade: {PLAN_FEATURES[currentPlan].filter(f => !PLAN_FEATURES[modal.targetPlan!].some(nf => nf.includes(f.substring(0, 20)))).slice(0, 3).join(', ')}{PLAN_FEATURES[currentPlan].length > 3 ? '...' : '.'}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDowngrade(modal.targetPlan!)}
                disabled={acting}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Agendar downgrade
              </button>
              <button onClick={() => setModal(null)} className="px-4 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-600 hover:bg-stone-50">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de cancelamento */}
      {modal?.type === 'cancel' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-red-700">Cancelar assinatura</h3>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm"><span className="text-stone-500">Plano atual</span><span className="font-medium">{PLAN_LABELS[currentPlan]}</span></div>
              <div className="flex justify-between text-sm"><span className="text-stone-500">Ativo até</span><span className="font-medium">{formatDate(sub?.current_period_end ?? null)}</span></div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-800">
                <p>Seu plano continuará ativo até o fim do ciclo atual. Depois disso, sua conta voltará para o plano Gratuito.</p>
                <p className="mt-2 text-xs">Seus dados não serão apagados, mas alguns recursos premium deixarão de ficar disponíveis.</p>
              </div>
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
