const STORAGE_KEY = 'tess:notification-sound';

export function isNotificationSoundEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Default ON — the toggle in the notification center opts out.
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // Storage unavailable (private mode) — sound just stays at runtime default.
  }
}

let sharedContext: AudioContext | null = null;

/**
 * Short, quiet sine beep for new notifications. Asset-free (WebAudio).
 * Never throws — audio must never break the notification UX. Resolves
 * silently when the browser blocks audio (e.g. before first user gesture).
 */
export async function playNotificationSound(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    sharedContext ??= new Ctor();
    if (sharedContext.state === 'suspended') {
      await sharedContext.resume();
    }
    const now = sharedContext.currentTime;
    const osc = sharedContext.createOscillator();
    const gain = sharedContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(sharedContext.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Audio blocked or unsupported — stay silent.
  }
}
