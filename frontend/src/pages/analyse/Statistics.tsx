import { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { statisticsApi } from '../../lib/api';
import { SavedReportsList } from '../../components/SavedReportsList';
import { StatsFilters } from './components/StatsFilters';
import { StatsCharts } from './components/StatsCharts';
import { StatsTable } from './components/StatsTable';

type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';

export function AnalyseStatistics() {
  const [statType, setStatType] = useState<StatType>('kunde');
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, [statType, dateRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = {
        startDate: dateRange.startDate || undefined,
        endDate: dateRange.endDate || undefined,
      };

      let response;
      switch (statType) {
        case 'kunde':
          response = await statisticsApi.byKunde(params);
          break;
        case 'varegruppe':
          response = await statisticsApi.byVaregruppe(params);
          break;
        case 'vare':
          response = await statisticsApi.byVare(params);
          break;
        case 'lager':
          response = await statisticsApi.byLager(params);
          break;
        case 'firma':
          response = await statisticsApi.byFirma(params);
          break;
      }
      setData(response?.data?.filter((d: any) => d.total_sum > 0) || []);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNameKey = () => {
    switch (statType) {
      case 'kunde': return 'kundenavn';
      case 'varegruppe': return 'varegruppe';
      case 'vare': return 'varenavn';
      case 'lager': return 'lagernavn';
      case 'firma': return 'firmanavn';
    }
  };

  const getTitle = () => {
    switch (statType) {
      case 'kunde': return 'Statistikk per Kunde';
      case 'varegruppe': return 'Statistikk per Varegruppe';
      case 'vare': return 'Statistikk per Vare';
      case 'lager': return 'Statistikk per Lager';
      case 'firma': return 'Statistikk per Firma';
    }
  };

  const handleLoadReport = (config: any) => {
    if (config.statType) setStatType(config.statType);
    if (config.startDate !== undefined) setDateRange(prev => ({ ...prev, startDate: config.startDate }));
    if (config.endDate !== undefined) setDateRange(prev => ({ ...prev, endDate: config.endDate }));
  };

  const currentConfig = {
    statType,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };

  const currencyFormatter = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  return (
    <Layout title="Detaljert Statistikk">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Filters & Saved Reports */}
        <div className="space-y-6 lg:col-span-1">
          <StatsFilters
            statType={statType}
            setStatType={setStatType}
            dateRange={dateRange}
            setDateRange={setDateRange}
            chartRef={chartRef}
          />

          <SavedReportsList 
            onLoad={handleLoadReport} 
            currentConfig={currentConfig} 
          />
        </div>

        {/* Right Column: Charts & Data */}
        <div className="lg:col-span-2 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 card">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <div ref={chartRef} className="space-y-6">
              <StatsCharts
                data={data}
                nameKey={getNameKey()}
                title={getTitle()}
                currencyFormatter={currencyFormatter}
              />

              <StatsTable
                data={data}
                nameKey={getNameKey()}
                title={getTitle()}
                currencyFormatter={currencyFormatter}
              />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
