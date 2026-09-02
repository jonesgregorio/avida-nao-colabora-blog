import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wrapper = readFileSync(new URL('../src/components/MyReportPage.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../src/components/MyReportPageContent.tsx', import.meta.url), 'utf8')

test('22.5 apresenta a retrospectiva narrativa antes dos detalhes', () => {
  assert.match(wrapper, /Sua semana/)
  assert.match(wrapper, /Seu mês/)
  assert.match(wrapper, /O que mais pesou/)
  assert.match(wrapper, /O que ajudou/)
  assert.match(wrapper, /Algo mudou/)
  assert.match(wrapper, /Uma coisa para levar daqui/)
  assert.match(wrapper, /Explorar detalhes/)
})

test('22.5 preserva o painel completo atrás do aprofundamento voluntário', () => {
  assert.match(wrapper, /showDetails/)
  assert.match(wrapper, /setShowDetails\(true\)/)
  assert.match(wrapper, /<MyReportPageContent \{\.\.\.props\} \/>/)
  assert.match(wrapper, /Gráficos, métricas, PDF, histórico e dados completos continuam disponíveis/)
  assert.match(detail, /Exportar PDF/)
  assert.match(detail, /EnergyAnxietyPanel/)
  assert.match(detail, /Histórico de relatórios/)
})

test('retrospectiva usa somente o relatório fechado e não relê texto livre do Diário', () => {
  assert.match(wrapper, /from\('reports'\)/)
  assert.match(wrapper, /select\('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content'\)/)
  assert.doesNotMatch(wrapper, /from\('diary_entries'\)/)
  assert.doesNotMatch(wrapper, /free_note|recurring_thoughts|entry_text|diary_text/i)
})

test('22.5 mantém a navegação histórica existente e evita gamificação', () => {
  assert.match(wrapper, /HISTORY_HEADING = 'Histórico de relatórios'/)
  assert.match(wrapper, /startsWith\('Ver todos'\)/)
  assert.match(wrapper, /history\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
  assert.doesNotMatch(wrapper, /\bXP\b|ranking|streak|pontos conquistados|aria-valuenow/i)
  assert.match(wrapper, /não é diagnóstico/)
  assert.match(wrapper, /não transforma seus registros em metas de desempenho/)
})
