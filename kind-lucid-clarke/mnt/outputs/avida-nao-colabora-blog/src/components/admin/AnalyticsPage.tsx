import { useState } from 'react'
import { LayoutDashboard, Radar, FileText, Filter, Repeat } from 'lucide-react'
import AdminRetentionAnalytics from './AdminRetentionAnalytics'
import AdminJourneyFunnel from './AdminJourneyFunnel'
import AdminConversionFunnel from './AdminConversionFunnel'
import AnalyticsPageLegacy from './AnalyticsPageLegacy'

interface AnalyticsPageProps {
  onEditArticle?: (id: string) => void
}

// Analytics em 5 áreas (Etapa 1 da reorganização). Funil / Jornada / Conversão /
// Retenção deixam de ser abas soltas e duplicadas — cada uma vive na sua área.
// Eventos brutos, SEO, Erros técnicos, Relatórios IA e Configurações saíram da
// interface do Analytics (SEO → Conteúdo, Erros → Sistema, Config → Sistema).
// Nenhuma tabela, view ou evento de analytics foi removido — só a navegação.
const AREAS = [
  { id: 'visao-geral', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'aquisicao', label: 'Aquisição', icon: Radar },
  { id: 'conteudo', label: 'Conteúdo', icon: FileText },
  { id: 'conversao', label: 'Conversão', icon: Filter },
  { id: 'retencao', label: 'Retenção', icon: Repeat },
] as const
type Area = typeof AREAS[number]['id']

const ONLY_OVERVIEW = ['overview'] as const
const ONLY_ACQUISITION = ['devices'] as const
const ONLY_CONTENT = ['pages', 'heatmap', 'performance'] as const
const ONLY_CONVERSION = ['funnel'] as const
const ONLY_RETENTION = ['journey'] as const

const STORE = 'admin-analytics-area'

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

      {area === 'visao-geral' && (
        <section className="admin-card overflow-hidden">
          <AnalyticsPageLegacy {...props} only={ONLY_OVERVIEW} hideHero />
        </section>
      )}

      {area === 'aquisicao' && (
        <div className="flex flex-col gap-4">
          <section className="admin-card overflow-hidden">
            <AnalyticsPageLegacy {...props} only={ONLY_ACQUISITION} hideHero />
          </section>
          <section className="admin-card p-5 md:p-6">
            <AdminJourneyFunnel />
          </section>
        </div>
      )}

      {area === 'conteudo' && (
        <section className="admin-card overflow-hidden">
          <AnalyticsPageLegacy {...props} only={ONLY_CONTENT} hideHero />
        </section>
      )}

      {area === 'conversao' && (
        <div className="flex flex-col gap-4">
          <section className="admin-card p-5 md:p-6">
            <AdminConversionFunnel />
          </section>
          <section className="admin-card overflow-hidden">
            <AnalyticsPageLegacy {...props} only={ONLY_CONVERSION} hideHero />
          </section>
        </div>
      )}

      {area === 'retencao' && (
        <div className="flex flex-col gap-4">
          <section className="admin-card p-5 md:p-6">
            <AdminRetentionAnalytics />
          </section>
          <section className="admin-card overflow-hidden">
            <AnalyticsPageLegacy {...props} only={ONLY_RETENTION} hideHero />
          </section>
        </div>
      )}
    </div>
  )
}
