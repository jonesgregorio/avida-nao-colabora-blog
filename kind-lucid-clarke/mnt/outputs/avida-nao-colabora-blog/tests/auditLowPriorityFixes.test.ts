import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test("'questionarios-evolucao' é uma view válida (evita fallback silencioso para home em deep link)", () => {
  const nav = read('src/lib/navigation.ts')
  assert.match(nav, /'questionarios-evolucao'/)
})

test('salvar modelo de IA no Admin gera trilha de auditoria', () => {
  const src = read('src/components/admin/AdminAIConfig.tsx')
  assert.match(src, /import \{ logAdminAction \} from '\.\.\/\.\.\/lib\/adminAudit'/)
  assert.match(src, /logAdminAction\('config', 'ai_models', null,/)
})

test('excluir notificação manual gera trilha de auditoria', () => {
  const src = read('src/components/admin/AdminNotifications.tsx')
  assert.match(src, /logAdminAction\('delete', 'notification', id, null\)/)
})

test('buildReport não carrega mais um parâmetro de plano sem uso', () => {
  const src = read('src/lib/reportGeneration.ts')
  assert.match(src, /export function buildReport\(\s*type: ReportType, period: Period,/)
})

test('buildAndQueue não recebe mais eventId sem uso (relatedIds continua chegando)', () => {
  const src = read('src/lib/personalizationTasks.ts')
  assert.match(src, /const buildAndQueue = \(periodKey: string, eventDate\?: Date, relatedIds\?: Record<string, string>\) => \{/)
  assert.match(src, /buildAndQueue\(`guidance-\$\{g\.id\}`, new Date\(g\.created_at\), \{ guidance_id: g\.id \}\)/)
  assert.match(src, /buildAndQueue\(`report-\$\{r\.id\}`, new Date\(r\.created_at\), \{ report_id: r\.id \}\)/)
})

test('AdminScheduled.tsx não duplica mais o mapa de cores de status', () => {
  const src = read('src/components/admin/AdminScheduled.tsx')
  assert.doesNotMatch(src, /_STATUS_COLORS/)
  assert.match(src, /const STATUS_COLORS: Record<string, string> = \{/)
})
