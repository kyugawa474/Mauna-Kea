import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * Counts a number up/down to `target` (ease-out cubic). When `key` changes the value
 * jumps instead of animating — used so switching days doesn't count.
 */
export function useTween(target: number, key: string, { duration = 1100, delay = 350 } = {}) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const lastKey = useRef(key);
  const raf = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (reduceMotion) {
      // Shown as-is (see the return below); just keep the refs in step.
      lastKey.current = key;
      from.current = target;
      return;
    }
    if (lastKey.current !== key) {
      lastKey.current = key;
      from.current = target;
      setShown(target);
      return;
    }
    const start = Date.now() + delay;
    const a = from.current;
    const step = () => {
      const p = Math.max(0, Math.min(1, (Date.now() - start) / duration));
      const e = 1 - Math.pow(1 - p, 3);
      const v = a + (target - a) * e;
      from.current = v;
      setShown(v);
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, key, duration, delay, reduceMotion]);

  // With Reduce Motion on, numbers don't count; they just show their value.
  return reduceMotion ? target : shown;
}

/** Counts from 0 to `target` each time `run` changes (e.g. on every tab focus). */
export function useCountUp(target: number, run: number, { duration = 1200, delay = 150 } = {}) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    const start = Date.now() + delay;
    const step = () => {
      const p = Math.max(0, Math.min(1, (Date.now() - start) / duration));
      setShown(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration, delay, reduceMotion]);
  return reduceMotion ? target : shown;
}

export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
