import { createClient } from 'npm:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://avidanaocolabora.com',
  'https://www.avidanaocolabora.com',
  'https://avida-nao-colabora-blog.vercel.app',
])

const PAGE_SIZE = 500

function corsHeaders(origin: string | null) {
  const allowed = origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin))
    ? origin
    : Deno.env.get('SITE_URL') ?? 'https://www.avidanaocolabora.com'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('Origin'))

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada.' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
  const userId = user.id

  const admin = createClient(url, serviceKey)

  async function fetchAll(table: string, select: string, filterColumn = 'user_id') {
    const rows: unknown[] = []
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from(table)
        .select(select)
        .eq(filterColumn, userId)
        .range(from, from + PAGE_SIZE - 1)
      if (error) throw new Error(`${table}: ${error.message}`)
      const page = (data ?? []) as unknown[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return rows
  }

  async function fetchTicketMessages(ticketIds: string[]) {
    if (ticketIds.length === 0) return []
    const rows: unknown[] = []
    const chunkSize = 100
    for (let i = 0; i < ticketIds.length; i += chunkSize) {
      const ids = ticketIds.slice(i, i + chunkSize)
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await admin
          .from('ticket_messages')
          .select('id,ticket_id,sender_role,content,created_at,read_at,attachments')
          .in('ticket_id', ids)
          .eq('is_internal', false)
          .range(from, from + PAGE_SIZE - 1)
        if (error) throw new Error(`ticket_messages: ${error.message}`)
        const page = (data ?? []) as unknown[]
        rows.push(...page)
        if (page.length < PAGE_SIZE) break
      }
    }
    return rows
  }

  try {
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('user_id,full_name,display_name,preferred_name,avatar_url,plan,created_at,updated_at,status_phrase,communication_preference,notification_frequency,email_notifications,account_status,last_seen_at,email,subscription_status,payment_status,trial_end,plan_activated_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (profileError) throw profileError

    const [
      diaryEntries,
      questionnaires,
      weeklyEvaluations,
      reports,
      monthlyReports,
      carePlans,
      guidance,
      professionalComments,
      carePlanReviews,
      savedItems,
      readingHistory,
      recommendations,
      deliveries,
      notifications,
      emailPreferences,
      notificationPreferences,
      privacyPreferences,
      aiSummaries,
      contentHistory,
      planHistory,
      planChangeHistory,
      articleFeedback,
      analyticsEvents,
      emailLogs,
      deliveryLogs,
      subscriptions,
      paymentEvents,
      subscriptionEvents,
      cancellationFeedback,
      sessions,
      comments,
      aiGenerationMetadata,
      supportTickets,
    ] = await Promise.all([
      fetchAll('diary_entries', '*'),
      fetchAll('questionnaire_responses', 'id,answers,score,category,status,total_score,generated_tags,result_id,started_at,completed_at,created_at,updated_at,current_step,questionnaire_id,result_title,result_summary,result_insights,recommended_next_steps,recommended_content_ids'),
      fetchAll('weekly_evaluations', '*'),
      fetchAll('reports', 'id,report_type,plan_required,period_start,period_end,generated_at,available_at,status,title,summary,content,pdf_url,created_at,updated_at,model_used,fallback_used,data_quality'),
      fetchAll('monthly_reports', 'id,month_key,plan_key,report_type,title,summary,data_json,pdf_url,status,created_at,updated_at'),
      fetchAll('monthly_care_plans', 'id,month_reference,period_start,period_end,available_at,plan_required,status,records_summary,ai_summary,ai_summary_json,care_plan,recommended_content_ids,generated_by_ai,generated_at,reviewed_at,sent_at,created_at,updated_at,model_used,fallback_used,data_quality'),
      fetchAll('monthly_guidance_requests', 'id,month_key,status,created_at,message,context,expected_help,response,responded_at,updated_at,model_used,fallback_used,data_quality,final_response_json'),
      fetchAll('professional_comments', 'id,report_month,report_id,title,comment,comment_text,professional_name,visibility,is_read,created_at'),
      fetchAll('self_care_plan_reviews', 'id,review_month,summary,suggested_adjustments,is_read,created_at'),
      fetchAll('saved_items', '*'),
      fetchAll('reading_history', '*'),
      fetchAll('content_recommendations', '*'),
      fetchAll('personalized_content_deliveries', 'id,plan_key,content_type,title,body,target_area,ai_generated,status,sent_at,created_at,updated_at,read_at'),
      fetchAll('notifications', 'id,title,body,type,is_read,read_at,created_at,message,action_url,destination_path,priority,email_sent_at,email_status'),
      fetchAll('email_preferences', '*'),
      fetchAll('user_notification_preferences', '*'),
      fetchAll('user_privacy_preferences', 'history_personalization_enabled,updated_at'),
      fetchAll('user_ai_summaries', 'id,summary,data_snapshot,provider,status,created_at'),
      fetchAll('user_content_history', '*'),
      fetchAll('user_plan_history', 'id,old_plan,new_plan,reason,created_at'),
      fetchAll('plan_change_history', 'id,old_plan,new_plan,change_type,amount_charged,effective_at,source,notes,created_at'),
      fetchAll('article_feedback', '*'),
      fetchAll('analytics_events', 'id,event,entity_id,entity_title,metadata,session_id,referrer,user_agent,created_at'),
      fetchAll('email_logs', 'id,email,subject,status,sent_at,to_email,template_key,provider,related_entity_type,related_entity_id,created_at,updated_at,delivered_at,opened_at,clicked_at,bounced_at,trigger_reason'),
      fetchAll('notification_delivery_logs', 'id,notification_id,channel,status,destination_path,email_to,created_at'),
      fetchAll('user_subscriptions', 'id,plan_key,status,current_period_start,current_period_end,cancel_at_period_end,pending_plan,pending_plan_starts_at,provider,created_at,updated_at,pending_plan_key,pending_change_type,pending_change_status,canceled_at,trial_end,payment_status,plan_activated_at,last_payment_confirmed_at,last_payment_failed_at,last_payment_amount,subscription_created_at'),
      fetchAll('payment_events', 'id,plan_key,amount,currency,status,type,provider,description,created_at'),
      fetchAll('subscription_events', 'id,event_type,previous_plan,new_plan,amount,currency,status,reasons,comment,occurred_at,created_at'),
      fetchAll('subscription_change_feedback', 'id,change_type,current_plan,target_plan,reasons,comment,requested_at,effective_at,status,created_at,updated_at,admin_reply,admin_replied_at,stripe_sync_status'),
      fetchAll('user_sessions', 'id,month_key,scheduled_at,duration_minutes,status,notes,professional_name,meeting_link,created_at,updated_at,preferred_slots,user_notes,completed_at,cancelled_at'),
      fetchAll('comments', 'id,article_id,author_name,content,created_at'),
      fetchAll('ai_generation_logs', 'id,content_type,provider,status,created_at,prompt_type,prompt_version,model_used,fallback_used,data_quality,source_period_start,source_period_end,generation_status,regenerated,notification_sent_at,email_sent_at'),
      fetchAll('support_tickets', 'id,ticket_number,subject,description,status,priority,plan_at_creation,resolved_at,closed_at,created_at,updated_at,contact_email,contact_name,source,category,last_message_at'),
    ])

    const ticketIds = (supportTickets as Array<{ id?: string }>)
      .map((ticket) => ticket.id)
      .filter((id): id is string => Boolean(id))
    const ticketMessages = await fetchTicketMessages(ticketIds)

    const payload = {
      export_version: '1.0',
      exported_at: new Date().toISOString(),
      service: 'A Vida Não Colabora',
      account: {
        id: userId,
        email: user.email ?? null,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at ?? null,
        email_confirmed_at: user.email_confirmed_at ?? null,
        profile,
        privacy_preferences: privacyPreferences,
      },
      emotional_journey: {
        diary_entries: diaryEntries,
        questionnaire_responses: questionnaires,
        weekly_evaluations: weeklyEvaluations,
        reports,
        monthly_reports: monthlyReports,
        monthly_care_plans: carePlans,
        monthly_guidance_requests: guidance,
        professional_comments: professionalComments,
        self_care_plan_reviews: carePlanReviews,
        ai_summaries: aiSummaries,
      },
      content_and_activity: {
        saved_items: savedItems,
        reading_history: readingHistory,
        content_recommendations: recommendations,
        personalized_deliveries: deliveries,
        content_history: contentHistory,
        article_feedback: articleFeedback,
        comments,
      },
      communication: {
        notifications,
        email_preferences: emailPreferences,
        notification_preferences: notificationPreferences,
        email_history: emailLogs,
        delivery_history: deliveryLogs,
        support_tickets: supportTickets,
        support_messages: ticketMessages,
        professional_sessions: sessions,
      },
      subscription_and_billing: {
        subscriptions,
        payment_events: paymentEvents,
        subscription_events: subscriptionEvents,
        subscription_change_feedback: cancellationFeedback,
        plan_history: planHistory,
        plan_change_history: planChangeHistory,
      },
      technical_transparency: {
        analytics_events: analyticsEvents,
        ai_generation_metadata: aiGenerationMetadata,
      },
      note: 'Este arquivo contém dados vinculados à sua conta no aplicativo. Segredos, senhas, notas internas de administração e identificadores internos de provedores de pagamento não são incluídos.',
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('export-user-data:', (error as Error).message)
    return new Response(JSON.stringify({ error: 'Não foi possível preparar sua exportação agora. Tente novamente em instantes.' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  }
})