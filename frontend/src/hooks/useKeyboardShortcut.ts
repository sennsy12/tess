import { useEffect, useRef } from 'react';

function parseCombo(combo: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const key = parts[parts.length - 1];
  return {
    key,
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
  };
}

function matchesCombo(event: KeyboardEvent, parsed: ReturnType<typeof parseCombo>): boolean {
  const eventKey = event.key.toLowerCase();
  const matchesKey =
    eventKey === parsed.key ||
    (parsed.key.length === 1 && event.code.toLowerCase() === `key${parsed.key}`);

  if (!matchesKey) return false;

  const wantsModifier = parsed.ctrl || parsed.meta;
  const modifierPressed =
    (parsed.ctrl && event.ctrlKey) || (parsed.meta && event.metaKey);

  if (wantsModifier && !modifierPressed) return false;
  if (parsed.ctrl && !event.ctrlKey) return false;
  if (parsed.meta && !event.metaKey) return false;
  if (parsed.shift && !event.shiftKey) return false;
  if (!parsed.shift && event.shiftKey) return false;
  if (parsed.alt && !event.altKey) return false;
  if (!parsed.alt && event.altKey) return false;

  return true;
}

export function useKeyboardShortcut(
  combo: string,
  handler: () => void,
  options?: { enabled?: boolean; preventDefault?: boolean },
): void {
  const enabled = options?.enabled ?? true;
  const preventDefault = options?.preventDefault ?? true;
  const handlerRef = useRef(handler);

  // Latest-ref pattern: update outside render so the listener below always
  // invokes the freshest handler without re-subscribing.
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const parsed = parseCombo(combo);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesCombo(event, parsed)) return;
      if (preventDefault) event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled, preventDefault]);
}
