import { shiftDaysLocal, toDateInputLocal } from '../../lib/formatters';
import type { AnalyticsPreset } from './analyticsTypes';

const today = () => toDateInputLocal(new Date());

export const KUNDE_ANALYTICS_PRESETS: AnalyticsPreset[] = [
  {
    id: 'monthly-revenue',
    label: 'Månedlig omsetning',
    bestFor: 'Se total omsetning over tid',
    description: 'Omsetning per måned siste 12 måneder',
    config: {
      metric: 'sum',
      dimension: 'month',
      chartType: 'line',
      startDate: shiftDaysLocal(364),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'products-by-category',
    label: 'Produkter per kategori',
    bestFor: 'Finn hvilke varegrupper som selger mest',
    description: 'Antall varer per varegruppe siste 30 dager',
    config: {
      metric: 'quantity',
      dimension: 'category',
      chartType: 'bar',
      startDate: shiftDaysLocal(29),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'compare-this-month',
    label: 'Denne måneden dag for dag',
    bestFor: 'Oppdage daglige topper og daler',
    description: 'Følg omsetning daglig for siste 30 dager',
    config: {
      metric: 'sum',
      dimension: 'day',
      chartType: 'line',
      startDate: shiftDaysLocal(29),
      endDate: today(),
      search: '',
    },
  },
];

export const ADMIN_ANALYTICS_PRESETS: AnalyticsPreset[] = [
  {
    id: 'monthly-revenue',
    label: 'Månedlig omsetning',
    description: 'Omsetning per måned siste 12 måneder',
    config: {
      metric: 'sum',
      dimension: 'month',
      chartType: 'line',
      startDate: shiftDaysLocal(364),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'quarterly-category-mix',
    label: 'Kvartalsvis varegruppefordeling',
    description: 'Omsetning per varegruppe siste 90 dager',
    config: {
      metric: 'sum',
      dimension: 'category',
      chartType: 'bar',
      startDate: shiftDaysLocal(89),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'products-by-category',
    label: 'Produkter per kategori',
    description: 'Antall varer per varegruppe siste 30 dager',
    config: {
      metric: 'quantity',
      dimension: 'category',
      chartType: 'bar',
      startDate: shiftDaysLocal(29),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'compare-this-month',
    label: 'Denne måneden dag for dag',
    description: 'Daglig omsetning siste 30 dager',
    config: {
      metric: 'sum',
      dimension: 'day',
      chartType: 'line',
      startDate: shiftDaysLocal(29),
      endDate: today(),
      search: '',
    },
  },
  {
    id: 'warehouse-revenue-trend',
    label: 'Lagertrend',
    description: 'Se omsetning per lager/produkt siste 30 dager',
    config: {
      metric: 'sum',
      dimension: 'product',
      chartType: 'bar',
      startDate: shiftDaysLocal(29),
      endDate: today(),
      search: '',
    },
  },
];
