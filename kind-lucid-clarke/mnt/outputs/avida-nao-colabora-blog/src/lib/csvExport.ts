function sanitizeCsvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}

export function exportCsv(filename: string, headers: string[], rows: unknown[][]) {
  if (typeof document === 'undefined') return
  const csv = [headers, ...rows].map(row => row.map(sanitizeCsvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
