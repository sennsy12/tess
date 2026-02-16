import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to the target value over `duration` ms.
 * Uses `requestAnimationFrame` for smooth 60fps updates.
 *
 * @param target  - The final number to count up to
 * @param duration - Animation duration in milliseconds (default 1200)
 * @returns The current animated value (integer)
 */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number>(0);

  useEffect(() => {
    if (!target || target <= 0) {
      setValue(0);
      return;
    }

    startTime.current = null;

    const step = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for a natural deceleration effect
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));

      if (progress < 1) {
        rafId.current = requestAnimationFrame(step);
      }
    };

    rafId.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafId.current);
  }, [target, duration]);

  return value;
}
