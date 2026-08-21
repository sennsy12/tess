import { shiftDaysLocal, toDateInputLocal } from '../../lib/formatters';
import { StatType } from '../../types/statistics';

export const STATISTICS_PRESETS = [
  {
    id: 'monthly-revenue',
    label: 'Månedlig omsetning',
    description: 'Vis omsetning per kunde for de siste 30 dagene',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDaysLocal(29), endDate: toDateInputLocal(new Date()) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'top-customers-quarter',
    label: 'Toppkunder dette kvartalet',
    description: 'Ranger kunder i innevarende kvartal',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDaysLocal(89), endDate: toDateInputLocal(new Date()) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'products-by-category',
    label: 'Produkter per kategori',
    description: 'Analyser varegrupper siste 30 dager',
    apply: () => ({
      statType: 'varegruppe' as StatType,
      dateRange: { startDate: shiftDaysLocal(29), endDate: toDateInputLocal(new Date()) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
  {
    id: 'compare-periods',
    label: 'Sammenlign med forrige periode',
    description: 'Slå på periode-sammenligning for siste 30 dager',
    apply: () => ({
      statType: 'kunde' as StatType,
      dateRange: { startDate: shiftDaysLocal(29), endDate: toDateInputLocal(new Date()) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: true,
    }),
  },
  {
    id: 'warehouse-trend',
    label: 'Lagertrend',
    description: 'Se omsetning per lager siste 90 dager',
    apply: () => ({
      statType: 'lager' as StatType,
      dateRange: { startDate: shiftDaysLocal(89), endDate: toDateInputLocal(new Date()) },
      filters: { kundenr: '', varegruppe: '' },
      compareEnabled: false,
    }),
  },
];
