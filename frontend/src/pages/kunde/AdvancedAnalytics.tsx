import { AdvancedAnalyticsPage } from '../analytics/AdvancedAnalyticsPage';
import { KUNDE_ANALYTICS_PRESETS } from '../analytics/analyticsPresets';

export function AdvancedAnalytics() {
  return (
    <AdvancedAnalyticsPage
      title="Avansert Analyse"
      scope="kunde-advanced-analytics"
      presets={KUNDE_ANALYTICS_PRESETS}
      exportFilenamePrefix="analyse"
      savedViewsTitle="Lagrede arbeidsflater"
      savedViewsDescription="Lagre ditt favorittoppsett for analyser og åpne det igjen senere."
    />
  );
}
