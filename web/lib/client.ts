"use client";
import { useEffect, useRef, useState } from "react";
import type { SessionView } from "./types";

export const VIDEO_SOURCES = [{ src: "/bunny.webm", type: "video/webm" }, { src: "/bunny.mp4", type: "video/mp4" }];
export const VIDEO_CREDIT = "Big Buck Bunny · Blender Foundation · CC BY 3.0";

export function today(d = new Date()): string {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export async function createSession(): Promise<SessionView> {
  const r = await fetch("/api/session", { method: "POST", body: JSON.stringify({}), headers: { "content-type": "application/json" } });
  if (!r.ok) throw new Error(`create ${r.status}`);
  return r.json();
}

/** Polls the session every intervalMs. Returns the latest view and whether the last poll failed. */
export function useSession(code: string | null, intervalMs = 1000) {
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    if (!code) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const r = await fetch(`/api/session/${code}?day=${today()}`, { cache: "no-store" });
        if (r.status === 404) { setMissing(true); return; }
        if (!r.ok) throw new Error(String(r.status));
        const v = (await r.json()) as SessionView;
        if (alive.current) { setView(v); setError(null); }
      } catch (e) {
        if (alive.current) setError(String(e));
      }
      if (alive.current) t = setTimeout(tick, intervalMs);
    };
    tick();
    return () => { alive.current = false; clearTimeout(t); };
  }, [code, intervalMs]);
  return { view, error, missing };
}
