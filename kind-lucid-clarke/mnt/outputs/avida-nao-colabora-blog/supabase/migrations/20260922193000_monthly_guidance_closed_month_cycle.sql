-- Orientação Mensal: mês fechado -> solicitação no mês seguinte (dias 1 a 10).
-- Um usuário que ativou Plus em qualquer dia do mês de referência, inclusive no último,
-- mantém direito à orientação daquele mês no mês seguinte.
begin;

alter table public.monthly_guidance_requests
  add column if not exists request_origin text not null default 'user';

alter table public.monthly_guidance_requests
  drop constraint if exists monthly_guidance_requests_request_origin_check;
alter table public.monthly_guidance_requests
  add constraint monthly_guidance_requests_request_origin_check
  check (request_origin in ('user','admin'));

drop policy if exists guidance_own_request on public.monthly_guidance_requests;
create policy guidance_own_request
on public.monthly_guidance_requests
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and request_origin = 'user'
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
  and month_key = to_char(timezone('America/Sao_Paulo', now()) - interval '1 month', 'YYYY-MM')
  and extract(day from timezone('America/Sao_Paulo', now()))::integer between 1 and 10
  and (
    has_active_unlimited_access((select auth.uid()))
    or exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid())
        and p.subscription_status = any (array['active'::text, 'trialing'::text])
        and effective_plan_for_user(p.user_id) = 'plus'::text
        and coalesce(p.plan_activated_at, p.created_at)
          < date_trunc('month', timezone('America/Sao_Paulo', now()))
    )
  )
);

comment on column public.monthly_guidance_requests.request_origin is
  'user = solicitada pelo usuário; admin = orientação iniciada proativamente pela equipe.';
comment on policy guidance_own_request on public.monthly_guidance_requests is
  'Plus pode solicitar, entre os dias 1 e 10, uma orientação referente ao mês-calendário imediatamente anterior. Ativação em qualquer dia daquele mês é elegível.';

update public.plan_features
set feature_description = 'Orientação referente ao mês encerrado: solicitação entre os dias 1 e 10 do mês seguinte, com resposta revisada por profissional habilitado. Ativação do Plus em qualquer dia do mês de referência preserva o direito.',
    presentation_revision = extract(epoch from now())::bigint * 1000
where feature_key = 'monthly_message_guidance';

update public.faq_items
set answer = 'A Orientação Mensal é um recurso do Plus referente ao mês que acabou de fechar. Entre os dias 1 e 10 do mês seguinte, você pode enviar 1 solicitação sobre o período anterior e recebe a resposta em até 7 dias corridos após o envio. Se você entrou no Plus nos últimos dias do mês, mantém o direito à orientação daquele mês no mês seguinte. A resposta final é preparada cuidadosamente por profissional habilitado e é uma orientação pontual: não é psicoterapia, consulta, diagnóstico ou acompanhamento continuado.',
    updated_at = now()
where question = 'Como funciona a Orientação Mensal?';

commit;
