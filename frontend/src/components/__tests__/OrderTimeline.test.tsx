import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { OrderTimeline } from '../OrderTimeline';
import type { OrderDetail, OrderStatusHistoryEntry } from '../../types/order';

const baseOrder = {
  ordrenr: 42,
  dato: '2026-02-10',
  kundenr: 'K001',
  kundenavn: 'Testkunde',
  firmanavn: 'Test AS',
  lagernavn: 'Oslo',
  valutaid: 'NOK',
  sum: 1250,
  workflow_status: 'approved',
  lines: [
    { linjenr: 1, varekode: 'V001', antall: 2, enhet: 'stk', nettpris: 100, linjesum: 200, linjestatus: 1 },
  ],
} as unknown as OrderDetail;

const history: OrderStatusHistoryEntry[] = [
  {
    id: 2,
    ordrenr: 42,
    previous_status: 'pending_approval',
    new_status: 'rejected',
    changed_by_id: 1,
    changed_by_username: 'admin',
    changed_by_role: 'admin',
    comment: 'Feil pris, kontakt selger',
    created_at: '2026-02-11T10:00:00.000Z',
  },
  {
    id: 1,
    ordrenr: 42,
    previous_status: null,
    new_status: 'pending_approval',
    changed_by_id: 5,
    changed_by_username: 'K001',
    changed_by_role: 'kunde',
    comment: null,
    created_at: '2026-02-10T09:00:00.000Z',
  },
];

describe('OrderTimeline history', () => {
  it('renders progress steps without history (legacy view)', () => {
    render(<OrderTimeline order={baseOrder} />);
    expect(screen.getByLabelText('Ordrestatus')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hendelseslogg')).not.toBeInTheDocument();
  });

  it('renders who decided + reject reason when history is present', () => {
    const rejected = { ...baseOrder, workflow_status: 'rejected' } as OrderDetail;
    render(<OrderTimeline order={rejected} history={history} />);
    expect(screen.getByLabelText('Hendelseslogg')).toBeInTheDocument();
    expect(screen.getByText('Feil pris, kontakt selger')).toBeInTheDocument();
    expect(screen.getByText(/av admin/)).toBeInTheDocument();
    expect(screen.getByText(/av K001/)).toBeInTheDocument();
  });

  it('shows a loading skeleton while history loads', () => {
    render(<OrderTimeline order={baseOrder} historyLoading />);
    expect(screen.getByLabelText('Laster hendelser')).toBeInTheDocument();
  });
});
