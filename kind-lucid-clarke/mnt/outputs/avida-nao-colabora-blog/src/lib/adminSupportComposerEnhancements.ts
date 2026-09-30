import { supabase } from './supabase'

type SupportTemplate = {
  id: string
  title: string
  category: string
  body: string
}

const PREVIEW_CLASS = 'avnc-support-template-preview'
const PREVIEW_LIMIT = 220
let initialized = false
let templatesPromise: Promise<SupportTemplate[]> | null = null
let scheduled = false

function isSupportComposerTextarea(el: Element): el is HTMLTextAreaElement {
  if (!(el instanceof HTMLTextAreaElement)) return false
  const placeholder = el.getAttribute('placeholder') ?? ''
  return placeholder.startsWith('Digite sua resposta') || placeholder.startsWith('Escreva uma nota interna')
}

function enhanceComposerHeight() {
  const compact = window.matchMedia('(max-width: 640px)').matches
  const minHeight = compact ? '190px' : '230px'
  const maxHeight = compact ? '44vh' : '48vh'

  document.querySelectorAll('.admin-shell textarea').forEach(el => {
    if (!isSupportComposerTextarea(el)) return
    el.style.setProperty('min-height', minHeight, 'important')
    el.style.setProperty('max-height', maxHeight, 'important')
    el.style.setProperty('resize', 'vertical', 'important')
    el.style.setProperty('overflow-y', 'auto')
    el.style.setProperty('line-height', '1.55')
  })
}

function cleanPreviewBody(body: string): string {
  return body
    .replace(/\{\{preco_essential\}\}/gi, 'valor atual do Essencial')
    .replace(/\{\{preco_plus\}\}/gi, 'valor atual do Plus')
    .replace(/\s+/g, ' ')
    .trim()
}

function previewText(body: string): string {
  const clean = cleanPreviewBody(body)
  if (clean.length <= PREVIEW_LIMIT) return clean
  return `${clean.slice(0, PREVIEW_LIMIT).trimEnd()}…`
}

async function fetchTemplates(): Promise<SupportTemplate[]> {
  try {
    const { data } = await supabase
      .from('support_reply_templates')
      .select('id,title,category,body')
      .eq('is_active', true)
      .in('usage_context', ['support', 'both'])
    return (data ?? []) as SupportTemplate[]
  } catch {
    return []
  }
}

function loadTemplates(): Promise<SupportTemplate[]> {
  const existing = templatesPromise
  if (existing) return existing
  const pending = fetchTemplates()
  templatesPromise = pending
  return pending
}

function looksLikeTemplateListButton(button: HTMLButtonElement): boolean {
  const paragraphs = button.querySelectorAll(':scope > p')
  return paragraphs.length >= 2
}

async function enhanceTemplateList() {
  const admin = document.querySelector('.admin-shell')
  if (!admin) return

  const buttons = Array.from(admin.querySelectorAll('button')).filter(
    (button): button is HTMLButtonElement => button instanceof HTMLButtonElement && looksLikeTemplateListButton(button),
  )
  if (buttons.length === 0) return

  const templates = await loadTemplates()
  if (templates.length === 0) return
  const byTitle = new Map(templates.map(template => [template.title.trim(), template]))

  for (const button of buttons) {
    if (button.querySelector(`.${PREVIEW_CLASS}`)) continue
    const title = button.querySelector(':scope > p')?.textContent?.trim() ?? ''
    const template = byTitle.get(title)
    if (!template) continue

    const preview = document.createElement('p')
    preview.className = `${PREVIEW_CLASS} mt-1.5 text-[11px] leading-relaxed text-stone-500 line-clamp-3`
    preview.textContent = previewText(template.body)
    preview.setAttribute('aria-label', `Prévia: ${previewText(template.body)}`)
    button.appendChild(preview)
    button.title = cleanPreviewBody(template.body)
    button.setAttribute('aria-label', `${template.title}. ${template.category}. Prévia: ${previewText(template.body)}`)

    const list = button.parentElement
    if (list) list.style.setProperty('max-height', '390px', 'important')
  }
}

function runEnhancements() {
  scheduled = false
  enhanceComposerHeight()
  void enhanceTemplateList()
}

function scheduleEnhancements() {
  if (scheduled) return
  scheduled = true
  window.requestAnimationFrame(runEnhancements)
}

export function initAdminSupportComposerEnhancements() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || initialized) return
  initialized = true

  const observer = new MutationObserver(scheduleEnhancements)
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true })
    scheduleEnhancements()
  }

  if (document.body) start()
  else window.addEventListener('DOMContentLoaded', start, { once: true })

  window.addEventListener('resize', scheduleEnhancements)
}
