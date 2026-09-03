import { describe, it, expect } from 'vitest';
import { isPopupCancelled } from '../msalClient';

describe('isPopupCancelled', () => {
  it('detects user-aborted popups', () => {
    expect(isPopupCancelled({ errorCode: 'user_cancelled' })).toBe(true);
    expect(isPopupCancelled({ errorCode: 'popup_window_error' })).toBe(true);
  });

  it('passes real errors through', () => {
    expect(isPopupCancelled({ errorCode: 'invalid_client' })).toBe(false);
    expect(isPopupCancelled({ errorCode: 'no_id_token' })).toBe(false);
    expect(isPopupCancelled(new Error('network down'))).toBe(false);
    expect(isPopupCancelled(null)).toBe(false);
    expect(isPopupCancelled(undefined)).toBe(false);
    expect(isPopupCancelled('user_cancelled')).toBe(false);
  });
});
