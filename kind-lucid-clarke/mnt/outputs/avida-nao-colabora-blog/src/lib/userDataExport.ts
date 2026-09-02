type JsonRecord = Record<string, unknown>

export interface ExportTable {
  section: string
  name: string
  rows: JsonRecord[]
}

const SECTION_LABELS: Record<string, string> = {
  account: 'Conta',
  emotional_journey: 'Jornada emocional',
  content_and_activity: 'Conteúdo e atividade',
  communication: 'Comunicação',
  subscription_and_billing: 'Assinatura e cobrança',
  technical_transparency: 'Transparência técnica',
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try { return JSON.stringify(value) } catch { return String(value) }
}

function csvCell(value: unknown): string {
  const text = normalizeCell(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return `"${text.replace(/"/g, '""')}"`
}

export function rowsToCsv(rows: JsonRecord[]): string {
  if (rows.length === 0) return '\uFEFF'
  const headers = [...new Set(rows.flatMap(row => Object.keys(row)))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const lines = [headers.map(csvCell).join(',')]
  for (const row of rows) lines.push(headers.map(header => csvCell(row[header])).join(','))
  return `\uFEFF${lines.join('\r\n')}`
}

function safeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'dados'
}

function primitiveRow(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value === null || value === undefined || ['string', 'number', 'boolean'].includes(typeof value)),
  )
}

export function collectExportTables(payload: unknown): ExportTable[] {
  if (!isRecord(payload)) return []
  const tables: ExportTable[] = []

  for (const [section, value] of Object.entries(payload)) {
    if (!isRecord(value)) continue

    const summary = primitiveRow(value)
    if (Object.keys(summary).length > 0) tables.push({ section, name: 'resumo', rows: [summary] })

    for (const [name, child] of Object.entries(value)) {
      if (Array.isArray(child)) {
        const rows = child.filter(isRecord)
        if (rows.length > 0) tables.push({ section, name, rows })
      } else if (isRecord(child)) {
        tables.push({ section, name, rows: [child] })
      }
    }
  }

  return tables
}

export function exportSummary(payload: unknown, tables = collectExportTables(payload)) {
  const root = isRecord(payload) ? payload : {}
  const account = isRecord(root.account) ? root.account : {}
  return {
    service: normalizeCell(root.service) || 'A Vida Não Colabora',
    exportedAt: normalizeCell(root.exported_at),
    email: normalizeCell(account.email),
    tableCount: tables.length,
    rowCount: tables.reduce((sum, table) => sum + table.rows.length, 0),
  }
}

function readmeText(payload: unknown, tables: ExportTable[]): string {
  const summary = exportSummary(payload, tables)
  const sectionCounts = new Map<string, number>()
  for (const table of tables) sectionCounts.set(table.section, (sectionCounts.get(table.section) ?? 0) + table.rows.length)
  const sections = [...sectionCounts.entries()]
    .map(([section, count]) => `- ${SECTION_LABELS[section] ?? section}: ${count} registro(s) em formato tabular`)
    .join('\n')

  return [
    'A VIDA NÃO COLABORA — CÓPIA DOS MEUS DADOS',
    '',
    `Exportado em: ${summary.exportedAt || 'data não informada'}`,
    `Conta: ${summary.email || 'e-mail não informado'}`,
    '',
    'Este pacote foi preparado para facilitar a leitura dos mesmos dados da exportação original.',
    '',
    'ARQUIVOS PRINCIPAIS',
    '- dados-completos.json: cópia integral e estruturada da exportação original.',
    '- resumo.pdf: visão geral da exportação e quantidade de registros.',
    '- tabelas/: arquivos CSV separados por área, úteis para abrir em planilhas.',
    '',
    'ÁREAS ENCONTRADAS',
    sections || '- Nenhuma tabela com registros foi encontrada.',
    '',
    'IMPORTANTE',
    'Os CSVs e o PDF são formatos auxiliares para leitura. O JSON continua sendo a cópia completa e deve ser preservado caso você queira manter todos os detalhes e estruturas originais.',
    '',
    'Este pacote pode conter informações pessoais e emocionais. Guarde-o em local seguro.',
  ].join('\n')
}

async function summaryPdf(payload: unknown, tables: ExportTable[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const summary = exportSummary(payload, tables)
  const sectionCounts = new Map<string, number>()
  for (const table of tables) sectionCounts.set(table.section, (sectionCounts.get(table.section) ?? 0) + table.rows.length)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('A Vida Não Colabora', 48, 58)
  pdf.setFontSize(13)
  pdf.text('Resumo da cópia dos meus dados', 48, 82)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  let y = 112
  const lines = [
    `Exportado em: ${summary.exportedAt || '-'}`,
    `Conta: ${summary.email || '-'}`,
    `Arquivos CSV: ${summary.tableCount}`,
    `Registros tabulares: ${summary.rowCount}`,
  ]
  for (const line of lines) { pdf.text(line, 48, y); y += 18 }

  y += 10
  pdf.setFont('helvetica', 'bold')
  pdf.text('Áreas incluídas', 48, y)
  pdf.setFont('helvetica', 'normal')
  y += 20
  for (const [section, count] of sectionCounts) {
    pdf.text(`${SECTION_LABELS[section] ?? section}: ${count} registro(s)`, 58, y)
    y += 17
    if (y > 760) { pdf.addPage(); y = 60 }
  }

  y += 12
  const note = 'O PDF e os CSVs são versões auxiliares para leitura. O arquivo dados-completos.json dentro do mesmo ZIP preserva a exportação integral e estruturada.'
  const wrapped = pdf.splitTextToSize(note, 500) as string[]
  pdf.text(wrapped, 48, y)
  return pdf.output('blob')
}

export async function buildReadableUserDataExport(payload: unknown): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const tables = collectExportTables(payload)

  zip.file('dados-completos.json', JSON.stringify(payload, null, 2))
  zip.file('LEIA-ME.txt', readmeText(payload, tables))

  for (const table of tables) {
    const folder = safeName(SECTION_LABELS[table.section] ?? table.section)
    zip.file(`tabelas/${folder}/${safeName(table.name)}.csv`, rowsToCsv(table.rows))
  }

  const pdf = await summaryPdf(payload, tables)
  zip.file('resumo.pdf', await pdf.arrayBuffer())

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
