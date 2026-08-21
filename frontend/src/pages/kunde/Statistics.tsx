import { StatisticsPage } from '../statistics/StatisticsPage';

export function KundeStatistics() {
  return (
    <StatisticsPage
      pageTitle="Statistikk"
      savedViewsScope="kunde-statistics"
      enableSharedViews={false}
      exportFilenamePrefix="kunde-statistikk"
    />
  );
}
