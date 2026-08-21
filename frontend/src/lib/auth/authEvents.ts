const authEventTarget = new EventTarget();

/**
 * Single-flight latch: when several parallel requests fail with 401 at once
 * (e.g. a dashboard firing many queries after session expiry), we emit the
 * 'unauthorized' event only once until the latch is reset by a successful
 * request or a fresh login. This prevents repeated logout/cache-clear cycles.
 */
let unauthorizedEmitted = false;

export const emitAuthUnauthorized = () => {
  if (unauthorizedEmitted) return;
  unauthorizedEmitted = true;
  authEventTarget.dispatchEvent(new Event('unauthorized'));
};

/** Re-arm the unauthorized event (called after login or a successful request). */
export const resetAuthUnauthorized = () => {
  unauthorizedEmitted = false;
};

export const onAuthUnauthorized = (handler: () => void) => {
  const listener = () => handler();
  authEventTarget.addEventListener('unauthorized', listener);
  return () => authEventTarget.removeEventListener('unauthorized', listener);
};
