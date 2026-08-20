-- ==========================================================================
-- Go-live: contrato canônico da Orientação Mensal estruturada
--
-- final_response_json é a fonte de verdade nova da resposta revisada.
-- response e ai_draft_json permanecem apenas como compatibilidade/rascunho.
-- Esta migration:
--   1) impede o cliente de injetar resposta/rascunho de IA ao abrir um pedido;
--   2) valida o shape mínimo da carta estruturada;
--   3) promove ai_draft_json.final_response quando uma resposta legada é
--      marcada como answered sem final_response_json;
--   4) espelha a narrativa principal em response para leitores legados.
-- Não publica orientação, não muda status e não envia notificação por conta
-- própria. A transição para answered continua sendo uma ação do Admin.
-- ==========================================================================

begin;

create or replace function public.normalize_monthly_guidance_final_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_primary_text text;
begin
  -- Compatibilidade: se um fluxo antigo finalizar usando a carta estruturada
  -- que ainda está em ai_draft_json, promova-a para a coluna canônica.
  if new.status = 'answered'
     and new.final_response_json is null
     and jsonb_typeof(coalesce(new.ai_draft_json, '{}'::jsonb) -> 'final_response') = 'object' then
    new.final_response_json := new.ai_draft_json -> 'final_response';
  end if;

  if new.final_response_json is not null then
    if jsonb_typeof(new.final_response_json) <> 'object' then
      raise exception 'monthly guidance final_response_json must be a JSON object';
    end if;

    -- Campos textuais conhecidos: quando presentes, aceitam string ou null.
    foreach v_key in array array[
      'title',
      'user_request_summary',
      'emotional_context_summary',
      'gentle_guidance',
      'connection_with_self_care_plan',
      'suggested_reflection_question',
      'final_message_draft',
      'data_quality_notice',
      'review_badge'
    ] loop
      if new.final_response_json ? v_key
         and jsonb_typeof(new.final_response_json -> v_key) not in ('string', 'null') then
        raise exception 'monthly guidance final_response_json.% must be a string or null', v_key;
      end if;
    end loop;

    -- Listas conhecidas: quando presentes, precisam continuar arrays.
    foreach v_key in array array[
      'practical_next_steps',
      'professional_review_notes',
      'safety_flags'
    ] loop
      if new.final_response_json ? v_key
         and jsonb_typeof(new.final_response_json -> v_key) not in ('array', 'null') then
        raise exception 'monthly guidance final_response_json.% must be an array or null', v_key;
      end if;
    end loop;
  end if;

  if new.status = 'answered' then
    -- A carta estruturada é canônica. Mantemos response sincronizado apenas
    -- para compatibilidade com leitores históricos que ainda usam texto puro.
    if new.final_response_json is not null then
      v_primary_text := nullif(btrim(coalesce(new.final_response_json ->> 'gentle_guidance', '')), '');
      if v_primary_text is null then
        v_primary_text := nullif(btrim(coalesce(new.final_response_json ->> 'final_message_draft', '')), '');
      end if;
      if v_primary_text is not null then
        new.response := v_primary_text;
      end if;
    end if;

    -- Nunca persista answered sem nenhuma resposta utilizável.
    if new.final_response_json is null
       and nullif(btrim(coalesce(new.response, '')), '') is null then
      raise exception 'answered monthly guidance requires final_response_json or response';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_guidance_final_response on public.monthly_guidance_requests;
create trigger trg_normalize_guidance_final_response
before insert or update of status, response, ai_draft_json, final_response_json
on public.monthly_guidance_requests
for each row
execute function public.normalize_monthly_guidance_final_response();

-- O usuário pode criar somente o PEDIDO. Campos produzidos pela IA/Admin não
-- atravessam a política de INSERT do cliente. A policy administrativa existente
-- continua permitindo a revisão com AAL2 via is_admin().
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

comment on function public.normalize_monthly_guidance_final_response() is
  'Valida final_response_json, promove fallback estruturado ao finalizar e mantém response somente como espelho legado da Orientação Mensal.';

commit;
