import { StatisticsPage } from '../statistics/StatisticsPage';

export function AnalyseStatistics() {
  return (
    <StatisticsPage
      pageTitle="Detaljert Statistikk"
      savedViewsScope="analyse-statistics"
      enableSharedViews={false}
      exportFilenamePrefix="analyse-statistikk"
    />
  );
}
