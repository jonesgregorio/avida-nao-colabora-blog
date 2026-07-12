-- ============================================================================
-- Migration 082: conserta pendências de personalização "atrasadas" antes da
-- criação da conta.
--
-- Sintoma: em Recomendações IA (Personalização por Plano), um usuário que criou
-- a conta hoje aparecia "Atrasado há 2 dias" — porque o vencimento (due_at) era
-- ancorado ao período do calendário (fim de semana/quinzena/mês), podendo cair
-- ANTES da entrada do usuário.
--
-- O código (personalizationTasks.ts) passou a garantir due_at >= entrada + 3d.
-- Aqui corrigimos as linhas JÁ criadas com vencimento anterior a essa carência:
-- empurra o vencimento para (entrada + 3 dias), preserva a duração até expirar e
-- tira o falso "atrasado".
-- ============================================================================

UPDATE user_personalization_tasks t
SET
  due_at = p.created_at + interval '3 days',
  expires_at = CASE
    WHEN t.expires_at IS NOT NULL AND t.due_at IS NOT NULL
      THEN (p.created_at + interval '3 days') + (t.expires_at - t.due_at)
    ELSE t.expires_at
  END,
  status = CASE WHEN t.status = 'overdue' THEN 'pending' ELSE t.status END,
  updated_at = now()
FROM profiles p
WHERE t.user_id = p.user_id
  AND t.due_at IS NOT NULL
  AND p.created_at IS NOT NULL
  AND t.due_at < p.created_at + interval '3 days'
  AND t.status IN ('pending', 'overdue');
