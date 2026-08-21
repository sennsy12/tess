import type { Dimension, Metric } from './analyticsTypes';

export function getMetricLabel(m: Metric): string {
  switch (m) {
    case 'sum':
      return 'Omsetning (NOK)';
    case 'count':
      return 'Antall Ordrer';
    case 'quantity':
      return 'Antall Varer';
  }
}

export function getDimensionLabel(d: Dimension): string {
  switch (d) {
    case 'day':
      return 'Dag';
    case 'month':
      return 'Måned';
    case 'year':
      return 'År';
    case 'product':
      return 'Produkt';
    case 'category':
      return 'Varegruppe';
  }
}
