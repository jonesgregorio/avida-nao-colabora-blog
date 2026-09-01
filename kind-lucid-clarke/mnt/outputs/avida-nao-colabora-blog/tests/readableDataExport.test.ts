import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { collectExportTables, exportSummary, rowsToCsv } from '../src/lib/userDataExport.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const controls = read('src/components/AccountPrivacyControls.tsx')
const exportLib = read('src/lib/userDataExport.ts')
const backend = read('supabase/functions/export-user-data/index.ts')

test('CSV preserva UTF-8 e escapa vírgula, aspas, quebra de linha e objeto aninhado', () => {
  const csv = rowsToCsv([
    { nome: 'Ana, Maria', nota: 'Disse "oi"\ne voltou', contexto: { sono: 'difícil' }, ativo: true },
  ])

  assert.ok(csv.startsWith('\uFEFF'))
  assert.match(csv, /"Ana, Maria"/)
  assert.match(csv, /"Disse ""oi""\ne voltou"/)
  assert.ok(csv.includes('"{""sono"":""difícil""}"'))
  assert.match(csv, /"true"/)
})

test('exportação legível deriva tabelas dos mesmos grupos do JSON original', () => {
  const payload = {
    service: 'A Vida Não Colabora',
    exported_at: '2026-09-01T00:00:00.000Z',
    account: {
      email: 'pessoa@example.com',
      profile: { display_name: 'Pessoa', plan: 'essential' },
    },
    emotional_journey: {
      diary_entries: [{ id: 'd1', date: '2026-08-31' }, { id: 'd2', date: '2026-09-01' }],
      questionnaire_responses: [{ id: 'q1', status: 'completed' }],
    },
    subscription_and_billing: {
      payment_events: [{ id: 'p1', amount: 1990, currency: 'brl' }],
    },
  }

  const tables = collectExportTables(payload)
  assert.ok(tables.some(table => table.section === 'account' && table.name === 'profile' && table.rows.length === 1))
  assert.ok(tables.some(table => table.section === 'emotional_journey' && table.name === 'diary_entries' && table.rows.length === 2))
  assert.ok(tables.some(table => table.section === 'emotional_journey' && table.name === 'questionnaire_responses' && table.rows.length === 1))
  assert.ok(tables.some(table => table.section === 'subscription_and_billing' && table.name === 'payment_events' && table.rows.length === 1))

  const summary = exportSummary(payload, tables)
  assert.equal(summary.email, 'pessoa@example.com')
  assert.equal(summary.tableCount, tables.length)
  assert.equal(summary.rowCount, tables.reduce((sum, table) => sum + table.rows.length, 0))
})

test('pacote mantém JSON completo e acrescenta formatos auxiliares sem nova coleta', () => {
  assert.match(exportLib, /dados-completos\.json/)
  assert.match(exportLib, /LEIA-ME\.txt/)
  assert.match(exportLib, /resumo\.pdf/)
  assert.match(exportLib, /tabelas\/\$\{folder\}\/\$\{safeName\(table\.name\)\}\.csv/)
  assert.match(exportLib, /await import\('jszip'\)/)
  assert.match(exportLib, /await import\('jspdf'\)/)

  assert.match(controls, /supabase\.functions\.invoke\('export-user-data'/)
  assert.match(controls, /buildReadableUserDataExport\(data\)/)
  assert.match(controls, /a-vida-nao-colabora-meus-dados-\$\{date\}\.zip/)
  assert.match(controls, /JSON completo original/)
  assert.match(controls, /CSVs para planilha e PDF-resumo/)

  // A Edge Function continua entregando o JSON canônico; ZIP/CSV/PDF nascem só no cliente.
  assert.match(backend, /new Response\(JSON\.stringify\(payload\)/)
  assert.doesNotMatch(backend, /jszip|jspdf|\.zip|\.csv/i)
})
