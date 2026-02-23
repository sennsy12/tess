const authEventTarget = new EventTarget();

export const emitAuthUnauthorized = () => {
  authEventTarget.dispatchEvent(new Event('unauthorized'));
};

export const onAuthUnauthorized = (handler: () => void) => {
  const listener = () => handler();
  authEventTarget.addEventListener('unauthorized', listener);
  return () => authEventTarget.removeEventListener('unauthorized', listener);
};
