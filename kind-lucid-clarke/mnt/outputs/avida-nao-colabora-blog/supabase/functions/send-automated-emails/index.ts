import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeia frequência → dias da semana/mês para disparar
function shouldSendToday(frequency: string): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=dom, 1=seg...
  const dayOfMonth = now.getDate()

  switch (frequency) {
    case 'Diário':
      return true
    case 'Semanal':
      return dayOfWeek === 1 // Segunda-feira
    case 'Quinzenal':
      return dayOfMonth === 1 || dayOfMonth === 15
    case 'Mensal':
      return dayOfMonth === 1
    default:
      return false
  }
}

// Template HTML do e-mail
function buildEmailHtml(title: string, tipo: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1c1917;padding:32px 40px;">
      <p style="margin:0;color:#a8a29e;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;">${tipo}</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:400;line-height:1.4;">${title}</h1>
    </div>

    <!-- Content -->
    <div style="padding:40px;color:#44403c;font-size:16px;line-height:1.8;">
      ${content.split('\n\n').map(p => `<p style="margin:0 0 20px;">${p}</p>`).join('')}
    </div>

    <!-- CTA -->
    <div style="padding:0 40px 40px;">
      <a href="https://avida-nao-colabora-blog.vercel.app"
         style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;">
        Acessar A Vida Não Colabora →
      </a>
    </div>

    <!-- Footer -->
    <div style="background:#fafaf9;padding:24px 40px;border-top:1px solid #e7e5e4;">
      <p style="margin:0;color:#a8a29e;font-size:12px;font-family:Arial,sans-serif;line-height:1.6;">
        Você está recebendo este e-mail porque é usuário de <strong>A Vida Não Colabora</strong>.<br>
        Para cancelar, acesse seu perfil e desative os e-mails automáticos.
      </p>
    </div>
  </div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY não configurada')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Buscar conteúdos ativos
    const { data: contents, error: contentsError } = await supabase
      .from('automated_contents')
      .select('*')
      .eq('active', true)

    if (contentsError) throw contentsError

    const todayContents = (contents || []).filter(c => shouldSendToday(c.frequency))

    if (todayContents.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhum conteúdo para enviar hoje', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let totalSent = 0
    const logs: Record<string, unknown>[] = []

    for (const content of todayContents) {
      // Buscar usuários elegíveis pelo plano
      const planOrder = ['free', 'essential', 'therapeutic', 'therapeutic-plus']
      const minPlanIndex = planOrder.indexOf(content.plan_required)
      const eligiblePlans = planOrder.slice(minPlanIndex)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, plan, email_notifications')
        .in('plan', eligiblePlans)
        .eq('email_notifications', true)

      const users = profiles || []

      for (const user of users) {
        if (!user.email) continue

        // Verificar se já foi enviado hoje para este usuário
        const today = new Date().toISOString().split('T')[0]
        const { data: alreadySent } = await supabase
          .from('email_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('content_id', content.id)
          .gte('sent_at', `${today}T00:00:00`)
          .single()

        if (alreadySent) continue

        // Enviar e-mail via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'A Vida Não Colabora <noreply@avidanaocolabora.com.br>',
            to: [user.email],
            subject: content.title,
            html: buildEmailHtml(content.title, content.type, content.content),
          }),
        })

        const emailResult = await emailResponse.json()
        const success = emailResponse.ok

        // Registrar log
        await supabase.from('email_logs').insert({
          user_id: user.id,
          content_id: content.id,
          email: user.email,
          subject: content.title,
          status: success ? 'sent' : 'failed',
          error: success ? null : JSON.stringify(emailResult),
        })

        if (success) totalSent++
        logs.push({ email: user.email, content: content.title, success })
      }
    }

    return new Response(
      JSON.stringify({ message: 'Envio concluído', sent: totalSent, logs }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
