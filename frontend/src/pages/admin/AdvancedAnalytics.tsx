import { AdvancedAnalyticsPage } from '../analytics/AdvancedAnalyticsPage';
import { ADMIN_ANALYTICS_PRESETS } from '../analytics/analyticsPresets';

export function AdminAdvancedAnalytics() {
  return (
    <AdvancedAnalyticsPage
      title="Admin Avansert Analyse"
      scope="admin-advanced-analytics"
      presets={ADMIN_ANALYTICS_PRESETS}
      exportFilenamePrefix="admin-analyse"
      savedViewsTitle="Lagrede arbeidsflater"
      savedViewsDescription="Lagre dimensjon, måltall, datoer og søk. Del oppsett med andre administratorer."
      enableSharedViews
    />
  );
}
