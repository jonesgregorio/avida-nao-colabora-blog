import AdminRetentionAnalytics from './AdminRetentionAnalytics'
import AdminJourneyFunnel from './AdminJourneyFunnel'
import AdminConversionFunnel from './AdminConversionFunnel'
import AnalyticsPageLegacy from './AnalyticsPageLegacy'

interface AnalyticsPageProps {
  onEditArticle?: (id: string) => void
}

export default function AnalyticsPage(props: AnalyticsPageProps) {
  return (
    <div className="admin-page-pad max-w-[1600px] mx-auto w-full space-y-5">
      <section className="admin-page-hero">
        <div>
          <span className="admin-eyebrow">Análise</span>
          <h1>Analytics</h1>
          <p>Entenda aquisição, jornada, retenção, conversão e uso da plataforma em uma visão executiva.</p>
        </div>
      </section>

      <section className="admin-section-frame">
        <AdminRetentionAnalytics />
      </section>
      <section className="admin-section-frame">
        <AdminJourneyFunnel />
      </section>
      <section className="admin-section-frame p-5 md:p-6">
        <AdminConversionFunnel />
      </section>
      <section className="admin-section-frame admin-legacy-surface">
        <AnalyticsPageLegacy {...props} />
      </section>
    </div>
  )
}
