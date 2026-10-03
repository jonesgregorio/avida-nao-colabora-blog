import { supabase } from './supabase'
import { ensureRuntimeGardenThemes } from './gardenRuntimeThemes'
import { resolveGardenTheme } from './gardenThemes'

const GLOBAL_SEEN_CYCLE_PREFIX = 'avnc:garden:globalSeenCycle:'
const LAST_GARDEN_KEY_PREFIX = 'avnc:garden:lastIndex:'
const LAST_GARDEN_SLUG_KEY_PREFIX = 'avnc:garden:lastSlug:'
const LAST_GARDEN_CYCLE_KEY_PREFIX = 'avnc:garden:lastCycle:'
const SCROLL_MEMORIES_FLAG = 'avnc:garden:scrollMemories'
const MODAL_ID = 'avnc-global-garden-completion'
const CHECK_INTERVAL_MS = 20_000

type GardenState = {
  garden_index?: number
  garden_slug?: string | null
  garden_cycle?: number
}

let initialized = false
let currentUserId: string | null = null
let intervalId: number | null = null
let checking = false

function readNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw == null) return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function writeNumber(key: string, value: number) {
  try { window.localStorage.setItem(key, String(value)) } catch { /* armazenamento indisponível */ }
}

function closeModal() {
  document.getElementById(MODAL_ID)?.remove()
}

function scheduleMemoriesScroll() {
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    const section = Array.from(document.querySelectorAll('section')).find((node) =>
      node.textContent?.includes('Memórias do Jardim'),
    ) as HTMLElement | undefined
    if (section) {
      window.clearInterval(timer)
      try { window.sessionStorage.removeItem(SCROLL_MEMORIES_FLAG) } catch { /* noop */ }
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else if (attempts >= 40) {
      window.clearInterval(timer)
    }
  }, 200)
}

function navigateToGarden(scrollToMemories: boolean) {
  closeModal()
  if (scrollToMemories) {
    try { window.sessionStorage.setItem(SCROLL_MEMORIES_FLAG, '1') } catch { /* noop */ }
  }
  if (window.location.pathname === '/meu-jardim') {
    if (scrollToMemories) scheduleMemoriesScroll()
    else window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.location.assign('/meu-jardim')
}

function ensureModalStyles() {
  if (document.getElementById('avnc-global-garden-completion-styles')) return
  const style = document.createElement('style')
  style.id = 'avnc-global-garden-completion-styles'
  style.textContent = `
    @keyframes avncGardenBackdropIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes avncGardenCardIn { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: translateY(0) scale(1) } }
    @keyframes avncGardenLeaf { 0% { opacity: 0; transform: translate(-18px,8px) rotate(-8deg) } 20% { opacity: .85 } 100% { opacity: 0; transform: translate(180px,-24px) rotate(20deg) } }
    #${MODAL_ID} { animation: avncGardenBackdropIn .28s ease-out both; }
    #${MODAL_ID} .avnc-garden-card { animation: avncGardenCardIn .45s cubic-bezier(.16,1,.3,1) both; }
    #${MODAL_ID} .avnc-garden-leaf { animation: avncGardenLeaf 2.6s ease-in-out .8s 1 both; }
    @media (prefers-reduced-motion: reduce) {
      #${MODAL_ID}, #${MODAL_ID} .avnc-garden-card, #${MODAL_ID} .avnc-garden-leaf { animation: none !important; }
    }
  `
  document.head.appendChild(style)
}

function showCompletion(theme: ReturnType<typeof resolveGardenTheme>) {
  if (document.getElementById(MODAL_ID)) return
  ensureModalStyles()

  const backdrop = document.createElement('div')
  backdrop.id = MODAL_ID
  backdrop.setAttribute('role', 'dialog')
  backdrop.setAttribute('aria-modal', 'true')
  backdrop.setAttribute('aria-label', 'Jardim concluído')
  backdrop.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4'

  const card = document.createElement('div')
  card.className = 'avnc-garden-card relative w-full max-w-[560px] overflow-hidden rounded-[32px] shadow-[0_40px_120px_rgba(10,20,15,.45)]'

  const image = document.createElement('img')
  image.src = theme.stages[theme.stages.length - 1]
  image.alt = ''
  image.setAttribute('aria-hidden', 'true')
  image.className = 'absolute inset-0 h-full w-full object-cover'

  const overlay = document.createElement('div')
  overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25'

  const close = document.createElement('button')
  close.type = 'button'
  close.setAttribute('aria-label', 'Fechar')
  close.className = 'absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/35 text-xl leading-none text-white/90 backdrop-blur-sm transition hover:bg-black/50'
  close.textContent = '×'
  close.addEventListener('click', closeModal)

  const content = document.createElement('div')
  content.className = 'relative z-[1] flex flex-col items-center px-6 py-10 text-center text-white sm:px-12 sm:py-16'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'text-[10px] font-semibold uppercase tracking-[.24em] text-white/70 sm:text-[11px]'
  eyebrow.textContent = 'Jardim concluído'

  const title = document.createElement('h2')
  title.className = 'mt-3 font-serif text-2xl leading-tight sm:text-[30px]'
  title.textContent = 'Seu jardim floresceu por completo.'

  const body = document.createElement('p')
  body.className = 'mt-4 max-w-md text-sm leading-6 text-white/85'
  body.textContent = 'Os pequenos momentos de cuidado que você registrou ao longo do caminho transformaram este espaço.'

  const continuation = document.createElement('p')
  continuation.className = 'mt-3 max-w-md text-sm leading-6 text-white/85'
  continuation.textContent = 'Este jardim agora fica guardado na sua história — e um novo começa a crescer no seu ritmo.'

  const warmth = document.createElement('p')
  warmth.className = 'mt-4 font-serif text-lg text-[#ffe08c]'
  warmth.textContent = 'Que bom ter você por aqui. 🌿'

  const actions = document.createElement('div')
  actions.className = 'mt-7 flex w-full flex-col gap-2 sm:w-auto sm:flex-row'

  const history = document.createElement('button')
  history.type = 'button'
  history.className = 'rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-forest-900 shadow-lg transition hover:bg-white/90'
  history.textContent = 'Ver meu jardim concluído'
  history.addEventListener('click', () => navigateToGarden(true))

  const next = document.createElement('button')
  next.type = 'button'
  next.className = 'rounded-2xl border border-white/35 bg-black/20 px-5 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-black/30'
  next.textContent = 'Conhecer o novo jardim'
  next.addEventListener('click', () => navigateToGarden(false))

  const leaf = document.createElement('span')
  leaf.className = 'avnc-garden-leaf pointer-events-none absolute left-10 top-1/2 text-lg text-[#dce8cf]'
  leaf.setAttribute('aria-hidden', 'true')
  leaf.textContent = '🌿'

  actions.append(history, next)
  content.append(eyebrow, title, body, continuation, warmth, actions)
  card.append(image, overlay, close, content, leaf)
  backdrop.appendChild(card)
  document.body.appendChild(backdrop)

  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal() })
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeModal()
      window.removeEventListener('keydown', onKey)
    }
  }
  window.addEventListener('keydown', onKey)
  history.focus()
}

async function checkGardenCompletion() {
  if (!currentUserId || checking || document.hidden || window.location.pathname.startsWith('/admin')) return
  checking = true
  try {
    await ensureRuntimeGardenThemes()
    const { data, error } = await supabase.rpc('get_my_garden_state')
    if (error || !data || !currentUserId) return

    const state = data as GardenState
    const currentIndex = Math.max(0, Number(state.garden_index ?? 0))
    const currentCycle = Math.max(0, Number(state.garden_cycle ?? currentIndex))
    const globalKey = GLOBAL_SEEN_CYCLE_PREFIX + currentUserId
    const pageCycleKey = LAST_GARDEN_CYCLE_KEY_PREFIX + currentUserId
    const pageIndexKey = LAST_GARDEN_KEY_PREFIX + currentUserId
    const previousPageCycle = readNumber(pageCycleKey)
    let previousSeen = readNumber(globalKey)

    if (previousSeen == null) {
      previousSeen = previousPageCycle ?? currentCycle
      writeNumber(globalKey, previousSeen)
    }

    if (currentCycle <= previousSeen) return

    // Se a própria página Meu Jardim já celebrou esta virada, apenas sincroniza o observador global.
    if (previousPageCycle != null && previousPageCycle >= currentCycle) {
      writeNumber(globalKey, currentCycle)
      return
    }

    let previousSlug: string | null = null
    try { previousSlug = window.localStorage.getItem(LAST_GARDEN_SLUG_KEY_PREFIX + currentUserId) } catch { /* noop */ }
    const completedTheme = resolveGardenTheme(previousSlug, Math.max(0, currentIndex - 1))

    // Marca antes de abrir o modal para garantir exibição única mesmo se houver nova checagem.
    writeNumber(globalKey, currentCycle)
    writeNumber(pageCycleKey, currentCycle)
    writeNumber(pageIndexKey, currentIndex)
    showCompletion(completedTheme)
  } catch {
    // A celebração nunca deve interromper a navegação normal do site.
  } finally {
    checking = false
  }
}

function startForUser(userId: string | null) {
  currentUserId = userId
  if (intervalId != null) window.clearInterval(intervalId)
  intervalId = null
  if (!userId) return
  void checkGardenCompletion()
  intervalId = window.setInterval(() => { void checkGardenCompletion() }, CHECK_INTERVAL_MS)
}

export function initGlobalGardenCompletion() {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  try {
    if (window.sessionStorage.getItem(SCROLL_MEMORIES_FLAG) === '1') scheduleMemoriesScroll()
  } catch { /* noop */ }

  void supabase.auth.getSession().then(({ data }) => startForUser(data.session?.user.id ?? null))
  supabase.auth.onAuthStateChange((_event, session) => startForUser(session?.user.id ?? null))

  const recheck = () => { void checkGardenCompletion() }
  window.addEventListener('focus', recheck)
  window.addEventListener('popstate', recheck)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck() })
}
