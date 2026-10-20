import {useEffect, useRef, useState} from 'react';
import {API} from './config';

// Mirrors web/lib/types.ts SessionView (only the fields the TV reads).
export interface SessionView {
  code: string;
  prescribedMin: number;
  playable: boolean;
  stale: boolean;
  paired: boolean;
  serverNow: number;
  changedAt: number;
  flag: {on: boolean; cls: 'patch' | 'bare' | 'covered' | 'noface'; conf: number};
  today: {day: string; verifiedSec: number; attestedSec: number};
}

export function localDay(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export async function createSession(): Promise<SessionView> {
  const r = await fetch(`${API}/api/session`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: '{}',
  });
  if (!r.ok) {
    throw new Error(`create ${r.status}`);
  }
  return r.json();
}

/** Creates a pairing code once, then polls the session every second. */
export function useTvSession() {
  const [code, setCode] = useState<string | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let t: ReturnType<typeof setTimeout>;
    const make = async () => {
      try {
        const s = await createSession();
        if (alive.current) {
          setCode(s.code);
          setView(s);
          setError(null);
        }
      } catch (e) {
        if (alive.current) {
          setError(String(e));
          t = setTimeout(make, 3000);
        }
      }
    };
    make();
    return () => {
      alive.current = false;
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!code) {
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    let live = true;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/api/session/${code}?day=${localDay()}`);
        if (!r.ok) {
          throw new Error(String(r.status));
        }
        const v = (await r.json()) as SessionView;
        if (live) {
          setView(v);
          setError(null);
        }
      } catch (e) {
        if (live) {
          setError(String(e));
        }
      }
      if (live) {
        t = setTimeout(tick, 1000);
      }
    };
    tick();
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [code]);

  return {code, view, error};
}
