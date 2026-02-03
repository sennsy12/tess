export const formatCurrencyNok = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumberNb = (value: number) =>
  new Intl.NumberFormat('nb-NO').format(value);

export const formatDateNb = (value: Date | string) =>
  new Intl.DateTimeFormat('nb-NO').format(new Date(value));
