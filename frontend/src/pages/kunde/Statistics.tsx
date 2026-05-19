import { StatisticsPage } from '../admin/Statistics';

export function KundeStatistics() {
  return (
    <StatisticsPage
      pageTitle="Statistikk"
      savedViewsScope="kunde-statistics"
      enableSharedViews={false}
    />
  );
}
