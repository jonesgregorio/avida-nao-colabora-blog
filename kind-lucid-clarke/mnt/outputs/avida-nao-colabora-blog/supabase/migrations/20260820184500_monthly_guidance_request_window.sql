-- ============================================================================
-- Go-live: protege no servidor a janela da Orientação Mensal.
--
-- A UI já limita o pedido ao mês-calendário atual e até o dia 23, mas a policy
-- de INSERT precisa impor a mesma regra para impedir bypass direto pela API.
-- America/Sao_Paulo é a referência canônica do produto.
--
-- Não altera leitura, revisão Admin, resposta, notificações ou automações.
-- ============================================================================

begin;

drop policy if exists guidance_own_request on public.monthly_guidance_requests;
create policy guidance_own_request
on public.monthly_guidance_requests
for insert
with check (
  user_id = (select auth.uid())
  and status = 'open'
  and nullif(btrim(coalesce(message, '')), '') is not null
  and response is null
  and final_response_json is null
  and coalesce(ai_draft_json, '{}'::jsonb) = '{}'::jsonb
  and responded_at is null
  and responded_by is null
  and ai_prompt_type is null
  and ai_prompt_version is null
  and model_used is null
  and regenerated_at is null
  and regenerated_by is null
  and error_message is null
  and coalesce(fallback_used, false) = false
  and coalesce(data_quality, '{}'::jsonb) = '{}'::jsonb
  and month_key = to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM')
  and extract(day from timezone('America/Sao_Paulo', now()))::integer <= 23
  and (
    has_active_unlimited_access((select auth.uid()))
    or exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.subscription_status = any (array['active'::text, 'trialing'::text])
        and effective_plan_for_user(p.user_id) = 'plus'::text
    )
  )
);

comment on policy guidance_own_request on public.monthly_guidance_requests is
  'Permite ao usuário elegível abrir somente a orientação do mês-calendário atual, até o dia 23 em America/Sao_Paulo, sem injetar campos de resposta/IA/Admin.';

commit;
