-- ============================================================================
-- Modelo de IA configurável pelo Admin
-- ----------------------------------------------------------------------------
-- Hoje o modelo do Gemini/Groq é o default do código (gemini-3.6-flash /
-- openai/gpt-oss-120b) ou o secret GEMINI_MODEL/GROQ_MODEL do Supabase. Quando
-- o Google aposenta um modelo (ex.: gemini-2.5-flash → HTTP 404), só um deploy
-- resolve.
--
-- Esta migration adiciona um override no banco (ai_settings.gemini_model /
-- groq_model). Se preenchido, as Edge Functions passam a usá-lo; senão, seguem
-- o secret/default. O front (Central de IA) edita via RPC admin_set_ai_models.
--
-- ADITIVO. Linha única id=1 (já existe desde a migration 048).
-- ============================================================================

alter table public.ai_settings add column if not exists gemini_model text;
alter table public.ai_settings add column if not exists groq_model text;

-- modelos que já foram aposentados / são inadequados como default estável.
-- O override não pode reativá-los — a Edge Function também protege, mas cortar
-- aqui dá erro imediato pro admin em vez de uma geração silenciosamente quebrada.
create or replace function public.admin_set_ai_models(p_gemini text, p_groq text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gemini text := nullif(btrim(coalesce(p_gemini, '')), '');
  v_groq   text := nullif(btrim(coalesce(p_groq, '')), '');
  v_legacy text[] := array['gemini-flash-latest','gemini-1.5-flash','gemini-2.0-flash','gemini-2.0-flash-001','gemini-2.5-flash'];
begin
  if not public.is_admin() then
    raise exception 'Acesso negado: apenas administradores.';
  end if;
  if v_gemini is not null and (v_gemini = any(v_legacy)) then
    raise exception 'Modelo Gemini aposentado: %. Use um modelo atual (ex.: gemini-3.6-flash).', v_gemini;
  end if;
  if v_gemini is not null and v_gemini !~ '^[a-zA-Z0-9._/-]{3,80}$' then
    raise exception 'Nome de modelo Gemini inválido.';
  end if;
  if v_groq is not null and v_groq !~ '^[a-zA-Z0-9._/-]{3,80}$' then
    raise exception 'Nome de modelo Groq inválido.';
  end if;

  insert into public.ai_settings (id, gemini_model, groq_model, updated_at)
  values (1, v_gemini, v_groq, now())
  on conflict (id) do update
    set gemini_model = excluded.gemini_model,
        groq_model   = excluded.groq_model,
        updated_at   = now();

  return jsonb_build_object('success', true, 'gemini_model', v_gemini, 'groq_model', v_groq);
end;
$$;

grant execute on function public.admin_set_ai_models(text, text) to authenticated;
