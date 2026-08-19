import { Component, type ErrorInfo, type ReactNode } from 'react'

interface SentryEventLike {
  user?: unknown
  request?: {
    url?: string
    data?: unknown
    cookies?: unknown
    headers?: unknown
    query_string?: unknown
    [key: string]: unknown
  }
  breadcrumbs?: Array<{
    category?: string
    data?: Record<string, unknown>
    message?: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

interface SentryGlobalLike {
  captureException?: (error: unknown, context?: Record<string, unknown>) => unknown
  setUser?: (user: unknown) => void
  setTag?: (key: string, value: string) => void
  addEventProcessor?: (processor: (event: SentryEventLike) => SentryEventLike) => void
  getGlobalScope?: () => {
    addEventProcessor?: (processor: (event: SentryEventLike) => SentryEventLike) => void
  }
}

declare global {
  interface Window {
    Sentry?: SentryGlobalLike
  }
}

const SCRIPT_ID = 'avnc-sentry-loader'
const pendingErrors: Array<{ error: unknown; context?: Record<string, unknown> }> = []
let privacyProcessorInstalled = false

function readLoaderUrl() {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_SENTRY_LOADER_URL?.trim() ?? ''
}

export function isAllowedSentryLoaderUrl(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.hostname === 'js.sentry-cdn.com' &&
      /^\/[A-Za-z0-9_-]+\.min\.js$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}

function stripQueryAndHash(value?: string) {
  if (!value) return value
  try {
    const url = new URL(value, window.location.origin)
    return `${url.origin}${url.pathname}`
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

export function sanitizeSentryEvent(event: SentryEventLike) {
  delete event.user

  if (event.request) {
    event.request.url = stripQueryAndHash(event.request.url)
    delete event.request.data
    delete event.request.cookies
    delete event.request.headers
    delete event.request.query_string
  }

  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .filter((breadcrumb) => breadcrumb.category !== 'console')
      .map((breadcrumb) => {
        if (!breadcrumb.data) return breadcrumb
        const safeData: Record<string, unknown> = {}
        const urlValue = breadcrumb.data.url
        if (typeof urlValue === 'string') safeData.url = stripQueryAndHash(urlValue)
        if (typeof breadcrumb.data.method === 'string') safeData.method = breadcrumb.data.method
        if (typeof breadcrumb.data.status_code === 'number') safeData.status_code = breadcrumb.data.status_code
        return { ...breadcrumb, data: safeData }
      })
  }

  return event
}

function configurePrivacy() {
  const sentry = window.Sentry
  if (!sentry || privacyProcessorInstalled) return

  sentry.setUser?.(null)
  sentry.setTag?.('app', 'avida-nao-colabora')
  sentry.setTag?.('runtime', 'browser')

  const processor = (event: SentryEventLike) => sanitizeSentryEvent(event)
  if (sentry.addEventProcessor) {
    sentry.addEventProcessor(processor)
    privacyProcessorInstalled = true
  } else {
    const scope = sentry.getGlobalScope?.()
    if (scope?.addEventProcessor) {
      scope.addEventProcessor(processor)
      privacyProcessorInstalled = true
    }
  }

  while (pendingErrors.length > 0) {
    const pending = pendingErrors.shift()
    if (pending) sentry.captureException?.(pending.error, pending.context)
  }
}

export function initExternalMonitoring() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false

  const loaderUrl = readLoaderUrl()
  if (!loaderUrl) return false
  if (!isAllowedSentryLoaderUrl(loaderUrl)) return false

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
  if (existing) {
    if (window.Sentry) configurePrivacy()
    return true
  }

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.src = loaderUrl
  script.async = true
  script.crossOrigin = 'anonymous'
  script.referrerPolicy = 'no-referrer'
  script.addEventListener('load', configurePrivacy, { once: true })
  document.head.appendChild(script)
  return true
}

export function captureExternalException(error: unknown, context?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (window.Sentry?.captureException) {
    window.Sentry.captureException(error, context)
    return
  }

  if (pendingErrors.length < 5) pendingErrors.push({ error, context })
}

interface MonitoringErrorBoundaryProps {
  children: ReactNode
}

interface MonitoringErrorBoundaryState {
  hasError: boolean
}

export class MonitoringErrorBoundary extends Component<MonitoringErrorBoundaryProps, MonitoringErrorBoundaryState> {
  state: MonitoringErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MonitoringErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureExternalException(error, {
      contexts: {
        react: {
          componentStack: info.componentStack,
        },
      },
    })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="min-h-screen bg-paper flex items-center justify-center px-4">
        <section className="max-w-md w-full bg-white border border-line rounded-3xl p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl text-forest-900">Algo não carregou como deveria</h1>
          <p className="mt-3 text-sm text-ink-soft leading-relaxed">
            O problema foi isolado para proteger o restante da sua navegação. Tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 px-5 py-3 rounded-2xl bg-forest-900 text-white text-sm font-medium hover:bg-forest-800"
          >
            Recarregar página
          </button>
        </section>
      </main>
    )
  }
}
