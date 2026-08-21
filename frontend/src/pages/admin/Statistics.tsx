import { StatisticsPage } from '../statistics/StatisticsPage';

export { StatisticsPage, type StatisticsPageProps } from '../statistics/StatisticsPage';

export function AdminStatistics() {
  return (
    <StatisticsPage
      pageTitle="Admin Statistikk"
      savedViewsScope="admin-statistics"
      enableSharedViews
      exportFilenamePrefix="admin-statistikk"
    />
  );
}
