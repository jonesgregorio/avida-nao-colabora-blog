-- ============================================================================
-- Migration 061: Runtime schema dos questionários + índices + RLS limpa (§10.2/§10.4)
--  - Garante todas as colunas usadas pelo QuestionnairePlayer em questionnaire_responses
--  - Índices por user_id / questionnaire_id / status
--  - Remove policies antigas/genéricas de leitura em questionnaires e recria só as oficiais
--    (free / essential / plus / admin), normalizando legados therapeutic -> plus
--  Idempotente e seguro para reaplicar.
-- ============================================================================

begin;

-- 1) Colunas de runtime em questionnaire_responses (todas usadas pelo player).
alter table questionnaire_responses add column if not exists status         text        default 'in_progress';
alter table questionnaire_responses add column if not exists started_at      timestamptz;
alter table questionnaire_responses add column if not exists completed_at    timestamptz;
alter table questionnaire_responses add column if not exists total_score     integer     default 0;
alter table questionnaire_responses add column if not exists generated_tags  text;
alter table questionnaire_responses add column if not exists result_id       text;
alter table questionnaire_responses add column if not exists current_step    integer     default 0;
alter table questionnaire_responses add column if not exists answers         jsonb       default '{}'::jsonb;
alter table questionnaire_responses add column if not exists updated_at       timestamptz default now();

-- 2) Índices de consulta do player.
create index if not exists idx_qresp_user     on questionnaire_responses(user_id);
create index if not exists idx_qresp_quest    on questionnaire_responses(questionnaire_id);
create index if not exists idx_qresp_status   on questionnaire_responses(status);
create index if not exists idx_qresp_user_q   on questionnaire_responses(user_id, questionnaire_id);

-- 3) Remove QUALQUER policy antiga/genérica de leitura em questionnaires (§10.4).
drop policy if exists "Questionários públicos visíveis"           on questionnaires;
drop policy if exists "questionnaires_public_select"               on questionnaires;
drop policy if exists "public_read_questionnaires"                 on questionnaires;
drop policy if exists "any_read_free_questionnaires"              on questionnaires;
drop policy if exists "auth_read_essential_questionnaires"        on questionnaires;
drop policy if exists "auth_read_therapeutic_questionnaires"      on questionnaires;
drop policy if exists "auth_read_therapeutic_plus_questionnaires" on questionnaires;
drop policy if exists "Admin gerencia questionários"              on questionnaires;
drop policy if exists "q_read_free"      on questionnaires;
drop policy if exists "q_read_essential" on questionnaires;
drop policy if exists "q_read_plus"      on questionnaires;
drop policy if exists "q_admin_all"      on questionnaires;

-- 4) Recria SOMENTE as policies oficiais (free / essential / plus / admin).
create policy "q_read_free" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and coalesce(plan_required,'free') = 'free'
  );

create policy "q_read_essential" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and plan_required = 'essential'
    and (
      is_admin()
      or exists (
        select 1 from profiles p
        where p.user_id = auth.uid()
          and p.plan in ('essential','plus','therapeutic','therapeutic-plus')
      )
    )
  );

create policy "q_read_plus" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and plan_required = 'plus'
    and (
      is_admin()
      or exists (
        select 1 from profiles p
        where p.user_id = auth.uid()
          and p.plan in ('plus','therapeutic','therapeutic-plus')
      )
    )
  );

-- admin gerencia tudo (leitura + escrita)
create policy "q_admin_all" on questionnaires
  for all using (is_admin()) with check (is_admin());

commit;
