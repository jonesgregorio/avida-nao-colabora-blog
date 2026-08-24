-- ==========================================================================
-- Go-live: exige narrativa principal na Orientação Mensal finalizada
--
-- final_response_json é canônico quando presente. Uma carta estruturada vazia
-- (ou apenas com metadados) não pode marcar o pedido como answered. Fluxos
-- legados sem final_response_json continuam aceitos quando response tem texto.
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
  -- Compatibilidade: promova o fallback estruturado somente quando ele contém
  -- uma narrativa principal realmente utilizável.
  if new.status = 'answered'
     and new.final_response_json is null
     and jsonb_typeof(coalesce(new.ai_draft_json, '{}'::jsonb) -> 'final_response') = 'object'
     and (
       nullif(btrim(coalesce(new.ai_draft_json -> 'final_response' ->> 'gentle_guidance', '')), '') is not null
       or nullif(btrim(coalesce(new.ai_draft_json -> 'final_response' ->> 'final_message_draft', '')), '') is not null
     ) then
    new.final_response_json := new.ai_draft_json -> 'final_response';
  end if;

  v_primary_text := null;

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

    v_primary_text := nullif(btrim(coalesce(new.final_response_json ->> 'gentle_guidance', '')), '');
    if v_primary_text is null then
      v_primary_text := nullif(btrim(coalesce(new.final_response_json ->> 'final_message_draft', '')), '');
    end if;
  end if;

  if new.status = 'answered' then
    if new.final_response_json is not null then
      -- A coluna estruturada é canônica: não aceite uma carta sem narrativa
      -- principal e mantenha response apenas como espelho legado.
      if v_primary_text is null then
        raise exception 'answered monthly guidance final_response_json requires gentle_guidance or final_message_draft';
      end if;
      new.response := v_primary_text;
    elsif nullif(btrim(coalesce(new.response, '')), '') is null then
      -- Compatibilidade para registros/fluxos antigos que ainda finalizam só
      -- com response, sem a coluna estruturada.
      raise exception 'answered monthly guidance requires final_response_json or response';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.normalize_monthly_guidance_final_response() is
  'Valida final_response_json e exige narrativa principal em Orientações Mensais estruturadas finalizadas, preservando response apenas como fallback/espelho legado.';

commit;
