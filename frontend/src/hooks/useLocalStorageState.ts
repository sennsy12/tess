import { useCallback, useEffect, useRef, useState } from 'react';

function readStoredValue<T>(key: string, initial: T): T {
  if (typeof window === 'undefined') return initial;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initial;
  } catch {
    return initial;
  }
}

/**
 * State persisted to localStorage.
 *
 * Persistence happens outside the setState updater on purpose: updaters must
 * be pure — React StrictMode invokes them twice and concurrent rendering may
 * discard their results, which previously caused duplicate or phantom
 * localStorage writes. `undefined` is never written (JSON.stringify would
 * persist the literal string "undefined" and corrupt the stored value).
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // The lazy initializer runs once; `initial` is captured directly rather
  // than via a ref (refs must not be read during render).
  const [state, setState] = useState<T>(() => readStoredValue(key, initial));
  // Mirror of the latest committed state so the setter can compute the next
  // value without a functional update.
  const stateRef = useRef(state);

  const setStoredState = useCallback(
    (value: T | ((prev: T) => T)) => {
      const next =
        typeof value === 'function' ? (value as (p: T) => T)(stateRef.current) : value;
      stateRef.current = next;
      setState(next);
      if (next !== undefined) {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* ignore quota errors */
        }
      }
    },
    [key],
  );

  useEffect(() => {
    const stored = readStoredValue(key, initial);
    stateRef.current = stored;
    setState(stored);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `initial` is only the seed value

  return [state, setStoredState];
}
