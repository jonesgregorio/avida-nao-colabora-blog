import Stripe from 'npm:stripe@14'
import { createClient } from 'npm:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2024-06-20',
})

// Mapeia Price ID → nome do plano interno
const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_ESSENTIAL')    || '']: 'essential',
  [Deno.env.get('STRIPE_PRICE_THERAPEUTIC')  || '']: 'therapeutic',
  [Deno.env.get('STRIPE_PRICE_PLUS')         || '']: 'therapeutic-plus',
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Configuração de webhook incompleta', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature inválida:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Pagamento confirmado → ativa o plano
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    const plan = session.metadata?.plan

    if (userId && plan) {
      const { error } = await supabase
        .from('profiles')
        .update({ plan })
        .eq('user_id', userId)

      if (error) console.error('Erro ao atualizar plano:', error)
      else console.log(`Plano "${plan}" ativado para usuário ${userId}`)
    }
  }

  // Assinatura renovada → garante que o plano continua ativo
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
      const priceId = subscription.items.data[0]?.price.id
      const plan = PLAN_BY_PRICE[priceId]
      const customerId = subscription.customer as string

      if (plan && customerId) {
        const { error } = await supabase
          .from('profiles')
          .update({ plan })
          .eq('stripe_customer_id', customerId)

        if (error) console.error('Erro ao renovar plano:', error)
        else console.log(`Plano "${plan}" renovado para customer ${customerId}`)
      }
    }
  }

  // Assinatura cancelada → volta para plano gratuito
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = subscription.customer as string

    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', customerId)

    if (error) console.error('Erro ao cancelar plano:', error)
    else console.log(`Plano revertido para "free" — customer ${customerId}`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
