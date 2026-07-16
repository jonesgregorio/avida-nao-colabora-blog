import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Ações suportadas
type Action = 'cancel' | 'downgrade' | 'reactivate' | 'upgrade'

const SITE = Deno.env.get('SITE_URL') || Deno.env.get('APP_URL') || 'https://avidanaocolabora.com'

// Price IDs por env var (mesma fonte do create-checkout — nunca hardcoded).
// Preço do Plus (R$ 39,90): prefere o secret de go-live STRIPE_PRICE_PLUS_3990 e cai
// no STRIPE_PRICE_THERAPEUTIC (que hoje guarda o price de 39,90). Mesmo padrão do
// create-checkout — não renomeie STRIPE_PRICE_THERAPEUTIC (quebra a cobrança atual).
const PLUS_PRICE = Deno.env.get('STRIPE_PRICE_PLUS_3990') || Deno.env.get('STRIPE_PRICE_THERAPEUTIC')
const PRICE_IDS: Record<string, string | undefined> = {
  essential: Deno.env.get('STRIPE_PRICE_ESSENTIAL'),
  plus: PLUS_PRICE,
  // Compat de planos legados no banco → mesmo price do Plus atual.
  therapeutic: PLUS_PRICE,
  'therapeutic-plus': PLUS_PRICE,
}

// Rótulos amigáveis (apenas EXIBIÇÃO — não altera plano/preço/hierarquia).
const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial', plus: 'Plus', therapeutic: 'Plus', 'therapeutic-plus': 'Plus',
}
const planLabel = (p: string | null | undefined): string => (p && PLAN_LABELS[p]) || p || ''

// Datas para o usuário SEMPRE no fuso de São Paulo. Sem isso, o servidor (UTC)
// exibiria um dia diferente do que a interface mostra para o mesmo instante.
// Meia-noite UTC exata = data de calendário (não instante real) → ler em UTC, senão
// o fuso -03 joga a exibição para o dia anterior. Timestamp real do Stripe → São Paulo.
const BILLING_TZ = 'America/Sao_Paulo'
const fmtBR = (iso: string): string => {
  const d = new Date(iso)
  const isCalendarDate = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  return d.toLocaleDateString('pt-BR', { timeZone: isCalendarDate ? 'UTC' : BILLING_TZ })
}
// Hierarquia — distingue upgrade (subiu) de downgrade (desceu).
const PLAN_RANK: Record<string, number> = { free: 0, essential: 1, plus: 2, therapeutic: 2, 'therapeutic-plus': 2 }
const rankOf = (p: string | null | undefined): number => (p && PLAN_RANK[p]) ?? 0

// Dispara e-mail transacional (nunca quebra o fluxo — erro só é logado).
async function sendTxEmail(templateKey: string, toEmail: string | null | undefined, variables: Record<string, unknown>, idempotencyKey: string, userId?: string | null): Promise<void> {
  if (!toEmail) return
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId ?? null, to_email: toEmail, template_key: templateKey, variables, idempotency_key: idempotencyKey }),
    })
  } catch (e) {
    console.error('sendTxEmail falhou:', templateKey, (e as Error).message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  // Autentica o usuário via JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: 'Não autorizado' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { action: Action; targetPlan?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Body inválido' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const { action, targetPlan } = body
  if (!['cancel', 'downgrade', 'reactivate', 'upgrade'].includes(action)) {
    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const jsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  // Busca assinatura do usuário
  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // Busca plano atual
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, stripe_customer_id, email, full_name')
    .eq('user_id', user.id)
    .single()

  const currentPlan = profile?.plan ?? 'free'
  const stripeSubId = sub?.provider_subscription_id ?? null

  // Fim do ciclo pago. O STRIPE é a fonte da verdade — a linha do banco pode estar
  // desatualizada (webhook atrasado, ou plano ajustado à mão) e não pode virar a data
  // exibida ao usuário. Só caímos no banco quando não há assinatura no Stripe.
  async function resolvePeriodEnd(): Promise<string | null> {
    if (stripeSubId) {
      try {
        const s = await stripe.subscriptions.retrieve(stripeSubId)
        if (s.current_period_end) return new Date(s.current_period_end * 1000).toISOString()
      } catch (e) {
        console.error('resolvePeriodEnd (Stripe):', (e as Error).message)
      }
    }
    return sub?.current_period_end ?? null
  }

  try {
    // ── UPGRADE (pago → pago superior): altera a assinatura EXISTENTE (nunca cria nova)
    //    e cobra a diferença proporcional agora. O plano superior só é liberado quando o
    //    webhook (subscription.updated) confirmar — nunca aqui.
    if (action === 'upgrade') {
      if (!targetPlan) return jsonResponse({ error: 'targetPlan obrigatório para upgrade' }, 400)
      const newPrice = PRICE_IDS[targetPlan]
      if (!newPrice) return jsonResponse({ error: `Plano inválido ou Price ID ausente: ${targetPlan}` }, 400)
      if (rankOf(targetPlan) <= rankOf(currentPlan)) {
        return jsonResponse({ error: 'Upgrade deve ser para um plano superior.' }, 400)
      }
      if (!stripeSubId) {
        return jsonResponse({ error: 'Sem assinatura ativa para upgrade. Assine um plano primeiro.' }, 400)
      }

      const subscription = await stripe.subscriptions.retrieve(stripeSubId)
      const itemId = subscription.items.data[0]?.id
      if (!itemId) return jsonResponse({ error: 'Item de assinatura não encontrado.' }, 400)

      await stripe.subscriptions.update(stripeSubId, {
        items: [{ id: itemId, price: newPrice }],
        proration_behavior: 'always_invoice', // cobra a diferença proporcional imediatamente
      })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Upgrade em processamento',
        body: `Aplicando seu upgrade para ${planLabel(targetPlan)}. Os novos recursos liberam assim que o pagamento confirmar.`,
        type: 'info', action_url: 'my-plan', destination_path: 'my-plan',
      }).then(({ error }) => { if (error) console.error('notif upgrade:', error) })

      return jsonResponse({ ok: true, message: `Upgrade para ${planLabel(targetPlan)} em processamento.` })
    }

    if (action === 'cancel') {
      // Cancela ao fim do período
      if (stripeSubId) {
        await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })
      }

      const effectiveAt = await resolvePeriodEnd()
      if (!effectiveAt) {
        return jsonResponse({ error: 'Não foi possível determinar o fim do ciclo da sua assinatura. Tente novamente em instantes.' }, 409)
      }

      const { error: subErr } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        status: 'cancel_pending',
        cancel_at_period_end: true,
        pending_plan: 'free',
        pending_plan_starts_at: effectiveAt,
      }, { onConflict: 'user_id' })
      if (subErr) throw new Error('Erro ao atualizar assinatura: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id,
        old_plan: currentPlan,
        new_plan: 'free',
        change_type: 'cancel',
        amount_charged: 0,
        effective_at: effectiveAt,
        source: 'user',
        notes: `Cancelamento agendado para ${fmtBR(effectiveAt)}`,
      }).then(({ error }) => { if (error) console.error('plan_change_history cancel:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Cancelamento agendado',
        body: `Sua assinatura será encerrada ao fim do ciclo atual. Você mantém acesso até lá.`,
        type: 'info',
        action_url: 'my-plan', destination_path: 'my-plan',
      }).then(({ error }) => { if (error) console.error('notif cancel:', error) })

      // E-mail de confirmação de cancelamento solicitado (não bloqueia o fluxo)
      await sendTxEmail('plan_cancel_requested', profile?.email ?? user.email, {
        nome: profile?.full_name || 'você',
        plano_atual: planLabel(currentPlan),
        data_fim_ciclo: fmtBR(effectiveAt),
        link_meu_plano: `${SITE}/meu-plano`,
      }, `plan_cancel_requested:${user.id}:${effectiveAt}`, user.id)

      return jsonResponse({
        ok: true,
        message: `Cancelamento agendado para ${fmtBR(effectiveAt)}.`,
        effectiveAt,
      })
    }

    // ── DOWNGRADE (pago → pago inferior): agenda a troca de price para o FIM DO CICLO
    //    via Subscription Schedule — NÃO cancela. Assim o usuário mantém o plano atual
    //    até lá e, no próximo ciclo, tem uma assinatura VÁLIDA e COBRADA do plano inferior.
    if (action === 'downgrade') {
      if (!targetPlan) return jsonResponse({ error: 'targetPlan obrigatório para downgrade' }, 400)
      const newPrice = PRICE_IDS[targetPlan]
      if (!newPrice) return jsonResponse({ error: `Plano inválido ou Price ID ausente: ${targetPlan}` }, 400)
      if (targetPlan === 'free' || rankOf(targetPlan) >= rankOf(currentPlan)) {
        return jsonResponse({ error: 'Downgrade é para um plano pago inferior. Para virar Gratuito, use cancelar.' }, 400)
      }
      if (!stripeSubId) {
        return jsonResponse({ error: 'Sem assinatura ativa para downgrade.' }, 400)
      }

      const subscription = await stripe.subscriptions.retrieve(stripeSubId)
      const currentPrice = subscription.items.data[0]?.price.id as string
      const periodEnd = subscription.current_period_end
      const startsAt = new Date(periodEnd * 1000).toISOString()
      const fimCiclo = fmtBR(startsAt)

      // Schedule a partir da assinatura: fase 1 = price atual até o fim do ciclo,
      // fase 2 = price novo (inferior) a partir daí.
      const schedule = await stripe.subscriptionSchedules.create({ from_subscription: stripeSubId })
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: 'release',
        phases: [
          { items: [{ price: currentPrice, quantity: 1 }], start_date: schedule.phases[0].start_date, end_date: periodEnd },
          { items: [{ price: newPrice, quantity: 1 }] },
        ],
      })

      // Guarda o agendamento p/ exibir em "Meu Plano" (NÃO muda profiles.plan agora).
      const { error: subErr } = await supabase.from('user_subscriptions').upsert({
        user_id: user.id,
        pending_plan: targetPlan,
        pending_plan_starts_at: startsAt,
        cancel_at_period_end: false,
      }, { onConflict: 'user_id' })
      if (subErr) throw new Error('Erro ao agendar downgrade: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id, old_plan: currentPlan, new_plan: targetPlan,
        change_type: 'downgrade_intent', amount_charged: 0, effective_at: startsAt,
        source: 'user', notes: `Downgrade para ${targetPlan} agendado (schedule ${schedule.id}) p/ ${fimCiclo}`,
      }).then(({ error }) => { if (error) console.error('plan_change_history downgrade:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id, title: 'Downgrade agendado',
        body: `Seu plano muda para ${planLabel(targetPlan)} em ${fimCiclo}. Até lá, você mantém o ${planLabel(currentPlan)}.`,
        type: 'info', action_url: 'my-plan', destination_path: 'my-plan',
      }).then(({ error }) => { if (error) console.error('notif downgrade:', error) })

      await sendTxEmail('plan_downgrade_scheduled', profile?.email ?? user.email, {
        nome: profile?.full_name || 'você',
        plano_atual: planLabel(currentPlan), plano_novo: planLabel(targetPlan),
        data_fim_ciclo: fimCiclo, link_meu_plano: `${SITE}/meu-plano`,
      }, `plan_downgrade_scheduled:${user.id}:${startsAt}`, user.id)

      return jsonResponse({ ok: true, message: `Downgrade para ${planLabel(targetPlan)} agendado para ${fimCiclo}.`, effectiveAt: startsAt })
    }

    if (action === 'reactivate') {
      // Remove o cancelamento agendado E/OU o downgrade agendado (libera o schedule).
      if (stripeSubId) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubId)
        if (subscription.cancel_at_period_end) {
          await stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: false })
        }
        if (subscription.schedule) {
          try { await stripe.subscriptionSchedules.release(subscription.schedule as string) }
          catch (e) { console.error('release schedule (reactivate):', (e as Error).message) }
        }
      }

      const { error: subErr } = await supabase.from('user_subscriptions').update({
        status: 'active',
        cancel_at_period_end: false,
        pending_plan: null,
        pending_plan_starts_at: null,
      }).eq('user_id', user.id)
      if (subErr) throw new Error('Erro ao reativar assinatura: ' + subErr.message)

      await supabase.from('plan_change_history').insert({
        user_id: user.id,
        old_plan: currentPlan,
        new_plan: currentPlan,
        change_type: 'reactivate',
        amount_charged: 0,
        effective_at: new Date().toISOString(),
        source: 'user',
        notes: 'Cancelamento removido pelo usuário',
      }).then(({ error }) => { if (error) console.error('plan_change_history reactivate:', error) })

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Assinatura reativada',
        body: `O cancelamento agendado foi removido. Seu plano continua ativo normalmente.`,
        type: 'info',
        action_url: 'my-plan', destination_path: 'my-plan',
      }).then(({ error }) => { if (error) console.error('notif reactivate:', error) })

      await sendTxEmail('plan_reactivated', profile?.email ?? user.email, {
        nome: profile?.full_name || 'você',
        plano_atual: planLabel(currentPlan),
        link_meu_plano: `${SITE}/meu-plano`,
      }, `plan_reactivated:${user.id}:${Date.now()}`, user.id)

      return jsonResponse({
        ok: true,
        message: 'Alteração removida. Seu plano continua ativo normalmente.',
      })
    }
  } catch (err) {
    console.error(`manage-subscription ${action}:`, (err as Error).message)
    return new Response(JSON.stringify({ error: (err as Error).message ?? 'Erro interno' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  return jsonResponse({ error: 'Ação não tratada' }, 400)
})
