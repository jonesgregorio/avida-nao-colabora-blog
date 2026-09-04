import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// A tabela plan_features já em produção tinha feature_name desatualizado
// (semeado antes da renomeação em officialPlans.ts). Como o Admin lê o nome
// do banco quando existe, sem essa migration o site voltaria a mostrar texto
// antigo — o oposto do pedido do usuário. Migration nova, idempotente,
// preserva qualquer nome já customizado por um admin.

const migration = readFileSync(
  new URL('../supabase/migrations/20260905000000_sync_plan_feature_names_with_site.sql', import.meta.url),
  'utf8',
)

test('migration corrige os 12 nomes desatualizados em plan_features, condicionada ao valor antigo exato', () => {
  const pairs: Array<[string, string, string]> = [
    ['articles_free', 'Blog aberto', 'Artigos e conteúdos'],
    ['wellbeing_diary_5_month', 'Diário emocional básico', 'Diário emocional'],
    ['basic_self_assessment', 'Questionário inicial', 'Questionários de autoconhecimento'],
    ['biweekly_auto_challenges', 'Algumas práticas guiadas', 'Conteúdos Guiados'],
    ['diary_unlimited', 'Diário ilimitado', 'Diário emocional'],
    ['diary_mood_symptoms_summary', 'Mapa emocional completo', 'Mapa Emocional'],
    ['full_history', 'Histórico e gráficos', 'Minha História'],
    ['emotional_exercise_library', 'Conteúdos guiados completos', 'Conteúdos Guiados'],
    ['weekly_assessments', 'Relatório semanal automático', 'Relatório Semanal'],
    ['personalized_self_care_plan', 'Plano de autocuidado mensal', 'Plano de Autocuidado Mensal'],
    ['advanced_monthly_report', 'Relatório mensal aprofundado', 'Relatório Mensal Aprofundado'],
    ['monthly_message_guidance', 'Orientação mensal por mensagem', 'Orientação Mensal'],
  ]
  for (const [key, oldName, newName] of pairs) {
    assert.match(
      migration,
      new RegExp(`feature_name = '${newName}'[\\s\\S]*?where feature_key = '${key}' and feature_name = '${oldName}'`),
      `migration não corrige "${key}" de "${oldName}" para "${newName}"`,
    )
  }
})

test('migration não usa UPDATE sem WHERE (nunca sobrescreve nome já customizado pelo admin)', () => {
  const updates = migration.match(/update public\.plan_features[\s\S]*?;/g) ?? []
  assert.equal(updates.length, 12)
  for (const stmt of updates) {
    assert.match(stmt, /where feature_key = '[a-z0-9_]+' and feature_name = '[^']+'/)
  }
})
