const STORAGE_KEY = 'avnc-admin-operational-alerts-read-v1'
const SNAPSHOT_KEY = 'avnc-admin-operational-alerts-snapshot-v1'
const READ_CLASS = 'avnc-admin-alert-read'
const STATUS_CLASS = 'avnc-admin-alert-read-status'
const MARK_ALL_CLASS = 'avnc-admin-alert-mark-all'

const DESTINATION_TABS: Record<string, string[]> = {
  'Tickets de suporte abertos': ['Suporte'],
  'Tickets parados há +7 dias': ['Suporte'],
  'Orientações aguardando resposta': ['Orientações'],
  'Relatórios aguardando revisão': ['Relatórios'],
  'Planos de autocuidado pendentes': ['Plano de Autocuidado', 'Autocuidado'],
  'Personalizações vencidas': ['Recomendações', 'Personalização'],
  'Cancelamentos a revisar': ['Cancelamentos'],
  'Campanhas em rascunho': ['Campanhas'],
  'Falhas ativas de IA': ['IA', 'Uso de IA'],
  'Falhas ativas de e-mail': ['Histórico', 'E-mails'],
  'Relatórios com falha': ['Relatórios'],
  'Planos de autocuidado com falha': ['Plano de Autocuidado', 'Autocuidado'],
  'Jobs de conteúdo com falha': ['Automações'],
  'Webhooks Stripe travados': ['Financeiro'],
  'Webhooks Stripe com falha': ['Financeiro'],
}

type SnapshotItem = { label: string; count: number; signature: string }

let initialized = false
let scheduled = false
let lastSnapshot: SnapshotItem[] = []

function safeReadSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function safeWriteSet(values: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...values].slice(-250))) } catch { /* noop */ }
}

function safeReadSnapshot(): SnapshotItem[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(item => item && typeof item.label === 'string' && Number.isFinite(item.count) && typeof item.signature === 'string')
  } catch {
    return []
  }
}

function safeWriteSnapshot(items: SnapshotItem[]) {
  try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(items)) } catch { /* noop */ }
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function signature(label: string, count: number) {
  return `${label}::${count}`
}

function findAlertsPanel(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll('p')).find(el => normalizeText(el.textContent) === 'Central de alertas')
  return heading?.closest('.absolute') as HTMLElement | null
}

function findAlertRows(panel: HTMLElement): HTMLButtonElement[] {
  return Array.from(panel.querySelectorAll('button')).filter(button => {
    if (normalizeText(button.textContent) === 'Atualizar') return false
    if (button.classList.contains(MARK_ALL_CLASS)) return false
    return Object.keys(DESTINATION_TABS).some(label => normalizeText(button.textContent).includes(label))
  })
}

function rowData(button: HTMLButtonElement): SnapshotItem | null {
  const text = normalizeText(button.textContent)
  const label = Object.keys(DESTINATION_TABS).find(candidate => text.includes(candidate))
  if (!label) return null
  const numeric = Array.from(button.querySelectorAll('span'))
    .map(el => normalizeText(el.textContent))
    .find(value => /^\d+$/.test(value))
  const count = Number(numeric ?? 0)
  if (!Number.isFinite(count) || count <= 0) return null
  return { label, count, signature: signature(label, count) }
}

function findButtonByText(labels: string[]): HTMLButtonElement | null {
  const candidates = Array.from(document.querySelectorAll('.admin-shell button')) as HTMLButtonElement[]
  for (const label of labels) {
    const exact = candidates.find(button => normalizeText(button.textContent) === label)
    if (exact) return exact
  }
  for (const label of labels) {
    const partial = candidates.find(button => normalizeText(button.textContent).includes(label))
    if (partial) return partial
  }
  return null
}

function openRelatedDestination(label: string) {
  const tabs = DESTINATION_TABS[label] ?? []
  if (tabs.length === 0) return
  // O clique React da própria linha navega para a área. Estes passos seguintes
  // garantem a sub-aba correta inclusive quando o admin já estava na mesma área.
  window.setTimeout(() => {
    const tab = findButtonByText(tabs)
    if (tab) tab.click()
  }, 140)
  window.setTimeout(() => {
    const tab = findButtonByText(tabs)
    if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click()
  }, 460)
}

function markRowVisual(button: HTMLButtonElement, isRead: boolean) {
  button.classList.toggle(READ_CLASS, isRead)
  button.style.opacity = isRead ? '0.62' : '1'
  button.style.backgroundColor = isRead ? '#faf8f4' : ''
  button.dataset.alertRead = isRead ? 'true' : 'false'

  let status = button.querySelector(`.${STATUS_CLASS}`) as HTMLSpanElement | null
  if (!status) {
    status = document.createElement('span')
    status.className = `${STATUS_CLASS} ml-1 text-[10px] font-medium whitespace-nowrap`
    const countEl = Array.from(button.querySelectorAll('span')).find(el => /^\d+$/.test(normalizeText(el.textContent)))
    if (countEl?.parentElement === button) button.insertBefore(status, countEl)
    else button.appendChild(status)
  }
  status.textContent = isRead ? 'Lido' : 'Novo'
  status.classList.toggle('text-stone-400', isRead)
  status.classList.toggle('text-red-600', !isRead)
  button.title = isRead ? 'Lido — clique para abrir o destino relacionado' : 'Não lido — clique para abrir e marcar como lido'
}

function currentUnreadCount(snapshot: SnapshotItem[], read: Set<string>) {
  return snapshot.reduce((total, item) => total + (read.has(item.signature) ? 0 : item.count), 0)
}

function applyBellCount(snapshot: SnapshotItem[], read: Set<string>) {
  const bell = document.querySelector('button[aria-label="Alertas administrativos"]') as HTMLButtonElement | null
  if (!bell || snapshot.length === 0) return
  const currentTotal = snapshot.reduce((sum, item) => sum + item.count, 0)
  const existingBadge = Array.from(bell.querySelectorAll('span')).find(el => /^\d+\+?$/.test(normalizeText(el.textContent))) as HTMLSpanElement | undefined
  const existingText = normalizeText(existingBadge?.textContent)
  const reactTotal = existingText === '99+' ? currentTotal : Number(existingText || 0)

  // Se o total vindo do React mudou, preserva a novidade até a central ser aberta
  // e o snapshot atual ficar conhecido.
  if (!findAlertsPanel() && existingBadge && reactTotal !== currentTotal) return

  const unread = currentUnreadCount(snapshot, read)
  if (unread <= 0) {
    existingBadge?.remove()
    bell.dataset.unreadOperationalAlerts = '0'
    return
  }
  if (existingBadge) existingBadge.textContent = unread > 99 ? '99+' : String(unread)
  bell.dataset.unreadOperationalAlerts = String(unread)
}

function markAll(panel: HTMLElement, rows: HTMLButtonElement[]) {
  const read = safeReadSet()
  for (const row of rows) {
    const data = rowData(row)
    if (data) read.add(data.signature)
  }
  safeWriteSet(read)
  rows.forEach(row => markRowVisual(row, true))
  applyBellCount(lastSnapshot, read)
  const button = panel.querySelector(`.${MARK_ALL_CLASS}`) as HTMLButtonElement | null
  if (button) button.disabled = true
}

function ensureMarkAllButton(panel: HTMLElement, rows: HTMLButtonElement[]) {
  const header = panel.querySelector('.border-b') as HTMLElement | null
  if (!header) return
  let button = panel.querySelector(`.${MARK_ALL_CLASS}`) as HTMLButtonElement | null
  if (!button) {
    button = document.createElement('button')
    button.type = 'button'
    button.className = `${MARK_ALL_CLASS} text-[11px] text-stone-500 hover:text-forest-900 whitespace-nowrap`
    button.textContent = 'Marcar todos como lidos'
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      markAll(panel, findAlertRows(panel))
    })
    const refresh = Array.from(header.querySelectorAll('button')).find(el => normalizeText(el.textContent) === 'Atualizar')
    if (refresh) refresh.insertAdjacentElement('beforebegin', button)
    else header.appendChild(button)
  }
  const read = safeReadSet()
  button.disabled = rows.every(row => {
    const data = rowData(row)
    return Boolean(data && read.has(data.signature))
  })
  button.style.opacity = button.disabled ? '0.45' : '1'
}

function enhancePanel(panel: HTMLElement) {
  const rows = findAlertRows(panel)
  if (rows.length === 0) return
  const read = safeReadSet()
  const snapshot = rows.map(rowData).filter((item): item is SnapshotItem => Boolean(item))
  lastSnapshot = snapshot
  safeWriteSnapshot(snapshot)

  for (const row of rows) {
    const data = rowData(row)
    if (!data) continue
    markRowVisual(row, read.has(data.signature))
    if (row.dataset.alertReadListener !== 'true') {
      row.dataset.alertReadListener = 'true'
      row.addEventListener('click', () => {
        const latest = rowData(row)
        if (!latest) return
        const nextRead = safeReadSet()
        nextRead.add(latest.signature)
        safeWriteSet(nextRead)
        markRowVisual(row, true)
        applyBellCount(lastSnapshot, nextRead)
        openRelatedDestination(latest.label)
      }, { capture: true })
    }
  }

  ensureMarkAllButton(panel, rows)
  applyBellCount(snapshot, read)
}

function run() {
  scheduled = false
  const panel = findAlertsPanel()
  if (panel) enhancePanel(panel)
  else {
    const saved = lastSnapshot.length ? lastSnapshot : safeReadSnapshot()
    if (saved.length) applyBellCount(saved, safeReadSet())
  }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(run)
}

export function initAdminOperationalAlertUX() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || initialized) return
  initialized = true
  lastSnapshot = safeReadSnapshot()

  const observer = new MutationObserver(schedule)
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    schedule()
  }
  if (document.body) start()
  else window.addEventListener('DOMContentLoaded', start, { once: true })
}
