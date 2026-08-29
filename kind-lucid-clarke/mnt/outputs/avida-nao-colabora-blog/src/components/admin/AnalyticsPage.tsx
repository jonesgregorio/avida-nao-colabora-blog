import AdminRetentionAnalytics from './AdminRetentionAnalytics'
import AdminConversionFunnel from './AdminConversionFunnel'
import AnalyticsPageLegacy from './AnalyticsPageLegacy'

interface AnalyticsPageProps {
  onEditArticle?: (id: string) => void
}

export default function AnalyticsPage(props: AnalyticsPageProps) {
  return (
    <>
      <AdminRetentionAnalytics />
      <div className="max-w-7xl mx-auto w-full px-6 pt-8">
        <AdminConversionFunnel />
      </div>
      <AnalyticsPageLegacy {...props} />
    </>
  )
}
