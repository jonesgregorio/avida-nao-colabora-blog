import { useState, type ReactNode } from 'react'
import { LayoutDashboard, Radar, FileText, Filter, Repeat } from 'lucide-react'
import AdminRetentionAnalytics from './AdminRetentionAnalytics'
import AdminJourneyFunnel from './AdminJourneyFunnel'
import AdminConversionFunnel from './AdminConversionFunnel'
import AnalyticsPageLegacy from './AnalyticsPageLegacy'

interface AnalyticsPageProps {
  onEditArticle?: (id: string) => void
}

// Analytics em 5 áreas. Cada área é uma composição pequena e nomeada
// (AnalyticsOverview/Acquisition/Content/Conversion/Retention). Só a área
// ativa é montada — nenhuma consulta de área inativa é disparada.
//
// O que saiu da UI do Analytics (código morto removido em set/2026):
//   • "Eventos brutos" e "Relatórios IA" — removidos (dados intactos no banco);
//   • "SEO" — vive em Conteúdo → Inteligência → SEO;
//   • "Redirecionamentos" (301/404) — Conteúdo → Inteligência → Redirecionamentos;
//   • "Configurações" (rastreamento/retenção/privacidade) — Sistema →
//     Configurações → Analytics.
const AREAS = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'aquisicao', label: 'Aquisição', icon: Radar },
  { id: 'conteudo', label: 'Conteúdo', icon: FileText },
  { id: 'conversao', label: 'Conversão', icon: Filter },
  { id: 'retencao', label: 'Retenção', icon: Repeat },
] as const
type Area = typeof AREAS[number]['id']

// Cada array lista as abas do AnalyticsPageLegacy que aquela área reaproveita.
const ONLY_OVERVIEW = ['overview'] as const
const ONLY_ACQUISITION = ['devices', 'growth'] as const
const ONLY_CONTENT = ['pages', 'heatmap', 'performance', 'errors'] as const
const ONLY_CONVERSION = ['funnel'] as const
const ONLY_RETENTION = ['journey'] as const

const STORE = 'admin-analytics-area'
const Card = ({ children, pad }: { children: ReactNode; pad?: boolean }) => (
  <section className={`admin-card overflow-hidden ${pad ? 'p-5 md:p-6' : ''}`}>{children}</section>
)

function AnalyticsOverview(props: AnalyticsPageProps) {
  return <Card><AnalyticsPageLegacy {...props} only={ONLY_OVERVIEW} hideHero /></Card>
}
function AnalyticsAcquisition(props: AnalyticsPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card><AnalyticsPageLegacy {...props} only={ONLY_ACQUISITION} hideHero /></Card>
      <Card pad><AdminJourneyFunnel /></Card>
    </div>
  )
}
function AnalyticsContent(props: AnalyticsPageProps) {
  return <Card><AnalyticsPageLegacy {...props} only={ONLY_CONTENT} hideHero /></Card>
}
function AnalyticsConversion(props: AnalyticsPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card pad><AdminConversionFunnel /></Card>
      <Card><AnalyticsPageLegacy {...props} only={ONLY_CONVERSION} hideHero /></Card>
    </div>
  )
}
function AnalyticsRetention(props: AnalyticsPageProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card pad><AdminRetentionAnalytics /></Card>
      <Card><AnalyticsPageLegacy {...props} only={ONLY_RETENTION} hideHero /></Card>
    </div>
  )
}

export default function AnalyticsPage(props: AnalyticsPageProps) {
  const [area, setArea] = useState<Area>(() => {
    try {
      const saved = localStorage.getItem(STORE) as Area | null
      if (saved && AREAS.some(a => a.id === saved)) return saved
    } catch { /* noop */ }
    return 'visao-geral'
  })

  function switchArea(id: Area) {
    setArea(id)
    try { localStorage.setItem(STORE, id) } catch { /* noop */ }
  }

  return (
    <div className="admin-page-pad max-w-[1600px] mx-auto w-full flex flex-col min-h-0 gap-4">
      <section className="admin-page-hero flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="admin-kicker">Análise</p>
          <h1 className="font-serif text-3xl text-forest-900">Analytics</h1>
          <p className="admin-subtitle mt-1">Aquisição, conteúdo, conversão e retenção em uma visão executiva única, sem abas duplicadas.</p>
        </div>
      </section>

      <div className="admin-tabs-wrap">
        <nav className="admin-tabs" aria-label="Áreas do Analytics">
          {AREAS.map(a => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={area === a.id}
                onClick={() => switchArea(a.id)}
                className={`admin-tab ${area === a.id ? 'is-active' : ''}`}
              >
                <Icon className="w-4 h-4" />
                {a.label}
              </button>
            )
          })}
        </nav>
      </div>

      {area === 'visao-geral' && <AnalyticsOverview {...props} />}
      {area === 'aquisicao' && <AnalyticsAcquisition {...props} />}
      {area === 'conteudo' && <AnalyticsContent {...props} />}
      {area === 'conversao' && <AnalyticsConversion {...props} />}
      {area === 'retencao' && <AnalyticsRetention {...props} />}
    </div>
  )
}
