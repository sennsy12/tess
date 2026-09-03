import { useEffect, useState } from 'react';

/**
 * Ticker som re-rendrer hver `intervalMs` (default 5s) for relativ tid
 * («for X s siden»). Hopper over tick når fanen er skjult – billig og
 * unngår unødvendige renders i bakgrunn.
 */
export function useNow(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setNow(Date.now());
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
