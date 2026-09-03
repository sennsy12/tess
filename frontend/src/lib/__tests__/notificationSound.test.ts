import { describe, it, expect, beforeEach } from 'vitest';
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from '../notificationSound';

const KEY = 'tess:notification-sound';

describe('notification sound preference', () => {
  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  it('defaults to ON when nothing is stored', () => {
    expect(isNotificationSoundEnabled()).toBe(true);
  });

  it('persists opt-out and opt-in', () => {
    setNotificationSoundEnabled(false);
    expect(localStorage.getItem(KEY)).toBe('0');
    expect(isNotificationSoundEnabled()).toBe(false);

    setNotificationSoundEnabled(true);
    expect(localStorage.getItem(KEY)).toBe('1');
    expect(isNotificationSoundEnabled()).toBe(true);
  });
});
