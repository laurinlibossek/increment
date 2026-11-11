import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { startOfDay } from '@increment/core';

/** The current time, updated every `ms` while `on`. */
export function useNow(ms: number, on = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms, on]);
  return now;
}

/**
 * The start of today (local midnight, ms), for screens with dates in them:
 * it changes at the next local midnight while the app is open, and when the app
 * comes back to the foreground (a timer can't run in the background, and the
 * clock or time zone may have changed meanwhile). One timer to the next
 * midnight, never a fixed 24 hours, so days of 23 or 25 hours (DST) work (#36).
 */
export function useToday(): number {
  const [day, setDay] = useState(() => startOfDay(Date.now()) as number);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const next = new Date();
      next.setHours(24, 0, 0, 0);
      // a little after midnight, so the new day has begun when it fires
      timer = setTimeout(check, Math.max(1000, next.getTime() - Date.now() + 500));
    };
    const check = () => {
      const d = startOfDay(Date.now()) as number;
      setDay((prev) => (prev === d ? prev : d));
      schedule();
    };
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => { if (timer) clearTimeout(timer); sub.remove(); };
  }, []);
  return day;
}
