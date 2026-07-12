-- ============================================================================
-- 072 — Automações de exemplo (ansiedade, sono, autoestima)
-- ============================================================================
-- 3 automações ATIVAS, modo "exige aprovação" (só rascunhos), frequência
-- semanal, cada uma com sua lista de temas + tom. A IA sorteia um tema por
-- geração → variedade. Idempotente por nome (não duplica em re-execução).
-- ============================================================================

INSERT INTO content_automations (name, type, frequency, category, plan_required, mode, status, config)
SELECT 'Ansiedade no dia a dia', 'generate_daily', 'weekly', 'ansiedade', 'free', 'require_approval', 'active',
  jsonb_build_object('tone', 'acolhedor', 'themes', jsonb_build_array(
    'ansiedade antes de dormir',
    'preocupação que não desliga',
    'ansiedade no trabalho',
    'crises de ansiedade e como se acalmar no momento',
    'ansiedade social antes de encontros'
  ))
WHERE NOT EXISTS (SELECT 1 FROM content_automations WHERE name = 'Ansiedade no dia a dia');

INSERT INTO content_automations (name, type, frequency, category, plan_required, mode, status, config)
SELECT 'Sono e descanso', 'generate_daily', 'weekly', 'sono', 'free', 'require_approval', 'active',
  jsonb_build_object('tone', 'simples', 'themes', jsonb_build_array(
    'dificuldade para pegar no sono',
    'acordar cansado mesmo tendo dormido',
    'como criar uma rotina de sono possível',
    'telas e celular antes de dormir',
    'descanso que não é só dormir'
  ))
WHERE NOT EXISTS (SELECT 1 FROM content_automations WHERE name = 'Sono e descanso');

INSERT INTO content_automations (name, type, frequency, category, plan_required, mode, status, config)
SELECT 'Autoestima e autocuidado', 'generate_daily', 'weekly', 'autoestima', 'free', 'require_approval', 'active',
  jsonb_build_object('tone', 'motivacional', 'themes', jsonb_build_array(
    'comparação nas redes sociais',
    'a voz interna crítica e como suavizá-la',
    'dizer não sem culpa',
    'reconhecer pequenas conquistas',
    'cuidar de si sem sentir culpa'
  ))
WHERE NOT EXISTS (SELECT 1 FROM content_automations WHERE name = 'Autoestima e autocuidado');
