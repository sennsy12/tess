import { describe, it, expect } from 'vitest';
import {
  detectNewNotifications,
  notificationTypeLabel,
  NOTIFICATION_TYPE_FILTERS,
} from '../notificationTypes';
import type { AppNotification } from '../../types/notification';

function makeNotification(id: number): AppNotification {
  return {
    id,
    type: 'order_status',
    title: `Ordre #${id} oppdatert`,
    message: 'Status endret',
    metadata: null,
    audience: 'kunde',
    kundenr: 'K001',
    created_at: new Date().toISOString(),
  };
}

describe('detectNewNotifications', () => {
  it('returns only ids not in the known set', () => {
    const known = new Set([1, 2]);
    const incoming = [makeNotification(2), makeNotification(3)];
    const fresh = detectNewNotifications(known, incoming);
    expect(fresh.map((n) => n.id)).toEqual([3]);
  });

  it('returns empty when nothing is new', () => {
    const known = new Set([1, 2, 3]);
    expect(detectNewNotifications(known, [makeNotification(1)])).toEqual([]);
  });

  it('treats everything as new on first load (empty baseline)', () => {
    const incoming = [makeNotification(1), makeNotification(2)];
    expect(detectNewNotifications(new Set(), incoming)).toHaveLength(2);
  });

  it('handles an empty poll response', () => {
    expect(detectNewNotifications(new Set([1]), [])).toEqual([]);
  });
});

describe('notificationTypeLabel', () => {
  it('labels known types in Norwegian', () => {
    expect(notificationTypeLabel('order_status')).toBe('Ordrestatus');
    expect(notificationTypeLabel('order_submitted')).toBe('Nye ordrer');
    expect(notificationTypeLabel('etl_failed')).toBe('ETL feilet');
  });

  it('falls back to Annet for unknown types', () => {
    expect(notificationTypeLabel('something_future')).toBe('Annet');
  });

  it('filter list starts with the all-option and covers every label', () => {
    expect(NOTIFICATION_TYPE_FILTERS[0]).toBe('');
    for (const t of NOTIFICATION_TYPE_FILTERS.slice(1)) {
      expect(notificationTypeLabel(t)).not.toBe('Annet');
    }
  });
});
