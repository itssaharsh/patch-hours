import type { DayTotals, Heartbeat, PatchClass, Session, SessionView } from "./types";

export const STALE_MS = 4000; // no heartbeat for this long: the TV pauses
export const GAP_MAX_MS = 5000; // longer gaps between "on" heartbeats are never counted
export const MIN_HEARTBEAT_MS = 200; // rate limit per session (5 per second)
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CLASSES: PatchClass[] = ["patch", "bare", "covered", "noface"];

export function newCode(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return s;
}

export function isCode(c: string): boolean {
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch));
}

export function newSession(code: string, now: number, prescribedMin = 120, eye: "L" | "R" = "R"): Session {
  return { code, createdAt: now, prescribedMin, eye, flag: { on: false, cls: "noface", conf: 0 }, lastSeen: 0, changedAt: 0, days: {} };
}

export function isPlayable(s: Session, now: number): boolean {
  return s.flag.on && s.lastSeen > 0 && now - s.lastSeen <= STALE_MS;
}

/** Validates an untrusted heartbeat body. Returns null when it is malformed. */
export function parseHeartbeat(b: unknown): Heartbeat | null {
  if (!b || typeof b !== "object") return null;
  const o = b as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.some((k) => !["on", "cls", "conf", "day", "lagMs", "sim"].includes(k))) return null; // nothing else, e.g. no image data
  if (typeof o.on !== "boolean" || typeof o.conf !== "number" || !(o.conf >= 0 && o.conf <= 1)) return null;
  if (typeof o.cls !== "string" || !CLASSES.includes(o.cls as PatchClass)) return null;
  if (typeof o.day !== "string" || !isRecentDay(o.day)) return null;
  if (o.lagMs !== undefined && (typeof o.lagMs !== "number" || o.lagMs < 0)) return null;
  if (o.sim !== undefined && typeof o.sim !== "boolean") return null;
  if (o.on && o.cls !== "patch") return null; // "on" only ever means a patch was seen
  const hb: Heartbeat = { on: o.on, cls: o.cls as PatchClass, conf: o.conf, day: o.day, lagMs: o.lagMs as number | undefined };
  if (o.sim) hb.sim = true;
  return hb;
}

function dayOf(s: Session, day: string): DayTotals {
  return (s.days[day] ??= { verifiedSec: 0, attestedSec: 0 });
}

/** Applies one heartbeat. Verified time grows only between two "on" heartbeats close together. */
export function applyHeartbeat(s: Session, hb: Heartbeat, now: number): Session {
  const next: Session = structuredClone(s);
  const gap = now - s.lastSeen;
  if (s.flag.on && hb.on && s.lastSeen > 0 && gap > 0 && gap <= GAP_MAX_MS) {
    dayOf(next, hb.day).verifiedSec += gap / 1000;
  } else {
    dayOf(next, hb.day);
  }
  const wasPlayable = isPlayable(s, now);
  if (hb.on !== wasPlayable) next.changedAt = now - Math.min(hb.lagMs ?? 0, 10000);
  next.flag = { on: hb.on, cls: hb.cls, conf: hb.conf };
  next.lastSeen = now;
  if (hb.sim) next.simulated = true;
  pruneDays(next);
  return next;
}

export function attest(s: Session, day: string, minutes: number): Session {
  if (!isRecentDay(day) || !(minutes > 0 && minutes <= 240)) throw new Error("bad attest");
  const next = structuredClone(s);
  dayOf(next, day).attestedSec += minutes * 60;
  pruneDays(next);
  return next;
}

/** Carries an earlier code's minutes and settings into a new pairing (a TV restart makes a new code). */
export function inherit(s: Session, from: Session): Session {
  if (from.code === s.code || (s.inherited ?? []).includes(from.code)) return s;
  const next = structuredClone(s);
  for (const [d, t] of Object.entries(from.days)) {
    const cur = dayOf(next, d);
    cur.verifiedSec += t.verifiedSec;
    cur.attestedSec += t.attestedSec;
  }
  next.prescribedMin = from.prescribedMin;
  next.eye = from.eye;
  if (from.simulated) next.simulated = true;
  next.inherited = [...(s.inherited ?? []), from.code, ...(from.inherited ?? [])].slice(-20);
  pruneDays(next);
  return next;
}

function pruneDays(s: Session) {
  const keep = Object.keys(s.days).sort().slice(-14);
  for (const k of Object.keys(s.days)) if (!keep.includes(k)) delete s.days[k];
}

export function view(s: Session, now: number, day: string): SessionView {
  const playable = isPlayable(s, now);
  const days = Object.keys(s.days).sort().map((d) => ({ day: d, ...s.days[d] }));
  const t = s.days[day] ?? { verifiedSec: 0, attestedSec: 0 };
  // While playing, count the time since the last heartbeat too, so the TV's counter moves smoothly.
  const live = playable ? Math.min(now - s.lastSeen, GAP_MAX_MS) / 1000 : 0;
  return {
    code: s.code, createdAt: s.createdAt, prescribedMin: s.prescribedMin, eye: s.eye, flag: s.flag, simulated: !!s.simulated,
    lastSeen: s.lastSeen, changedAt: s.changedAt, playable,
    stale: s.lastSeen > 0 && now - s.lastSeen > STALE_MS, paired: s.lastSeen > 0, serverNow: now,
    today: { day, verifiedSec: t.verifiedSec + live, attestedSec: t.attestedSec }, days,
    ...(s.report?.voiceKey ? { cheerAt: s.report.at } : {}),
  };
}

export function localDay(now: number, tzOffsetMin = 0): string {
  return new Date(now - tzOffsetMin * 60000).toISOString().slice(0, 10);
}

/** A real calendar date within two days of now (time zones differ; nothing further ahead or behind). */
export function isRecentDay(day: string, now = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(day + "T12:00:00Z");
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return false;
  return Math.abs(t - now) <= 2.5 * 86400000;
}
