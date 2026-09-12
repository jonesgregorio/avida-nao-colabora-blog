-- ============================================================================
-- Migration 060: Schema + questionários oficiais do MVP + RLS 3 planos + progresso parcial
-- (§16.1/§16.4) — SELF-SUFICIENTE e idempotente (roda em banco limpo).
-- ============================================================================

begin;

-- 0) Garante o schema da tabela questionnaires (colunas usadas pelo seed/app).
alter table questionnaires add column if not exists slug                        text;
alter table questionnaires add column if not exists scheduled_at                timestamptz;
alter table questionnaires add column if not exists type                        text    default 'wellbeing';
alter table questionnaires add column if not exists status                      text    default 'draft';
alter table questionnaires add column if not exists estimated_time              text;
alter table questionnaires add column if not exists question_count              integer default 0;
alter table questionnaires add column if not exists show_on_questionnaires_page boolean default true;
alter table questionnaires add column if not exists show_score                  boolean default false;
alter table questionnaires add column if not exists show_result                 boolean default true;
alter table questionnaires add column if not exists allow_anonymous             boolean default true;
alter table questionnaires add column if not exists allow_retake                boolean default true;
alter table questionnaires add column if not exists intro_text                  text;
alter table questionnaires add column if not exists completion_text             text;
alter table questionnaires add column if not exists active                      boolean default true;
alter table questionnaires add column if not exists tags                        jsonb   default '[]'::jsonb;
alter table questionnaires add column if not exists questions                   jsonb   default '[]'::jsonb;
alter table questionnaires add column if not exists results                     jsonb   default '[]'::jsonb;

create unique index if not exists idx_questionnaires_slug on questionnaires(slug) where slug is not null;

-- Normaliza plan_required legado e corrige a constraint para free/essential/plus.
update questionnaires set plan_required = 'plus'  where plan_required in ('therapeutic','therapeutic-plus','therapeutic_plus','premium');
update questionnaires set plan_required = 'free'  where plan_required is null;
alter table questionnaires drop constraint if exists questionnaires_plan_required_check;
alter table questionnaires add  constraint questionnaires_plan_required_check check (plan_required in ('free','essential','plus'));

-- 1) Progresso parcial (§12.5): respostas parciais + passo atual + updated_at.
alter table questionnaire_responses add column if not exists answers      jsonb       not null default '{}'::jsonb;
alter table questionnaire_responses add column if not exists current_step  integer     not null default 0;
alter table questionnaire_responses add column if not exists updated_at    timestamptz not null default now();

-- 2) Normaliza planos legados no banco (nunca expor therapeutic ao usuário).
update profiles set plan = 'plus' where plan in ('therapeutic','therapeutic-plus','therapeutic_plus','premium');

-- 3) RLS de leitura por plano em questionnaires (substitui a lógica antiga da 036).
drop policy if exists "Questionários públicos visíveis"            on questionnaires;
drop policy if exists "questionnaires_public_select"               on questionnaires;
drop policy if exists "public_read_questionnaires"                 on questionnaires;
drop policy if exists "any_read_free_questionnaires"              on questionnaires;
drop policy if exists "auth_read_essential_questionnaires"        on questionnaires;
drop policy if exists "auth_read_therapeutic_questionnaires"      on questionnaires;
drop policy if exists "auth_read_therapeutic_plus_questionnaires" on questionnaires;
drop policy if exists "q_read_free"      on questionnaires;
drop policy if exists "q_read_essential" on questionnaires;
drop policy if exists "q_read_plus"      on questionnaires;

create policy "q_read_free" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and coalesce(plan_required,'free') = 'free'
  );
create policy "q_read_essential" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and plan_required = 'essential'
    and (is_admin() or exists (select 1 from profiles p where p.user_id = auth.uid() and p.plan in ('essential','plus','therapeutic','therapeutic-plus')))
  );
create policy "q_read_plus" on questionnaires
  for select using (
    (status = 'published' or coalesce(active,false) = true)
    and plan_required = 'plus'
    and (is_admin() or exists (select 1 from profiles p where p.user_id = auth.uid() and p.plan in ('plus','therapeutic','therapeutic-plus')))
  );

-- 4) Semeia os 8 questionários oficiais (question type "single_choice").
-- Só os 8 oficiais devem aparecer na página de Questionários.
update questionnaires set show_on_questionnaires_page = false
where show_on_questionnaires_page = true;

-- Regrava do zero as 8 versões oficiais.
delete from questionnaires where slug in (
  'bem-estar-inicial','compulsao-fome-emocional','ansiedade-sobrecarga',
  'sono-energia-rotina','autoestima-autocobranca','mapa-mensal-autocuidado',
  'gatilhos-emocionais-padroes','revisao-de-jornada'
);

insert into questionnaires
  (title, slug, description, category, type, plan_required, estimated_time,
   status, show_on_questionnaires_page, show_score, show_result,
   allow_anonymous, allow_retake, intro_text, completion_text,
   question_count, tags, questions, results)
values
-- ─────────────────────────────────────────────────────────────────────────
-- 1) GRATUITO — Questionário inicial de bem-estar emocional (§9.1)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Questionário inicial de bem-estar emocional', 'bem-estar-inicial',
 'Um mapa rápido de como você está chegando: humor, cansaço, ansiedade, sono e vontade de se cuidar.',
 'Inicial', 'wellbeing', 'free', '6',
 'published', true, false, true, false, true,
 'Responda com calma. Não existe certo ou errado — existe você, do seu jeito.',
 'Que bom que você reservou esse tempo para se ouvir. Um passo de cada vez já é cuidado.',
 8, to_jsonb(array['inicial','bem-estar']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Como está o seu humor na maior parte dos dias?","options":[
     {"id":"o1","text":"Bem, na maioria dos dias","score":0},
     {"id":"o2","text":"Oscila bastante","score":1},
     {"id":"o3","text":"Mais para baixo","score":2},
     {"id":"o4","text":"Difícil quase todos os dias","score":3}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Com que frequência você sente um cansaço que o descanso não resolve?","options":[
     {"id":"o1","text":"Raramente","score":0},
     {"id":"o2","text":"Às vezes","score":1},
     {"id":"o3","text":"Com frequência","score":2},
     {"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q3","type":"single_choice","required":true,"text":"Como anda a ansiedade percebida no seu dia?","options":[
     {"id":"o1","text":"Tranquila","score":0},
     {"id":"o2","text":"Presente em alguns momentos","score":1},
     {"id":"o3","text":"Presente boa parte do dia","score":2},
     {"id":"o4","text":"Difícil de controlar","score":3}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Você tem sentido sobrecarga?","options":[
     {"id":"o1","text":"Não","score":0},
     {"id":"o2","text":"Um pouco","score":1},
     {"id":"o3","text":"Bastante","score":2},
     {"id":"o4","text":"No limite","score":3}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Você percebe que come para aliviar emoções (ansiedade, tédio, tristeza)?","options":[
     {"id":"o1","text":"Raramente","score":0},
     {"id":"o2","text":"Às vezes","score":1},
     {"id":"o3","text":"Com frequência","score":2},
     {"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Como está o seu sono?","options":[
     {"id":"o1","text":"Bom e reparador","score":0},
     {"id":"o2","text":"Irregular","score":1},
     {"id":"o3","text":"Durmo mal com frequência","score":2},
     {"id":"o4","text":"Acordo com exaustão","score":3}]},
   {"id":"q7","type":"single_choice","required":true,"text":"Você sente alguma dor ou limitação física que pesa no seu dia?","options":[
     {"id":"o1","text":"Não","score":0},
     {"id":"o2","text":"Leve","score":1},
     {"id":"o3","text":"Moderada","score":2},
     {"id":"o4","text":"Intensa","score":3}]},
   {"id":"q8","type":"single_choice","required":true,"text":"Qual é a sua vontade de se cuidar neste momento?","options":[
     {"id":"o1","text":"Bem presente","score":0},
     {"id":"o2","text":"Existe, mas falta energia","score":1},
     {"id":"o3","text":"Pouca","score":2},
     {"id":"o4","text":"Quase nenhuma agora","score":3}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":8,"label":"Um bom momento para se fortalecer","color":"#1A4A3A",
    "description":"Seu momento parece pedir mais acolhimento, organização emocional e pequenas pausas.",
    "recommendation":"Que tal registrar como você está no diário, ver um conteúdo gratuito ou fazer uma prática guiada?"},
   {"id":"r2","min_score":9,"max_score":24,"label":"Alguns sinais de sobrecarga","color":"#c05f3c",
    "description":"Suas respostas mostram alguns sinais de sobrecarga no dia a dia. Pequenos registros podem ajudar você a perceber padrões com mais clareza.",
    "recommendation":"Comece com um registro no diário e uma prática guiada. No Essencial, o diário é ilimitado e você acompanha sua evolução."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 2) ESSENCIAL — Compulsão e Fome Emocional (§9.2.1)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Compulsão e Fome Emocional', 'compulsao-fome-emocional',
 'Perceba os gatilhos emocionais ligados à comida, sem culpa e sem diagnóstico.',
 'Fome emocional', 'wellbeing', 'essential', '9',
 'published', true, false, true, false, true,
 'Responda pensando nas últimas semanas. O objetivo é entender, não julgar.',
 'Reconhecer padrões já é um passo de cuidado. Seja gentil com você.',
 6, to_jsonb(array['fome-emocional','compulsao']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Você come por ansiedade?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Você come por tristeza?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q3","type":"single_choice","required":true,"text":"Você come por tédio?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Depois de comer, você sente culpa?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Você sente que perde o controle ao comer?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Em quais momentos você se sente mais vulnerável à comida?","options":[
     {"id":"o1","text":"Manhã","score":1,"tag":"manha"},{"id":"o2","text":"Tarde","score":1,"tag":"tarde"},{"id":"o3","text":"Noite","score":2,"tag":"noite"},{"id":"o4","text":"Madrugada","score":2,"tag":"madrugada"}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":8,"label":"Relação mais tranquila com a comida","color":"#1A4A3A",
    "description":"Sua relação com a comida parece mais equilibrada neste momento.",
    "recommendation":"Continue registrando episódios no diário e explore os conteúdos guiados sobre pausa e autocompaixão."},
   {"id":"r2","min_score":9,"max_score":18,"label":"A fome emocional aparece em momentos de alívio","color":"#c05f3c",
    "description":"Sua fome emocional parece aparecer mais em momentos de sobrecarga e busca por alívio.",
    "recommendation":"Registre o episódio no diário, veja um conteúdo guiado, experimente uma prática de pausa antes de comer e acompanhe no mapa emocional."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 3) ESSENCIAL — Ansiedade e Sobrecarga (§9.2.2)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Ansiedade e Sobrecarga', 'ansiedade-sobrecarga',
 'Mapeie sinais percebidos de ansiedade e sobrecarga no seu dia a dia.',
 'Ansiedade e sobrecarga', 'wellbeing', 'essential', '8',
 'published', true, false, true, false, true,
 'Pense nos últimos dias. Responda no seu ritmo.',
 'Perceber os sinais é o começo de cuidar deles. Um passo de cada vez.',
 7, to_jsonb(array['ansiedade','sobrecarga']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Você tem pensamentos acelerados?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Você sente tensão no corpo?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q3","type":"single_choice","required":true,"text":"Você tem dificuldade de relaxar?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Você sente uma sensação de urgência constante?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Você tem sentido irritação?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Você se cobra em excesso?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q7","type":"single_choice","required":true,"text":"Você tem dificuldade de descansar sem culpa?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":9,"label":"Sinais leves neste momento","color":"#1A4A3A",
    "description":"Seus sinais de sobrecarga parecem mais leves agora. Continuar se observando ajuda a manter o equilíbrio.",
    "recommendation":"Faça um check-in diário e experimente uma prática de respiração quando precisar."},
   {"id":"r2","min_score":10,"max_score":21,"label":"Sinais de sobrecarga mais presentes","color":"#c05f3c",
    "description":"Seus sinais de sobrecarga parecem estar mais presentes nos últimos dias.",
    "recommendation":"Faça check-ins diários, veja uma prática de respiração e um conteúdo guiado, e acompanhe no mapa emocional."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 4) ESSENCIAL — Sono, Energia e Rotina (§9.2.3)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Sono, Energia e Rotina', 'sono-energia-rotina',
 'Perceba a relação entre o seu sono, a sua energia e a sua rotina.',
 'Sono e rotina', 'wellbeing', 'essential', '7',
 'published', true, false, true, false, true,
 'Pense na sua última semana. Não existe resposta certa.',
 'Pequenos ajustes na rotina podem mudar como você se sente. Comece leve.',
 6, to_jsonb(array['sono','energia','rotina']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Como está a qualidade do seu sono?","options":[
     {"id":"o1","text":"Boa","score":0},{"id":"o2","text":"Irregular","score":1},{"id":"o3","text":"Ruim","score":2},{"id":"o4","text":"Muito ruim","score":3}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Você acorda com cansaço?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q3","type":"single_choice","required":true,"text":"Como está sua energia ao longo do dia?","options":[
     {"id":"o1","text":"Estável","score":0},{"id":"o2","text":"Cai à tarde","score":1},{"id":"o3","text":"Baixa boa parte do dia","score":2},{"id":"o4","text":"Quase sempre no chão","score":3}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Sua rotina está irregular?","options":[
     {"id":"o1","text":"Não","score":0},{"id":"o2","text":"Um pouco","score":1},{"id":"o3","text":"Bastante","score":2},{"id":"o4","text":"Totalmente","score":3}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Você usa telas até tarde da noite?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase toda noite","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Você tem dificuldade de desacelerar antes de dormir?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":8,"label":"Rotina relativamente equilibrada","color":"#1A4A3A",
    "description":"Sua rotina parece dar algum suporte ao seu descanso. Vale manter o que funciona.",
    "recommendation":"Registre seu sono no diário e experimente uma prática noturna curta."},
   {"id":"r2","min_score":9,"max_score":18,"label":"A rotina pode estar pesando no descanso","color":"#c05f3c",
    "description":"Sua rotina pode estar impactando sua energia e sua sensação de descanso.",
    "recommendation":"Registre seu sono no diário, veja uma prática noturna e acompanhe o histórico no mapa emocional."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 5) ESSENCIAL — Autoestima e Autocobrança (§9.2.4)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Autoestima e Autocobrança', 'autoestima-autocobranca',
 'Perceba sua relação com você: autocrítica, comparação, culpa e reconhecimento.',
 'Autoestima', 'wellbeing', 'essential', '8',
 'published', true, false, true, false, true,
 'Responda com honestidade e gentileza consigo. Aqui existe espaço para você.',
 'Enxergar a própria cobrança já abre espaço para mais leveza. Você merece cuidado.',
 6, to_jsonb(array['autoestima','autocobranca']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Você se critica com frequência?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Você se compara aos outros?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q3","type":"single_choice","required":true,"text":"Você sente vergonha de como está?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Você tem dificuldade de reconhecer seus avanços?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Você sente culpa ao descansar?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Você sente que nunca é suficiente?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":8,"label":"Relação mais gentil consigo","color":"#1A4A3A",
    "description":"Você parece conseguir ser gentil consigo em boa parte do tempo. Isso é uma base valiosa.",
    "recommendation":"Registre no diário pequenos avanços e experimente uma prática de autocompaixão."},
   {"id":"r2","min_score":9,"max_score":18,"label":"A autocobrança ocupa bastante espaço","color":"#c05f3c",
    "description":"Sua autocobrança parece ocupar muito espaço. Pequenos registros de cuidado podem ajudar você a enxergar progresso.",
    "recommendation":"Escreva no diário, veja um conteúdo guiado e faça uma prática de autocompaixão."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 6) PLUS — Mapa Mensal de Autocuidado (§9.3.1)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Mapa Mensal de Autocuidado', 'mapa-mensal-autocuidado',
 'Gera insumos para o seu plano de autocuidado mensal, o relatório e a orientação por mensagem.',
 'Autocuidado Plus', 'wellbeing', 'plus', '11',
 'published', true, false, true, false, true,
 'Reserve um tempo tranquilo. Suas respostas ajudam a compor o seu acompanhamento Plus.',
 'Que bom que você compartilhou. Isso vai ajudar a montar seu plano de autocuidado do mês.',
 6, to_jsonb(array['autocuidado','plus','mensal']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"Qual foi a maior dificuldade do seu mês?","options":[
     {"id":"o1","text":"Ansiedade","score":1,"tag":"ansiedade"},{"id":"o2","text":"Cansaço","score":1,"tag":"cansaco"},{"id":"o3","text":"Sobrecarga","score":1,"tag":"sobrecarga"},{"id":"o4","text":"Autocobrança","score":1,"tag":"autocobranca"}]},
   {"id":"q2","type":"single_choice","required":true,"text":"Qual emoção apareceu com mais frequência?","options":[
     {"id":"o1","text":"Ansiedade","score":1,"tag":"ansiedade"},{"id":"o2","text":"Tristeza","score":1,"tag":"tristeza"},{"id":"o3","text":"Irritação","score":1,"tag":"irritacao"},{"id":"o4","text":"Cansaço","score":1,"tag":"cansaco"}]},
   {"id":"q3","type":"single_choice","required":true,"text":"O que mais funcionou como gatilho difícil?","options":[
     {"id":"o1","text":"Trabalho","score":1,"tag":"trabalho"},{"id":"o2","text":"Relações","score":1,"tag":"relacoes"},{"id":"o3","text":"Rotina/sono","score":1,"tag":"rotina"},{"id":"o4","text":"Cobrança interna","score":1,"tag":"cobranca"}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Que hábito te ajudou neste mês?","options":[
     {"id":"o1","text":"Registrar no diário","score":0,"tag":"diario"},{"id":"o2","text":"Pausas/respiração","score":0,"tag":"pausas"},{"id":"o3","text":"Movimento/corpo","score":0,"tag":"corpo"},{"id":"o4","text":"Ainda estou buscando","score":1,"tag":"buscando"}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Qual área da sua vida foi mais afetada?","options":[
     {"id":"o1","text":"Trabalho/estudos","score":1,"tag":"trabalho"},{"id":"o2","text":"Relações","score":1,"tag":"relacoes"},{"id":"o3","text":"Saúde/corpo","score":1,"tag":"saude"},{"id":"o4","text":"Autoestima","score":1,"tag":"autoestima"}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Que tipo de apoio você gostaria de receber este mês?","options":[
     {"id":"o1","text":"Organização da rotina","score":0,"tag":"rotina"},{"id":"o2","text":"Lidar com ansiedade","score":0,"tag":"ansiedade"},{"id":"o3","text":"Autocompaixão","score":0,"tag":"autocompaixao"},{"id":"o4","text":"Constância no autocuidado","score":0,"tag":"constancia"}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":20,"label":"Seu mapa do mês está pronto","color":"#1A4A3A",
    "description":"Que bom que você compartilhou. Suas respostas vão compor o seu plano de autocuidado mensal.",
    "recommendation":"Abra seu Plano de Autocuidado, acompanhe no relatório mensal e leve suas prioridades para a orientação por mensagem."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 7) PLUS — Gatilhos Emocionais e Padrões (§9.3.2)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Gatilhos Emocionais e Padrões', 'gatilhos-emocionais-padroes',
 'Ajuda a identificar padrões emocionais que se repetem ao longo do tempo.',
 'Autocuidado Plus', 'wellbeing', 'plus', '10',
 'published', true, false, true, false, true,
 'Pense no seu último mês. Não há certo ou errado — só o que é seu.',
 'Reconhecer padrões abre caminho para escolhas mais gentis. Continue se observando.',
 6, to_jsonb(array['gatilhos','padroes','plus']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"O que mais dispara sua ansiedade?","options":[
     {"id":"o1","text":"Cobrança/prazos","score":1,"tag":"cobranca"},{"id":"o2","text":"Conflitos","score":1,"tag":"conflitos"},{"id":"o3","text":"Incerteza","score":1,"tag":"incerteza"},{"id":"o4","text":"Excesso de tarefas","score":1,"tag":"tarefas"}]},
   {"id":"q2","type":"single_choice","required":true,"text":"O que costuma disparar sua fome emocional?","options":[
     {"id":"o1","text":"Estresse","score":1,"tag":"estresse"},{"id":"o2","text":"Tédio","score":1,"tag":"tedio"},{"id":"o3","text":"Tristeza","score":1,"tag":"tristeza"},{"id":"o4","text":"Cansaço","score":1,"tag":"cansaco"}]},
   {"id":"q3","type":"single_choice","required":true,"text":"O que te leva ao isolamento?","options":[
     {"id":"o1","text":"Vergonha","score":1,"tag":"vergonha"},{"id":"o2","text":"Cansaço","score":1,"tag":"cansaco"},{"id":"o3","text":"Sensação de rejeição","score":1,"tag":"rejeicao"},{"id":"o4","text":"Sobrecarga","score":1,"tag":"sobrecarga"}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Onde os conflitos pesam mais?","options":[
     {"id":"o1","text":"Família","score":1,"tag":"familia"},{"id":"o2","text":"Trabalho","score":1,"tag":"trabalho"},{"id":"o3","text":"Relacionamento","score":1,"tag":"relacionamento"},{"id":"o4","text":"Comigo","score":1,"tag":"eu"}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Com que frequência a necessidade de aprovação te move?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]},
   {"id":"q6","type":"single_choice","required":true,"text":"O cansaço físico influencia suas reações?","options":[
     {"id":"o1","text":"Raramente","score":0},{"id":"o2","text":"Às vezes","score":1},{"id":"o3","text":"Com frequência","score":2},{"id":"o4","text":"Quase sempre","score":3}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":20,"label":"Padrões que se repetem","color":"#1A4A3A",
    "description":"Alguns gatilhos parecem se repetir em momentos de cobrança, cansaço e necessidade de aprovação.",
    "recommendation":"Leve esses padrões para o seu diário e para a orientação por mensagem, e acompanhe no relatório mensal."}
 ]'::jsonb
),
-- ─────────────────────────────────────────────────────────────────────────
-- 8) PLUS — Revisão de Jornada (§9.3.3)
-- ─────────────────────────────────────────────────────────────────────────
(
 'Revisão de Jornada', 'revisao-de-jornada',
 'Um momento para refletir sobre evolução, dificuldades e próximos passos.',
 'Autocuidado Plus', 'wellbeing', 'plus', '10',
 'published', true, false, true, false, true,
 'Olhe para o seu percurso com gentileza. Todo passo conta.',
 'Revisar a própria jornada é um ato de cuidado. Que bom seguir com você.',
 6, to_jsonb(array['revisao','jornada','plus']),
 '[
   {"id":"q1","type":"single_choice","required":true,"text":"O que melhorou desde que você começou a se acompanhar?","options":[
     {"id":"o1","text":"Autoconhecimento","score":0,"tag":"autoconhecimento"},{"id":"o2","text":"Rotina","score":0,"tag":"rotina"},{"id":"o3","text":"Emoções","score":0,"tag":"emocoes"},{"id":"o4","text":"Ainda é cedo para dizer","score":1,"tag":"cedo"}]},
   {"id":"q2","type":"single_choice","required":true,"text":"O que continua difícil?","options":[
     {"id":"o1","text":"Ansiedade","score":1,"tag":"ansiedade"},{"id":"o2","text":"Constância","score":1,"tag":"constancia"},{"id":"o3","text":"Autocobrança","score":1,"tag":"autocobranca"},{"id":"o4","text":"Sono/energia","score":1,"tag":"sono"}]},
   {"id":"q3","type":"single_choice","required":true,"text":"O que você aprendeu sobre si?","options":[
     {"id":"o1","text":"Meus limites","score":0,"tag":"limites"},{"id":"o2","text":"Meus gatilhos","score":0,"tag":"gatilhos"},{"id":"o3","text":"O que me faz bem","score":0,"tag":"bem"},{"id":"o4","text":"Ainda estou descobrindo","score":1,"tag":"descobrindo"}]},
   {"id":"q4","type":"single_choice","required":true,"text":"Qual prática funcionou melhor para você?","options":[
     {"id":"o1","text":"Diário","score":0,"tag":"diario"},{"id":"o2","text":"Respiração/pausas","score":0,"tag":"pausas"},{"id":"o3","text":"Conteúdos guiados","score":0,"tag":"conteudos"},{"id":"o4","text":"Ainda buscando","score":1,"tag":"buscando"}]},
   {"id":"q5","type":"single_choice","required":true,"text":"Que meta faz sentido para o próximo mês?","options":[
     {"id":"o1","text":"Mais constância","score":0,"tag":"constancia"},{"id":"o2","text":"Menos autocobrança","score":0,"tag":"autocobranca"},{"id":"o3","text":"Melhorar o sono","score":0,"tag":"sono"},{"id":"o4","text":"Cuidar das relações","score":0,"tag":"relacoes"}]},
   {"id":"q6","type":"single_choice","required":true,"text":"Que tipo de apoio você precisa agora?","options":[
     {"id":"o1","text":"Orientação por mensagem","score":0,"tag":"orientacao"},{"id":"o2","text":"Plano de autocuidado","score":0,"tag":"plano"},{"id":"o3","text":"Acompanhar minha evolução","score":0,"tag":"evolucao"},{"id":"o4","text":"Só continuar registrando","score":0,"tag":"registrar"}]}
 ]'::jsonb,
 '[
   {"id":"r1","min_score":0,"max_score":20,"label":"Sua jornada, revisada","color":"#1A4A3A",
    "description":"Que bom que você olhou para o seu percurso. Isso ajuda a definir os próximos passos com mais clareza.",
    "recommendation":"Suas respostas alimentam o relatório mensal aprofundado, o plano de autocuidado e a orientação por mensagem."}
 ]'::jsonb
);

commit;
